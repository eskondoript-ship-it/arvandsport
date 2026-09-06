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

    /* Read once at the top: the ball's flight needs it as much as the camera
     * does, and the ball is positioned first. */
    const aspect = state.size.width / Math.max(1, state.size.height);
    const portrait = aspect < 1;

    /* --- the ball itself --- */
    if (ball.current) {
      /* An idle drift under the scrubbed rotation, so it is never dead still.
       * Slow on purpose: this one runs on its own clock rather than on the
       * scroll, so it is the only rotation a visitor who is not moving can
       * see, and at 0.12 rad/s the ball read as spinning by itself. 0.07 is
       * about a revolution and a half a minute -- movement you notice on
       * second glance rather than motion. */
      ball.current.rotation.y = a.spin * Math.PI * 1.6 + a.kick * Math.PI * 5 + t * 0.07;
      ball.current.rotation.x = a.kick * Math.PI * 1.4 - 0.12;
      ball.current.rotation.z = a.kick * 0.5;

      /* The strike: a compression at contact, then an arc away and up.
       *
       * `contact` is its own windowed pulse now rather than a slice off the
       * front of the flight -- it is already nought at both ends, so the squash
       * needs no envelope of its own, and it is deep enough (0.24) to be seen
       * at the size the ball is by then. */
      const contact = a.contact;
      const flight = a.kick;
      const squash = 1 - contact * 0.24;
      ball.current.scale.set(1 / squash, squash, 1 / squash);

      /* The flight carries it away, and the descent brings it back to the
       * middle: the camera is chasing it down into the bowl, and a chase ends
       * with the thing being chased in the middle of the frame rather than
       * still leaving it. Damped by `arrive` and then by `globe`, so by the
       * time the sphere is forming the ball is back at the origin it forms
       * around. */
      const settle = (1 - a.arrive * 0.85) * (1 - a.globe);
      /* Struck at the viewer, almost straight down the camera axis.
       *
       * That is what a ball hit towards you does: it does not swing across the
       * frame on its way, it grows. The sideways drift is a tenth of what it
       * was and the arc a third of it -- what little is left keeps the ball off
       * dead centre, which is the difference between a ball arriving and a
       * texture being scaled up.
       *
       * How far it comes is not the same number on a phone. A portrait frame is
       * narrow and the camera is already close, so the desktop approach put a
       * unit ball across ninety percent of the screen: it stopped reading as a
       * ball coming at you and started reading as the scene being replaced by
       * glass. Neither number reaches the lens -- the next beat has to start
       * from something other than a wall of glass. */
      const toward = portrait ? 1.3 : 2.3;
      ball.current.position.set(
        (flight * 0.12 - contact * 0.3) * settle,
        Math.sin(flight * Math.PI * 0.7) * 0.35 * settle,
        flight * toward * settle,
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

    /* The panels draw themselves back in and go as the globe forms -- the ball
     * is not replaced by the globe so much as it becomes one, and two spheres
     * overlapping for a beat would give that away. Scaled rather than faded:
     * the panel material is a shader with its own alpha and reaching into it
     * from here would put the crossfade in two places. */
    if (ball.current) {
      /* Cubed, so the ball holds its size while the globe is still faint and
       * then goes quickly once the sphere is legible. Linear left a shrinking
       * ball sitting beside a growing globe for most of the beat, which read
       * as two objects rather than one becoming the other. */
      if (a.globe > 0) ball.current.scale.multiplyScalar((1 - a.globe) ** 3);
      ball.current.visible = a.globe < 0.92;
    }

    /* --- impact ring, alive only across the moment of contact ---
     * Windowed on a rising kick rather than on distance from a midpoint: the
     * ring has to be absent at rest, and |kick - 0.1| is 0.1 when kick is 0,
     * which is well inside the window and left it hanging in frame on the
     * opening chapter. */
    if (shock.current) {
      /* Expanding and fading on one ramp. `struck` runs nought to one across
       * the contact window and stays at one after, so the ring is alive only
       * while that ramp is in flight -- it cannot hang around on the opening
       * chapter, which is what the old windowing on `kick` was written
       * carefully to avoid. */
      const life = a.struck;
      shock.current.visible = life > 0.001 && life < 0.999;
      // Billboarded. Lying flat it reads as a wide ellipse cutting across the
      // whole frame rather than as a ring coming off the contact.
      shock.current.quaternion.copy(camera.quaternion);
      if (ball.current) shock.current.position.copy(ball.current.position);
      shock.current.scale.setScalar(0.5 + life * 3.4);
      const ringMaterial = shock.current.material as THREE.MeshBasicMaterial;
      /* Squared, so it is a flash that goes rather than a hoop that dims. */
      ringMaterial.opacity = (1 - life) ** 2 * 0.85;
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
    /* The descent pulls back as well as down: the bowl is three and a half
       units across and has to fit the frame whole, which at this field of view
       needs about eight units of distance. */
    range += a.arrive * 3.4;
    /* And the camera gives a little ground as the ball comes at it, so the gap
       closes but never to nothing. Less than the ball travels, or the approach
       would cancel itself out and the strike would read as the ball standing
       still while the world moved. */
    range += a.kick * (portrait ? 0.45 : 0.8);
    /* The globe gathers at about the ball's own size, so the camera comes back
       in from wherever the descent and the exploded diagram had pushed it. */
    range -= a.globe * 3.2;

    /* A perspective camera's field of view is vertical, so a portrait viewport
     * keeps all of the height and loses the width: the ball is comfortably
     * framed on a laptop and overflowing both edges of a phone without a single
     * number changing.
     *
     * Scaling the desktop distance by how far the aspect has fallen short is
     * the obvious correction and it is the wrong one. It preserves the ball's
     * size relative to the *width*, and on desktop the ball is about a third of
     * a wide frame -- so a phone was handed a speck in the middle of a tall
     * one. Capping the scale stopped it being a speck and left it arbitrary.
     *
     * Portrait is framed from the geometry instead: the distance at which the
     * content spans FILL of the narrow axis, used when it is further out than
     * the chapter already asked for. The content is a unit ball until the shell
     * opens and then grows by exactly how far the panels travel, so the
     * exploded diagram frames itself rather than needing a second number kept
     * in step with EXPLODE_DISTANCE. */
    if (portrait) {
      const FILL = 0.78;
      const contentRadius = (1 + a.explode * EXPLODE_DISTANCE) * (1 - a.globe * 0.45);
      const halfFov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2);
      range = Math.max(range, contentRadius / (Math.tan(halfFov) * aspect * FILL));
    } else {
      range *= THREE.MathUtils.clamp(1.5 / aspect, 1, 2.1);
    }

    const orbit = a.detail * 0.8;
    /* Height is the whole of beat three. The camera starts level with the ball,
     * drops below it as the strike carries it away and the bowl comes up, and
     * ends up looking along the pitch from inside the stand -- which is what
     * "follows it into the stadium" has to mean if the stadium is a real object
     * sitting at y -2.6 rather than a backdrop.
     *
     * It climbs back out for the globe: a globe read from below is a globe seen
     * from underneath, and the point of that beat is the whole sphere. */
    const height =
      0.25 +
      a.detail * 0.3 -
      a.kick * 0.15 -
      a.arrive * 1.2 +
      a.globe * 1.1;

    tmp.set(
      Math.sin(orbit) * range,
      height,
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
     * Portrait has no room for a column at all, so it keeps the opening
     * framing all the way through: the ball dead centre, with the chapters
     * reading over it. It was dropped below the copy instead, which on a phone
     * put it in the bottom third under the brand line rather than behind it. */
    const bias = portrait ? 0 : a.dolly * 0.85 - a.detail * 0.45;
    /* Aiming down into the bowl during the descent, and back level for the
       globe. Without this the camera drops but keeps looking at where the ball
       used to be, which reads as the floor rising rather than as a dive. */
    lookAt.set(
      a.kick * 0.55 - bias,
      /* Aimed lower through the strike on a phone, which rides the ball up the
         frame and off the copy. The copy sits across the middle of a portrait
         screen and the ball is struck straight through it; moving the aim is
         cheaper than moving the ball, and leaves the flight itself alone. */
      a.kick * 0.4 - a.arrive * 1.6 + a.globe * 1.5 - (portrait ? a.kick * 0.75 : 0),
      0,
    );
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
