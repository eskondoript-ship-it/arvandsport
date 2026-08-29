/**
 * The ball itself: its geometry, its panels, and the material that crosses
 * from a shaded surface to a glowing wireframe.
 *
 * This lives apart from any component because two very different things draw
 * it — the scroll-driven study at /experience/, and the small island embedded
 * in the site's own homepage hero. They share the mesh, the panel recovery and
 * the shader; they share nothing else, and neither should own the other's copy
 * of this.
 */
import * as THREE from 'three';


export type Panel = {
  name: string;
  /**
   * Which kind of panel this is. 'pent' and 'hex' belong to a truncated
   * icosahedron and carry their own colour; 'shell' is a quarter of a
   * four-panel ball, which brings its own textured material from the file and
   * is not coloured here.
   */
  kind: 'pent' | 'hex' | 'shell';
  geometry: THREE.BufferGeometry;
  /** Unit vector from the ball's centre through the panel. Drives the explode. */
  dir: THREE.Vector3;
  /**
   * The material the file shipped with, when it has one worth keeping. The
   * Trionda is a textured ball: base colour, roughness and normal maps that
   * are the whole reason it looks like the real thing. Those are extended with
   * the wireframe shader rather than thrown away for a flat colour.
   */
  source?: THREE.MeshStandardMaterial;
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
export function panelsFromGltf(scene: THREE.Object3D): Panel[] {
  const panels: Panel[] = [];
  scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const extras = (mesh.userData ?? {}) as { panel?: string; dir?: number[] };
    const kind: Panel['kind'] =
      extras.panel === 'pent' ? 'pent' : extras.panel === 'shell' ? 'shell' : 'hex';
    const source = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as
      | THREE.MeshStandardMaterial
      | undefined;
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
      source: source?.isMeshStandardMaterial ? source : undefined,
    });
  });
  return panels;
}

/* ------------------------------------------------------------------ *
 * Material
 * ------------------------------------------------------------------ */

export const NEON = new THREE.Color('#39f6ff');

/**
 * A textured panel, re-made as glass.
 *
 * The reference this scene is modelled on renders its object as an instrument
 * seen through itself -- the body is transparent, the internals show through,
 * and the printing survives as a tint rather than as paint. Physical
 * transmission does exactly that: light passes through the shell, the base
 * colour map tints what comes out the other side, and the panels read as
 * moulded glass with the Trionda's print suspended in them.
 *
 * Transmission and `transparent` do not mix. Transparency sorts and blends the
 * surface; transmission samples what is already behind it, which needs the
 * material drawn as opaque into a buffer the renderer prepares for it. Setting
 * both gives a pane that blends its own transmission over itself and reads as
 * fog.
 */
function toGlass(source: THREE.MeshStandardMaterial): THREE.MeshPhysicalMaterial {
  const glass = new THREE.MeshPhysicalMaterial({
    map: source.map,
    normalMap: source.normalMap,
    roughnessMap: source.roughnessMap,
    metalnessMap: source.metalnessMap,
    color: new THREE.Color('#dfe9f5'),
    metalness: 0,
    roughness: 0.16,
    transmission: 0.92,
    thickness: 0.55,
    ior: 1.42,
    /* What the light picks up on its way through. A neutral pane over a dark
     * scene looks grey, so there is a tint -- but only just. At #7fd8e8 over
     * 2.4 units it swamped the Trionda's own print and the ball came out a
     * single cyan; pale, and over a much longer distance, the tint reads as
     * glass while the panel still reads as the panel. */
    attenuationColor: new THREE.Color('#cfeef6'),
    attenuationDistance: 7.5,
    clearcoat: 0.6,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.4,
    transparent: false,
    side: THREE.DoubleSide,
  });
  return glass;
}

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
export function makePanelMaterial(panel: Pick<Panel, 'kind' | 'source'>): PanelMaterial {
  /* A textured ball brings its own material and its maps are the point of it,
   * so that is cloned and extended. A ball built from geometry alone gets the
   * flat black-and-white the older mesh was rendered with. Either way the same
   * shader goes in on top, because the wireframe crossfade is a property of
   * this scene rather than of any one ball. */
  const material = (
    panel.source
      ? toGlass(panel.source)
      : new THREE.MeshStandardMaterial({
          color: panel.kind === 'pent' ? '#08090c' : '#eef1f4',
          roughness: panel.kind === 'pent' ? 0.42 : 0.36,
          metalness: panel.kind === 'pent' ? 0.1 : 0.05,
          transparent: true,
        })
  ) as PanelMaterial;
  material.side = THREE.DoubleSide;

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
        /* A narrow band, measured as a fraction of the panel's own half-width.
         * 0.16 was right for a hexagon; on a quarter-shell it is a sixth of a
         * very large piece and the glow washed most of the printed surface. */
        float outline = 1.0 - smoothstep(0.0, 0.05, vEdge);
        float wire = max(outline, meshFactor() * 0.26);
        vec3 neon = uNeon * (0.45 + outline * 1.25);

        /* The neon goes on the seams, not over the surface. On the flat
         * black-and-white ball this was a full crossfade to a glowing cage,
         * which was the whole point of it; with a textured ball the surface is
         * the point, and washing a printed Trionda panel to cyan threw away the
         * thing worth looking at. So the mix is weighted to the outline and the
         * interior keeps most of itself. */
        gl_FragColor.rgb = mix(gl_FragColor.rgb, neon, uProgress * mix(wire * 0.35, outline, 0.75));
        /* No alpha work. The glass path is drawn opaque -- see toGlass -- and
         * the see-through is transmission rather than blending. */`,
      );
  };

  return material;
}
