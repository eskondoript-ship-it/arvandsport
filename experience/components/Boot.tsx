'use client';

import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { asset, scrollState } from '@/lib/scroll';
import { sceneState } from '@/lib/choreography';

/**
 * The boot that strikes the ball.
 *
 * Beat two had a ball that compressed and left on an arc with nothing visible
 * doing it to it. This is the thing doing it: a real boot, swung in from below
 * left, meeting the ball at the moment of contact and following through.
 *
 * ## Why the swing is driven by two different numbers
 *
 * `struck` runs one way across the contact window and `contact` peaks in the
 * middle of it. The boot's travel is on `struck`, because a swing goes one way;
 * its lift and roll are on `contact`, because a follow-through rises and falls.
 * Driving both off one of them gave either a boot that slid in a straight line
 * or one that arrived and reversed.
 *
 * ## What it is
 *
 * A photogrammetry scan -- two hundred thousand triangles and a four-thousand
 * pixel atlas as supplied, which is what a scanner writes rather than what a
 * web page needs. tools/convert-model.mjs decimates it and re-encodes the
 * texture; see the scene-assets skill for the command. It keeps its own
 * material, unlike the stadium: the whole value of a scan is the photograph
 * baked into it, and flattening that to grey would leave a lump.
 *
 * Like the stadium, it is mounted only when the scroll is within reach of its
 * beat, so the file is not part of what the hero costs to arrive.
 */

const MODEL_URL = '/models/boot.glb';

export default function Boot() {
  const root = useRef<THREE.Group>(null);
  const gltf = useGLTF(asset(MODEL_URL), true) as unknown as { scene: THREE.Object3D };

  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      /* The scan's own material comes back rough and flat. The scene is lit
       * hard and everything else in it has some specular, so a boot with none
       * reads as a cardboard cut-out of a boot. */
      if (material) {
        material.roughness = 0.62;
        material.metalness = 0.05;
      }
    });
    return clone;
  }, [gltf]);

  useFrame(() => {
    if (!root.current) return;
    const a = sceneState(scrollState.progress);

    /* Present only across the strike. Gone before and after -- not merely
     * transparent, which still sorts and still costs a pass over the mesh. */
    const alive = a.struck > 0.001 && a.struck < 0.999;
    root.current.visible = alive;
    if (!alive) return;

    const swing = a.struck;
    const follow = a.contact;

    /* In from below left, through where the ball is, and out past it.
     *
     * The one number that matters is where the boot is when `contact` peaks,
     * because that is the frame the ball compresses in. `contact` peaks in the
     * middle of its own window and `struck` runs across a slightly longer one,
     * so the peak lands at struck 0.33 -- not 0.5, which is the trap. The boot
     * is a unit and a bit long about its own centre, so its centre wants to be
     * about -1.1 out when its toe is at the origin.
     *
     * The first pass had the boot arriving at the ball's position at struck
     * 0.5, by which point the ball had already been struck and left: a boot
     * swinging through empty space in the bottom left while the ball flew out
     * of the top right.
     *
     * It swings out of the screen towards the viewer as well as across, because
     * that is where it sends the ball. Coming from behind the ball in z is also
     * what puts the boot between the camera and nothing -- swung the other way
     * it would arrive in front of the ball and hide the contact it is making. */
    root.current.position.set(
      -2.2 + swing * 4.2,
      -1.7 + swing * 1.8 + follow * 0.25,
      -1.9 + swing * 3.4,
    );

    /* Toe leading on the way in, rolling over through contact, and turning to
     * follow the ball out towards the viewer. */
    root.current.rotation.set(
      -0.25 + follow * 0.5,
      -1.5 + swing * 1.6,
      -0.5 + swing * 0.8,
    );

    /* The converter normalises every model to a unit radius, so at scale 1 the
     * boot's longest dimension is two units -- the same as the ball's diameter.
     * A boot is about 28cm against a ball's 22, so 1.15 is life size next to
     * it. */
    root.current.scale.setScalar(1.15);
  });

  return (
    <group ref={root} name="boot" visible={false}>
      <primitive object={model} />
    </group>
  );
}

/* No useGLTF.preload(), for the reason the stadium has none: it would run when
 * the bundle is evaluated and fetch the boot for every visitor before the ball
 * itself had arrived. */
