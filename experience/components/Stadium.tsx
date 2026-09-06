'use client';

import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { asset, scrollState } from '@/lib/scroll';
import { sceneState } from '@/lib/choreography';
import { NEON } from '@/lib/ball';

/**
 * The stadium the ball is followed down into, building itself as it arrives.
 *
 * Beat three of the story: the camera chases the struck ball down out of the
 * dark, and the bowl comes up out of the ground to meet it -- floor first,
 * terraces, roof last.
 *
 * Drawn as a blueprint rather than shaded, for two reasons and not only the
 * obvious one. It matches the instrument language the rest of the page is drawn
 * in -- the hero's own ball crosses to wireframe partway through its story --
 * and the model is an untextured archive mesh whose materials named texture
 * files that were never in the archive. Shaded, it is a grey lump. As a
 * wireframe it is a drawing, and a drawing is what an untextured mesh is.
 *
 * ## The build
 *
 * A clipping plane, not an animation baked into the geometry.
 *
 * The plane faces down and rises through the model as the scroll runs, so
 * everything below it is drawn and everything above it is not: the bowl comes
 * up out of the ground, terrace by terrace, and the roof arrives last. That is
 * the shape of the object doing the work -- a stadium is built from the bottom
 * up, and clipping it at a height is the same operation as building it to that
 * height.
 *
 * The alternative was revealing triangles by index, which sounds equivalent and
 * is not: a 3ds file's triangle order is whatever its 2008 exporter happened to
 * emit, so the "build" would be a random scatter filling in. Height is a
 * property of the thing; index is a property of the file.
 *
 * A second, brighter copy of the model is drawn clipped to a thin slice at the
 * cut, which reads as the line the construction is happening on. It is the same
 * geometry with a second material, so it costs a draw call and no memory.
 *
 * Clipping needs `localClippingEnabled` on the renderer -- SoccerCanvas sets
 * it. Without that the planes are ignored and the stadium is simply there.
 *
 * ## What it costs
 *
 * 1316KB, 781KB over the wire, 95,682 triangles: more than the ball and its
 * textures together. It is not fetched with the scene -- SoccerCanvas mounts
 * this component only once the scroll is within reach of the beat that needs
 * it, and mounting is the fetch. A visitor who never scrolls past the strike
 * never pays for it.
 */

const MODEL_URL = '/models/stadium.glb';

/* The model comes out of tools/convert-model.mjs centred at unit radius, and
   the bowl is about a sixth as tall as it is wide -- so its own height runs
   roughly -0.17 to 0.17 around its centre. The sweep runs a little past both
   ends so the first frame is empty and the last is whole. */
const FLOOR = -0.2;
const ROOF = 0.2;

export default function Stadium() {
  const root = useRef<THREE.Group>(null);
  const gltf = useGLTF(asset(MODEL_URL), true) as unknown as { scene: THREE.Object3D };

  /* One plane, shared by both materials. Normal pointing down means "keep what
     is below me"; the constant is the height it sits at. */
  const cut = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), []);
  /* And its mirror, so the highlight material keeps only a slice: below the
     cut (the first plane) and above the cut less a hair (this one). */
  const cutBelow = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  const structure = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: NEON,
        wireframe: true,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        toneMapped: false,
        clippingPlanes: [cut],
      }),
    [cut],
  );

  /* The working line. Brighter, and clipped to the slice between the two
     planes, so it is only ever the few metres of structure at the top of the
     build. */
  const edge = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ffffff'),
        wireframe: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        toneMapped: false,
        clippingPlanes: [cut, cutBelow],
      }),
    [cut, cutBelow],
  );

  const built = useMemo(() => {
    const group = new THREE.Group();
    for (const material of [structure, edge]) {
      const copy = gltf.scene.clone(true);
      copy.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) mesh.material = material;
      });
      group.add(copy);
    }
    return group;
  }, [gltf, structure, edge]);

  useLayoutEffect(
    () => () => {
      structure.dispose();
      edge.dispose();
    },
    [structure, edge],
  );

  useFrame((state) => {
    if (!root.current) return;
    const a = sceneState(scrollState.progress);
    const t = state.clock.elapsedTime;

    /* Gone either side of its beats rather than transparent: an invisible
       object still sorts and still costs a pass over 95,000 triangles. It is
       built during `build`, stands through the tactical read, and goes as the
       globe gathers. */
    const present = a.build > 0.001 && a.globe < 0.85;
    root.current.visible = present;
    if (!present) return;

    const build = a.build;
    /* Once the ball starts coming apart above it, the bowl has done its job
       and steps back rather than competing for the frame. */
    const after = a.explode;

    /* Where the cut is now, in the model's own space -- and the model is
       scaled below, so this has to be scaled with it or the plane sweeps
       through in the wrong place entirely. */
    /* Sized to be seen whole, from above.
     *
     * Putting the camera inside the bowl was the obvious reading of "into the
     * stadium" and it looked like a cyan wall: an untextured wireframe stand
     * seen from the terrace is a grid, with nothing to say it is a stadium.
     * Seen from high up with the ball coming down into it, the bowl's shape is
     * the whole story, and the shape is what was recognisable in the model in
     * the first place.
     *
     * Radius 3.5, and the camera pulls back to about 7.8 units during the
     * descent -- a frame 9.6 wide, so the bowl sits comfortably inside it. */
    const scale = 3.5;
    const height = THREE.MathUtils.lerp(FLOOR, ROOF, build) * scale;
    cut.constant = height;
    /* The slice is a fixed fraction of the bowl's height rather than a fixed
       number of units, so it stays the same visual thickness whatever the
       model or the scale is. */
    cutBelow.constant = -(height - (ROOF - FLOOR) * scale * 0.045);

    root.current.scale.setScalar(scale);
    /* Sits below the ball, which is where the pitch would be. The camera dives
       towards this during `arrive`, so the bowl does not move to meet it. */
    root.current.position.set(0, -3.2, 0);
    root.current.rotation.y = t * 0.04 - 0.5;

    /* Fades up as the first courses go in, and back down as the globe takes
       over -- the stadium is the place the ball was played in, not the place
       the story ends. */
    const alive = Math.min(1, build / 0.12) * (1 - Math.max(0, (a.globe - 0.2) / 0.65));
    structure.opacity = 0.15 * alive;
    edge.opacity = 0.6 * alive * (1 - after * 0.85);

  });

  return (
    <group ref={root} name="stadium">
      <primitive object={built} />
    </group>
  );
}

/* No useGLTF.preload(). It would run when the bundle is evaluated -- the moment
 * the hero mounts -- and fetch the whole bowl for every visitor before the ball
 * itself had finished arriving. The entire point of this file is that it is
 * paid for late. */
