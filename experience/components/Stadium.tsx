'use client';

import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { asset, scrollState } from '@/lib/scroll';
import { sceneState } from '@/lib/choreography';
import { NEON } from '@/lib/ball';

/**
 * The bowl the ball is played in, drawn as a blueprint.
 *
 * It arrives with the last chapter -- the one about the record -- and it is the
 * only thing in the scene that is not the ball. Rising out of the floor as the
 * figures come in, turning slowly under them, it is what the grid was standing
 * in for: the grid says "somewhere technical", the stadium says which sport
 * this agency is in, without a word of copy having to.
 *
 * Wireframe rather than shaded, for two reasons and not only the obvious one.
 * It matches the instrument language the rest of the page is drawn in -- the
 * hero's own ball crosses to wireframe two chapters earlier -- and the model is
 * an untextured archive mesh whose materials named texture files that were
 * never in the archive. Shaded, it is a grey lump. As a wireframe it is a
 * drawing, and a drawing is what an untextured mesh actually is.
 *
 * ## What this costs, and why it is loaded the way it is
 *
 * 1316KB, 781KB over the wire, 95,682 triangles. That is more than the ball
 * and its textures put together, and the hero had just been made affordable on
 * phones. So it is not part of the hero's cost: this component is only mounted
 * once the scroll is within reach of the chapter that uses it, which means the
 * GLB is requested at that moment and not before. A visitor who never scrolls
 * past the ball never pays for it.
 *
 * Suspense above this handles the gap -- the stadium simply is not there until
 * it has arrived, which is the same thing it looks like before the chapter
 * starts anyway, so there is nothing to hide.
 */

const MODEL_URL = '/models/stadium.glb';

/** How far into the story the bowl starts loading, and starts rising. */
export const STADIUM_FROM = 0.62;

export default function Stadium() {
  const root = useRef<THREE.Group>(null);
  const gltf = useGLTF(asset(MODEL_URL), true) as unknown as { scene: THREE.Object3D };

  /* One material for the whole bowl, made once. The mesh has no normals -- the
   * converter drops them, because a basic material never reads one and they
   * were a third of the file -- so nothing here may ask for lighting. */
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: NEON,
        wireframe: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) mesh.material = material;
    });
    return clone;
  }, [gltf, material]);

  useLayoutEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    if (!root.current) return;
    const a = sceneState(scrollState.progress);
    const t = state.clock.elapsedTime;

    /* Its own eased entrance across the last chapter, rather than a straight
     * read of `detail`: the camera is already swinging round on that number,
     * and a bowl that rises at exactly the rate the camera turns reads as one
     * move rather than two. Squared, so it is slow to start and arrives. */
    const rise = a.detail * a.detail;

    /* Sized against the frame it is seen in rather than by eye.
     *
     * The last chapter parks the camera at about 8.6 units out on a 42 degree
     * vertical field, so half the frame height is 8.6 * tan(21) = 3.3 world
     * units and half its width, on a landscape window, about 5.3. The model
     * comes out of the converter at unit radius, so a scale of 3.4 makes the
     * bowl a little under two thirds of the frame across: wide enough to be
     * the place the ball is in, not so wide that it stops being an object and
     * becomes a background.
     *
     * A first pass had it at 4.6 and it overflowed both edges -- a stadium you
     * are standing inside rather than looking at; the second, at 3.15, ran off
     * the bottom of the frame. The camera sits at y 0.4 looking level, so with
     * a half-height of 3.3 everything has to live above y = -2.9. The bowl is
     * a sixth as tall as it is wide, which at this scale is 0.85 -- so its
     * centre belongs at about -2.15 and no lower.
     *
     * It stays a fixed world size as the camera moves, because that is what
     * being a real object means. Set behind the ball as well as below it, so
     * the ball never has to compete with the wireframe for the same pixels. */
    root.current.position.set(0, -2.15 + rise * 0.28, -2.0);
    root.current.scale.setScalar(2.55 + rise * 0.2);
    /* A slow turn on its own clock, in the same direction the ball drifts, so
     * the two do not read as separate objects on separate timers. */
    root.current.rotation.y = t * 0.035 + (1 - rise) * 0.35;
    /* Tipped a little as it settles, so the bowl is read from slightly above
     * rather than edge-on. */
    root.current.rotation.x = (1 - rise) * -0.14;

    /* Faint. It is a drawing behind the subject, not a light source: at 0.42
     * with tone mapping off the wireframe read as a wall of cyan and the ball
     * disappeared into it. 95,000 triangles of wireframe is a great many
     * overlapping lines, and they accumulate: the drawing looks far more solid
     * than any one line's alpha suggests. */
    material.opacity = rise * 0.13;
    root.current.visible = material.opacity > 0.004;
  });

  return (
    <group ref={root} name="stadium">
      <primitive object={model} />
    </group>
  );
}

/* No useGLTF.preload() -- for the same reason SoccerModel has none, and one
 * more. A preload at module scope would run when the bundle is evaluated,
 * which is the moment the hero mounts, and would fetch the whole bowl for
 * every visitor before the ball itself had finished arriving. The entire point
 * of this file is that it is paid for late. */
