'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { asset, scrollState } from '@/lib/scroll';

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

export type Panel = {
  name: string;
  kind: 'pent' | 'hex';
  geometry: THREE.BufferGeometry;
  /** Unit vector from the ball's centre through the panel. Drives the explode. */
  dir: THREE.Vector3;
};

/**
 * Two extra attributes, both feeding the wireframe shader.
 *
 * `aBary` is barycentric coordinates, so the shader can measure how close a
 * fragment is to a triangle edge and draw the mesh itself. Three's
 * `wireframe: true` is a separate GL_LINES draw: it cannot be blended against
 * the shaded surface, its width is 1px on every platform that matters, and it
 * is all-or-nothing. Doing it in the fragment shader gives a real crossfade, a
 * controllable width, and an emissive colour the bloom pass can pick up.
 *
 * `aEdge` is the distance from the panel's own outline, normalised per panel.
 * It exists because the triangle mesh alone is the wrong picture: the client's
 * ball carries about 500 triangles per panel, and lighting up all of them at
 * once turns a football into a cyan smear. The outline is the line that means
 * something -- it is where the panels are actually stitched -- so it burns
 * bright and the triangulation sits behind it at a fraction of the strength.
 *
 * Both have to be computed before the geometry is un-indexed. A panel's
 * outline is found from its edges, and an edge is only visible while vertices
 * are still shared; barycentrics then need those same vertices split apart,
 * because a corner's value belongs to a triangle rather than to a point.
 */
function withBarycentrics(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const indexed = source.clone();
  const position = indexed.getAttribute('position');
  const index = indexed.getIndex();

  const edge = new Float32Array(position.count).fill(1);
  if (index) {
    // Edges used by one triangle are the panel's rim.
    const uses = new Map<string, number>();
    for (let i = 0; i < index.count; i += 3) {
      const t = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        uses.set(key, (uses.get(key) ?? 0) + 1);
      }
    }
    const rim: number[] = [];
    for (const [key, count] of uses) {
      if (count !== 1) continue;
      const [a, b] = key.split('_').map(Number);
      rim.push(a, b);
    }

    if (rim.length) {
      const unique = Array.from(new Set(rim));
      const rimPos = unique.map((i) => new THREE.Vector3().fromBufferAttribute(position, i));
      const point = new THREE.Vector3();
      let longest = 0;
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i);
        let nearest = Infinity;
        for (const r of rimPos) nearest = Math.min(nearest, point.distanceToSquared(r));
        edge[i] = Math.sqrt(nearest);
        longest = Math.max(longest, edge[i]);
      }
      if (longest > 0) for (let i = 0; i < edge.length; i++) edge[i] /= longest;
    }
  }
  indexed.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));

  const geometry = index ? indexed.toNonIndexed() : indexed;
  const count = geometry.getAttribute('position').count;
  const bary = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 3) {
    bary[i * 3 + 0] = 1;
    bary[i * 3 + 4] = 1;
    bary[i * 3 + 8] = 1;
  }
  geometry.setAttribute('aBary', new THREE.BufferAttribute(bary, 3));
  if (index) indexed.dispose();
  return geometry;
}

/**
 * A truncated icosahedron built from scratch, used when the GLB is missing.
 *
 * The 32 panel centres are exactly the icosahedron's 12 vertices (the
 * pentagons) and its 20 face centres (the hexagons). Each panel is a fan of
 * ring-subdivided polygon points projected onto the unit sphere, sized from
 * the distance to its own nearest neighbour so the seam gap comes out even
 * without a hand-tuned constant.
 *
 * This exists so the scene runs on a clean checkout with no asset pipeline. The
 * shipped ball is the client's mesh; this is the understudy.
 */
export function buildProceduralPanels(): Panel[] {
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const pos = ico.getAttribute('position');

  const vertexDirs: THREE.Vector3[] = [];
  const faceDirs: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(pos, i);
    const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
    faceDirs.push(a.clone().add(b).add(c).normalize());
    for (const v of [a, b, c]) {
      const dir = v.clone().normalize();
      if (!vertexDirs.some((existing) => existing.distanceTo(dir) < 1e-4)) vertexDirs.push(dir);
    }
  }
  ico.dispose();

  const centres = [
    ...vertexDirs.map((dir) => ({ dir, sides: 5, kind: 'pent' as const })),
    ...faceDirs.map((dir) => ({ dir, sides: 6, kind: 'hex' as const })),
  ];

  return centres.map((centre, index) => {
    // Half the angle to the nearest other panel, minus a little for the seam.
    let nearest = Math.PI;
    for (const other of centres) {
      if (other === centre) continue;
      nearest = Math.min(nearest, centre.dir.angleTo(other.dir));
    }
    const radius = (nearest / 2) * 0.9;

    // A panel's edges face its neighbours, so its corners sit half a step round.
    const tangent = new THREE.Vector3(0, 1, 0);
    if (Math.abs(centre.dir.y) > 0.9) tangent.set(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(centre.dir, tangent).normalize();
    const v = new THREE.Vector3().crossVectors(centre.dir, u).normalize();
    const offset = Math.PI / centre.sides;

    const RINGS = 3;
    const points: THREE.Vector3[] = [centre.dir.clone()];
    for (let ring = 1; ring <= RINGS; ring++) {
      const r = radius * (ring / RINGS);
      for (let s = 0; s < centre.sides; s++) {
        const from = offset + (s / centre.sides) * Math.PI * 2;
        const to = offset + ((s + 1) / centre.sides) * Math.PI * 2;
        for (let step = 0; step < ring; step++) {
          // Walk the polygon edge rather than the circle, so corners stay sharp.
          const t = step / ring;
          const angleA = from;
          const angleB = to;
          const a = new THREE.Vector3()
            .addScaledVector(u, Math.cos(angleA) * r)
            .addScaledVector(v, Math.sin(angleA) * r);
          const b = new THREE.Vector3()
            .addScaledVector(u, Math.cos(angleB) * r)
            .addScaledVector(v, Math.sin(angleB) * r);
          const edge = a.lerp(b, t);
          points.push(centre.dir.clone().add(edge).normalize());
        }
      }
    }

    // Fan each ring to the one inside it.
    const indices: number[] = [];
    const ringStart = (ring: number) => (ring === 0 ? 0 : 1 + centre.sides * ((ring - 1) * ring) / 2);
    const ringLen = (ring: number) => (ring === 0 ? 1 : centre.sides * ring);
    for (let ring = 1; ring <= RINGS; ring++) {
      const outer = ringStart(ring);
      const inner = ringStart(ring - 1);
      const outerLen = ringLen(ring);
      const innerLen = ringLen(ring - 1);
      for (let i = 0; i < outerLen; i++) {
        const o0 = outer + i;
        const o1 = outer + ((i + 1) % outerLen);
        const i0 = inner + (innerLen === 1 ? 0 : Math.floor((i * innerLen) / outerLen) % innerLen);
        const i1 = inner + (innerLen === 1 ? 0 : Math.floor(((i + 1) * innerLen) / outerLen) % innerLen);
        indices.push(o0, o1, i0);
        if (i0 !== i1) indices.push(o1, i1, i0);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(points.flatMap((p) => [p.x, p.y, p.z]), 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return {
      name: `panel_${centre.kind}_${index.toString().padStart(2, '0')}`,
      kind: centre.kind,
      geometry: withBarycentrics(geometry),
      dir: centre.dir.clone(),
    };
  });
}

/** Read the panels out of the GLB written by tools/obj-to-glb.py. */
function panelsFromGltf(scene: THREE.Object3D): Panel[] {
  const panels: Panel[] = [];
  scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const extras = (mesh.userData ?? {}) as { panel?: string; dir?: number[] };
    const kind = extras.panel === 'pent' ? 'pent' : 'hex';
    const dir = extras.dir
      ? new THREE.Vector3(...extras.dir)
      : // Fall back to the centroid direction if the extras did not survive
        // whatever wrote the file.
        (() => {
          mesh.geometry.computeBoundingSphere();
          const c = mesh.geometry.boundingSphere!.center.clone();
          return c.lengthSq() > 1e-9 ? c.normalize() : new THREE.Vector3(0, 1, 0);
        })();
    panels.push({
      name: mesh.name || `panel_${panels.length}`,
      kind,
      geometry: withBarycentrics(mesh.geometry),
      dir,
    });
  });
  return panels;
}

/* ------------------------------------------------------------------ *
 * Material
 * ------------------------------------------------------------------ */

const NEON = new THREE.Color('#39f6ff');

export type PanelMaterial = THREE.MeshStandardMaterial & {
  userData: { uProgress: { value: number }; uNeon: { value: THREE.Color } };
};

/**
 * meshStandardMaterial, extended rather than replaced.
 *
 * Writing this as a raw ShaderMaterial would mean reimplementing the whole PBR
 * chain -- the environment map, the tone mapping, the lights -- to get back to
 * where the standard material already is. Injecting into it keeps all of that
 * and adds one uniform.
 *
 * uProgress at 0 is the shaded panel. At 1 the surface has fallen away to a
 * faint ghost and the triangle edges are glowing neon, bright enough to pass
 * the bloom pass's luminance threshold.
 */
function makePanelMaterial(kind: 'pent' | 'hex'): PanelMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: kind === 'pent' ? '#08090c' : '#eef1f4',
    roughness: kind === 'pent' ? 0.42 : 0.36,
    metalness: kind === 'pent' ? 0.1 : 0.05,
    transparent: true,
    side: THREE.DoubleSide,
  }) as PanelMaterial;

  const uProgress = { value: 0 };
  const uNeon = { value: NEON.clone() };
  material.userData = { uProgress, uNeon };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uProgress = uProgress;
    shader.uniforms.uNeon = uNeon;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec3 aBary;\nattribute float aEdge;\nvarying vec3 vBary;\nvarying float vEdge;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBary = aBary;\nvEdge = aEdge;');

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uProgress;
        uniform vec3 uNeon;
        varying vec3 vBary;
        varying float vEdge;

        /* Distance to the nearest triangle edge, measured in pixels rather
         * than in barycentric units, so the line keeps its width no matter how
         * far away the panel is or how unevenly the mesh is subdivided. */
        float meshFactor() {
          vec3 d = fwidth(vBary);
          vec3 a = smoothstep(vec3(0.0), d * 0.9, vBary);
          return 1.0 - min(min(a.x, a.y), a.z);
        }`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        /* The panel's own outline carries the picture; the triangulation is
         * texture behind it, at a quarter of the strength. */
        float outline = 1.0 - smoothstep(0.0, 0.16, vEdge);
        float wire = max(outline, meshFactor() * 0.26);
        vec3 neon = uNeon * (0.45 + outline * 1.25);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, neon, uProgress * wire);
        /* The interior does not vanish completely: a little left behind keeps
         * the ball reading as a solid being opened up rather than as a flat
         * tangle of lines. */
        gl_FragColor.a *= mix(1.0, max(wire, 0.055), uProgress);`,
      );
  };

  return material;
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

const MODEL_URL = '/models/soccer-ball.glb';

/** How far each panel travels outward at full explode, in ball radii. */
const EXPLODE_DISTANCE = 0.95;

export type SoccerModelProps = {
  /** Force the procedural build. The error boundary in SoccerCanvas sets it. */
  procedural?: boolean;
  /** Panels the HUD wants to hang callouts off, by index. */
  onPanelsReady?: (panels: Panel[]) => void;
};

/** The scrub writes here; useFrame reads it. Never React state -- see lib/scroll. */
type Anim = {
  spin: number;
  dolly: number;
  kick: number;
  explode: number;
  wire: number;
  detail: number;
};

export default function SoccerModel({ procedural = false, onPanelsReady }: SoccerModelProps) {
  const root = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Group>(null);
  const shock = useRef<THREE.Mesh>(null);
  const panelRefs = useRef<THREE.Mesh[]>([]);
  const camera = useThree((state) => state.camera);

  const gltf = useGLTF(asset(MODEL_URL), true) as unknown as { scene: THREE.Object3D };

  const panels = useMemo(() => {
    if (procedural || !gltf?.scene) return buildProceduralPanels();
    const fromFile = panelsFromGltf(gltf.scene);
    return fromFile.length ? fromFile : buildProceduralPanels();
  }, [procedural, gltf]);

  const materials = useMemo(() => panels.map((panel) => makePanelMaterial(panel.kind)), [panels]);

  useLayoutEffect(() => {
    onPanelsReady?.(panels);
  }, [panels, onPanelsReady]);

  useLayoutEffect(() => {
    return () => {
      panels.forEach((panel) => panel.geometry.dispose());
      materials.forEach((material) => material.dispose());
    };
  }, [panels, materials]);

  const anim = useRef<Anim>({ spin: 0, dolly: 0, kick: 0, explode: 0, wire: 0, detail: 0 });

  /**
   * The scroll timeline.
   *
   * gsap.context() scopes every tween and trigger created inside it, so the
   * revert on cleanup takes all of them with it. Without it React 19's strict
   * mode double-invoke leaves a second ScrollTrigger attached to the same
   * element, both scrubbing the same object, and the scene stutters in
   * development in a way it never does in production -- which is the worst
   * kind of bug to chase.
   */
  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const target = anim.current;
      const timeline = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: '#scroll-track',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });

      // 01 -- approach. One full turn while the camera closes in.
      timeline.to(target, { spin: 1, dolly: 1, duration: 0.3 }, 0);

      // 02 -- the strike. Contact is quick and the shell opens behind it, so
      // the kick runs out well before the explode finishes.
      timeline.to(target, { kick: 1, duration: 0.4, ease: 'power2.out' }, 0.3);
      timeline.to(target, { explode: 1, duration: 0.34 }, 0.36);
      timeline.to(target, { wire: 1, duration: 0.3 }, 0.34);

      // 03 -- detail. The camera comes round the side to the callouts.
      timeline.to(target, { detail: 1, duration: 0.3 }, 0.7);
    });

    return () => ctx.revert();
  }, []);

  const tmp = useMemo(() => new THREE.Vector3(), []);
  const lookAt = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const a = anim.current;
    const t = state.clock.elapsedTime;

    /* --- the ball itself --- */
    if (ball.current) {
      // An idle drift under the scrubbed rotation, so it is never dead still.
      ball.current.rotation.y = a.spin * Math.PI * 2 + a.kick * Math.PI * 5 + t * 0.12;
      ball.current.rotation.x = a.kick * Math.PI * 1.4 - 0.12;
      ball.current.rotation.z = a.kick * 0.5;

      // The strike: a short compression at contact, then an arc away and up.
      const contact = Math.min(1, a.kick / 0.12);
      const flight = Math.max(0, (a.kick - 0.12) / 0.88);
      const squash = 1 - Math.sin(contact * Math.PI) * 0.16 * (1 - flight);
      ball.current.scale.set(1 / squash, squash, 1 / squash);

      ball.current.position.set(
        flight * 1.15 - contact * 0.14,
        Math.sin(flight * Math.PI * 0.85) * 0.85,
        flight * -0.6,
      );
    }

    /* --- panels come apart along their own outward direction --- */
    const distance = a.explode * EXPLODE_DISTANCE;
    for (let i = 0; i < panelRefs.current.length; i++) {
      const mesh = panelRefs.current[i];
      if (!mesh) continue;
      const dir = panels[i].dir;
      // Pentagons lead by a fraction so the shell peels rather than bursting.
      const lead = panels[i].kind === 'pent' ? 1.12 : 0.94;
      mesh.position.copy(dir).multiplyScalar(distance * lead);
      mesh.rotation.set(
        dir.x * a.explode * 0.7,
        dir.y * a.explode * 0.7,
        dir.z * a.explode * 0.7,
      );
    }

    for (const material of materials) material.userData.uProgress.value = a.wire;

    /* --- impact ring, alive only across the moment of contact ---
     * Windowed on a rising kick rather than on distance from a midpoint: the
     * ring has to be absent at rest, and |kick - 0.1| is 0.1 when kick is 0,
     * which is well inside the window and left it hanging in frame on the
     * opening chapter. */
    if (shock.current) {
      const life = a.kick <= 0 ? 0 : Math.max(0, 1 - a.kick / 0.25) * Math.min(1, a.kick / 0.02);
      shock.current.visible = life > 0.01;
      // Billboarded. Lying flat it reads as a wide ellipse cutting across the
      // whole frame rather than as a ring coming off the contact.
      shock.current.quaternion.copy(camera.quaternion);
      if (ball.current) shock.current.position.copy(ball.current.position);
      shock.current.scale.setScalar(0.45 + (1 - life) * 2.6);
      const ringMaterial = shock.current.material as THREE.MeshBasicMaterial;
      // Squared, so it is a flash rather than a teal hoop hanging around the
      // ball for the first fifth of the strike.
      ringMaterial.opacity = life * life * 0.55;
    }

    /* --- camera ---
     * Driven here rather than by GSAP so it settles with the same easing as
     * everything else and never fights the scrub for ownership of the object.
     *
     * Distance is a sum of what each phase wants, not a single lerp. The
     * approach pulls in, but the shell then grows to more than twice its own
     * radius, so the explode has to push straight back out or the panels fill
     * the frame and the scene stops reading as a ball at all.
     */
    let range = 6.4 - a.dolly * 2.1 + a.explode * 3.4 - a.detail * 1.1;

    /* A perspective camera's field of view is vertical, so a portrait viewport
     * keeps all of the height and loses the width: the ball goes from
     * comfortably framed on a laptop to overflowing both edges of a phone
     * without a single number changing. Pull back by however far the aspect
     * has fallen short, capped so a very tall window does not leave it a
     * speck. */
    const aspect = state.size.width / Math.max(1, state.size.height);
    const portrait = aspect < 1;
    range *= THREE.MathUtils.clamp(1.5 / aspect, 1, 2.1);

    const orbit = a.detail * 0.8;
    tmp.set(
      Math.sin(orbit) * range,
      0.25 + a.detail * 0.3 - a.kick * 0.15,
      Math.cos(orbit) * range,
    );
    camera.position.lerp(tmp, 1 - Math.pow(0.0015, delta));

    /* Landscape puts the copy in a left column and the ball to its right, so
     * the camera aims left of the subject; on the last chapter it comes back
     * towards centre, because the stat column arrives down the right and a
     * ball still pushed into that half sits under it.
     *
     * Portrait has no room for a column at all. The copy still sits at the
     * top there, so the ball drops below it instead -- aiming above the ball
     * pushes it down the frame. */
    const bias = portrait ? 0 : 0.55 + a.dolly * 0.5 - a.detail * 0.45;
    lookAt.set(a.kick * 0.55 - bias, a.kick * 0.4 + (portrait ? 1.15 : 0), 0);
    camera.lookAt(lookAt);
  });

  return (
    <group ref={root} name="ball-root">
      <group ref={ball}>
        {panels.map((panel, index) => (
          <mesh
            key={panel.name}
            name={panel.name}
            ref={(node) => {
              if (node) panelRefs.current[index] = node;
            }}
            geometry={panel.geometry}
            material={materials[index]}
            castShadow={false}
            receiveShadow={false}
          />
        ))}
      </group>

      {/* Contact ring. Unlit and over-bright on purpose -- it is here to be
          caught by the bloom pass, not to be shaded. */}
      <mesh ref={shock} visible={false}>
        <ringGeometry args={[0.975, 1, 96]} />
        <meshBasicMaterial
          color={NEON}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

useGLTF.preload(asset(MODEL_URL));
