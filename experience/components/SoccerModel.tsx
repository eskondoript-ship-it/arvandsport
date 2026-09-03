'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { asset, scrollState } from '@/lib/scroll';
import { EXPLODE_DISTANCE, sceneState } from '@/lib/choreography';
import {
  buildProceduralPanels,
  makePanelMaterial,
  NEON,
  panelsFromGltf,
  type Panel,
} from '@/lib/ball';

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

const MODEL_URL = '/models/soccer-ball.glb';

export type SoccerModelProps = {
  /** Force the procedural build. The error boundary in SoccerCanvas sets it. */
  procedural?: boolean;
  /** Panels the HUD wants to hang callouts off, by index. */
  onPanelsReady?: (panels: Panel[]) => void;
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

  const materials = useMemo(() => panels.map((panel) => makePanelMaterial(panel)), [panels]);

  useLayoutEffect(() => {
    onPanelsReady?.(panels);
  }, [panels, onPanelsReady]);

  useLayoutEffect(() => {
    return () => {
      panels.forEach((panel) => panel.geometry.dispose());
      materials.forEach((material) => material.dispose());
    };
  }, [panels, materials]);

  const tmp = useMemo(() => new THREE.Vector3(), []);
  const lookAt = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    /* Derived, not stored. Whoever is hosting the scene has already put the
     * page's progress in scrollState; this turns it into positions. */
    const a = sceneState(scrollState.progress);
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
      /* On the thirty-two panel ball the pentagons lead by a fraction so the
       * shell peels rather than bursting. A four-panel ball has no pentagons
       * and its quarters simply part. */
      const lead = panels[i].kind === 'pent' ? 1.12 : panels[i].kind === 'hex' ? 0.94 : 1;
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
     * approach pulls in, but the shell then opens to nearly four times its own
     * radius, so the explode has to push straight back out -- further than the
     * pieces travel -- or they leave the frame entirely and the scene stops
     * reading as a ball coming apart and starts reading as one that vanished.
     */
    let range = 6.4 - a.dolly * 2.1 + a.explode * 5.4 - a.detail * 1.1;

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

    /* The opening chapter is the brand line with the ball in the gap between
     * ARVAND and SPORT, so it belongs dead centre and the bias starts at zero.
     * A constant term here put it a third of a frame right of that, sitting in
     * the middle of the second word rather than between the two.
     *
     * From there the bias grows with the approach, because the story chapters
     * put their copy in a left column and the ball has to clear it; on the last
     * one it eases back towards centre, since the stat column arrives down the
     * right and a ball still pushed into that half sits under it.
     *
     * Portrait has no room for a column at all. The copy still sits at the
     * top there, so the ball drops below it instead -- aiming above the ball
     * pushes it down the frame. */
    const bias = portrait ? 0 : a.dolly * 0.85 - a.detail * 0.45;
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

/* Deliberately not useGLTF.preload() here. That runs when the module is
 * evaluated, which is before the homepage has had a chance to call
 * setAssetBase -- so the preload fetched the model from the wrong place, got a
 * 404, and the real load happened anyway a moment later. One request, made
 * once the component knows where things are. */
