'use client';

import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { scrollState } from '@/lib/scroll';
import { sceneState } from '@/lib/choreography';
import { NEON } from '@/lib/ball';

/**
 * The globe the ball becomes, and the point it collapses to.
 *
 * Two beats live here. The pieces of the opened ball gather back into a sphere
 * that lights from inside; then the sphere closes to nothing and the mark on
 * the page takes its place.
 *
 * ## Why it is a graticule and not a photograph of Earth
 *
 * A textured Earth would need an Earth texture: a megabyte of map, on a page
 * that has already been made to account for every asset it carries, to say
 * something the agency's own figure says better. A wire globe with a point at
 * each of the countries it works in is the same idea drawn in the language the
 * rest of the page is drawn in, and it costs geometry the GPU builds in a
 * millisecond.
 *
 * ## Why the points are placed the way they are
 *
 * Forty-six, because that is the number in content/site.json stats -- the
 * countries the agency has placed players in. They are **not** real capitals.
 * Putting forty-six real cities on a globe would be a claim about which
 * countries those are, and this repo does not invent facts about anything;
 * scattered evenly, they are what they look like, which is a count.
 *
 * The scatter is a Fibonacci sphere, so the points are evenly spread rather
 * than clumped at the poles the way two random angles would leave them. It is
 * deterministic: the same points every load, no seed to carry, nothing to
 * disagree about between two renders of the same page.
 */

/** Countries the agency has placed players in. Matches content/site.json. */
const POINT_COUNT = 46;

/** How many arcs are drawn between them. Enough to read as traffic. */
const ARC_COUNT = 18;

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Evenly spread points on a unit sphere, by the Fibonacci method. */
function spherePoints(count: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    /* y walks from near the north pole to near the south, and the angle turns
       by the golden angle each step -- which is what stops the points landing
       in visible rows the way a regular step would. */
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN * i;
    out.push(new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius));
  }
  return out;
}

/**
 * A great-circle-ish arc between two points on the sphere, bowed outward.
 *
 * Slerp gives the path along the surface; lifting the middle of it off the
 * surface is what makes it read as a route between two places rather than a
 * line drawn on a ball.
 */
function arcBetween(from: THREE.Vector3, to: THREE.Vector3, segments = 32): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const angle = from.angleTo(to);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = new THREE.Vector3()
      .copy(from)
      .multiplyScalar(Math.sin((1 - t) * angle) / Math.sin(angle))
      .addScaledVector(to, Math.sin(t * angle) / Math.sin(angle));
    /* A sine bow, so both ends sit on the surface and the middle stands off it
       by an amount that grows with how far apart the two points are. */
    point.multiplyScalar(1 + Math.sin(t * Math.PI) * 0.13 * (angle / Math.PI));
    points.push(point);
  }
  return points;
}

export default function Globe() {
  const root = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Mesh>(null);

  const points = useMemo(() => spherePoints(POINT_COUNT), []);

  /* The graticule: latitude rings and meridians as one line geometry, rather
     than a sphere mesh drawn as a wireframe. A wireframe sphere draws the
     triangulation -- every quad crossed by a diagonal -- and a globe has no
     diagonals on it. */
  const graticule = useMemo(() => {
    const vertices: number[] = [];
    const push = (a: THREE.Vector3, b: THREE.Vector3) =>
      vertices.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const at = (lat: number, lon: number) =>
      new THREE.Vector3(
        Math.cos(lat) * Math.cos(lon),
        Math.sin(lat),
        Math.cos(lat) * Math.sin(lon),
      );

    for (let ring = 1; ring < 9; ring++) {
      const lat = -Math.PI / 2 + (ring / 9) * Math.PI;
      for (let i = 0; i < 64; i++) {
        push(at(lat, (i / 64) * Math.PI * 2), at(lat, ((i + 1) / 64) * Math.PI * 2));
      }
    }
    for (let meridian = 0; meridian < 12; meridian++) {
      const lon = (meridian / 12) * Math.PI * 2;
      for (let i = 0; i < 32; i++) {
        push(
          at(-Math.PI / 2 + (i / 32) * Math.PI, lon),
          at(-Math.PI / 2 + ((i + 1) / 32) * Math.PI, lon),
        );
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return geometry;
  }, []);

  /* The routes, as one geometry. Pairs chosen by a fixed stride rather than at
     random, so the same arcs are drawn every time. */
  const arcs = useMemo(() => {
    const vertices: number[] = [];
    for (let i = 0; i < ARC_COUNT; i++) {
      const from = points[(i * 7) % points.length];
      const to = points[(i * 13 + 5) % points.length];
      const path = arcBetween(from, to);
      for (let s = 0; s < path.length - 1; s++) {
        vertices.push(path[s].x, path[s].y, path[s].z, path[s + 1].x, path[s + 1].y, path[s + 1].z);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return geometry;
  }, [points]);

  const nodes = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(points.flatMap((p) => [p.x, p.y, p.z]), 3),
    );
    return geometry;
  }, [points]);

  const gridMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: NEON, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }),
    [],
  );
  const arcMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: new THREE.Color('#ffffff'), transparent: true, opacity: 0, toneMapped: false, depthWrite: false }),
    [],
  );
  const nodeMaterial = useMemo(
    () => new THREE.PointsMaterial({ color: new THREE.Color('#dff7ff'), size: 0.055, transparent: true, opacity: 0, toneMapped: false, depthWrite: false, sizeAttenuation: true }),
    [],
  );
  /* The light inside. A back-facing sphere just under the graticule, so the
     glow reads as coming from within the globe rather than sitting in front of
     it -- which is what an additive sphere drawn front-first looks like. */
  const coreMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#0d5f86'),
        transparent: true,
        opacity: 0,
        side: THREE.BackSide,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  useLayoutEffect(
    () => () => {
      graticule.dispose();
      arcs.dispose();
      nodes.dispose();
      gridMaterial.dispose();
      arcMaterial.dispose();
      nodeMaterial.dispose();
      coreMaterial.dispose();
    },
    [graticule, arcs, nodes, gridMaterial, arcMaterial, nodeMaterial, coreMaterial],
  );

  useFrame((state) => {
    if (!root.current) return;
    const a = sceneState(scrollState.progress);
    const t = state.clock.elapsedTime;

    /* Present only across its own two beats, and gone -- not merely
       transparent -- either side of them. A transparent object still sorts,
       still draws, and still costs a pass over its geometry. */
    const alive = a.globe > 0.001 && a.collapse < 0.999;
    root.current.visible = alive;
    if (!alive) return;

    /* Gathers in at the size the ball was, then closes to nothing. The
       collapse is cubed rather than linear so it holds its size and then goes
       quickly, which is what "collapses" means; eased evenly it just shrinks. */
    const shrink = 1 - a.collapse ** 3;
    root.current.scale.setScalar((0.55 + a.globe * 0.55) * shrink);
    root.current.rotation.y = t * 0.09 + (1 - a.globe) * 0.9;
    /* Tilted like a globe on a stand rather than spinning on a vertical pole. */
    root.current.rotation.z = 0.41;

    const fade = a.globe * (1 - a.collapse);
    gridMaterial.opacity = 0.5 * fade;
    /* The routes arrive after the sphere has: the graticule is the object, and
       the traffic on it is the point being made. */
    arcMaterial.opacity = 0.75 * Math.max(0, (a.globe - 0.35) / 0.65) * (1 - a.collapse);
    nodeMaterial.opacity = 0.95 * Math.max(0, (a.globe - 0.2) / 0.8) * (1 - a.collapse);
    /* Flares as it closes -- the light is the last thing left when the geometry
       has gone -- and then goes out. The flare alone left a lit sphere sitting
       under the wordmark for the whole of the final beat: it brightened with
       the collapse and nothing ever took it away. The fourth power holds the
       flare almost to the end and then drops it. */
    coreMaterial.opacity = (0.1 + a.collapse * 0.5) * a.globe * (1 - a.collapse ** 4);

    if (inner.current) inner.current.scale.setScalar(0.985);
  });

  return (
    <group ref={root} name="globe" visible={false}>
      <mesh ref={inner} material={coreMaterial}>
        <sphereGeometry args={[1, 32, 24]} />
      </mesh>
      <lineSegments geometry={graticule} material={gridMaterial} />
      <lineSegments geometry={arcs} material={arcMaterial} />
      <points geometry={nodes} material={nodeMaterial} />
    </group>
  );
}
