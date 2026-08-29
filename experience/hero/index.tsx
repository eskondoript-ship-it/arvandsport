/**
 * The homepage hero's ball, as a React Three Fiber island.
 *
 * The site this mounts into is a static generator with no npm dependencies and
 * no React. So this is not a page — it is a bundle with one function in it,
 * built by scripts/build-hero.mjs and dropped into the site's assets. The host
 * page loads it only when it has decided it wants it, calls mount(), and talks
 * to it through the handle that comes back.
 *
 * What it deliberately does NOT own:
 *
 *   - Position, scale and the kick. Those stay CSS transforms on the element
 *     around the canvas, driven by the site's existing GSAP timeline. Moving
 *     them in here would mean reimplementing choreography that already works,
 *     and would take the sprite fallback out of step with the 3D.
 *   - Scroll. The host reads it and pushes a rotation in.
 *
 * All it owns is the ball turning, and the light on it. One number in, through
 * setSpin: turns, where 1 is a full revolution — the same unit the sprite path
 * uses, so the two are interchangeable behind one seam in apex.js.
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { createRoot, type Root } from 'react-dom/client';
import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

import { buildProceduralPanels, makePanelMaterial, panelsFromGltf, type Panel } from '../lib/ball';

export type HeroHandle = {
  /** Turns, where 1 is one full revolution. Matches the sprite's unit. */
  setSpin: (turns: number) => void;
  /** Resolves once the ball is actually on screen, so the host can swap. */
  ready: Promise<void>;
  dispose: () => void;
};

/* The host owns the transform on the wrapping element, so the canvas simply
 * fills it. Rotation is read from a mutable object every frame rather than
 * being pushed through React — the host sets it from a scrub, and a state
 * update per frame would be the one thing that made this slower than the
 * sprite it replaces. */
const spin = { turns: 0 };

function Ball({ panels, onReady }: { panels: Panel[]; onReady: () => void }) {
  const group = useRef<THREE.Group>(null);
  const materials = useMemo(() => panels.map((p) => makePanelMaterial(p.kind)), [panels]);
  const announced = useRef(false);

  useEffect(() => {
    return () => materials.forEach((m) => m.dispose());
  }, [materials]);

  useFrame(() => {
    if (!group.current) return;
    group.current.rotation.y = spin.turns * Math.PI * 2;
    group.current.rotation.x = -0.14;
    if (!announced.current) {
      announced.current = true;
      onReady();
    }
  });

  return (
    <group ref={group}>
      {panels.map((panel, i) => (
        <mesh key={panel.name} geometry={panel.geometry} material={materials[i]} />
      ))}
    </group>
  );
}

function Scene({ panels, onReady }: { panels: Panel[]; onReady: () => void }) {
  return (
    <>
      <ambientLight intensity={0.42} />
      <directionalLight position={[4.5, 6, 5]} intensity={2.2} />
      <directionalLight position={[-6, -1.5, -3]} intensity={0.9} color="#7fb6ff" />
      {/* Built in-scene rather than fetched. An HDRI off a CDN would be a
          third-party request in the critical path of the homepage. */}
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={1.5} position={[0, 4, 2]} scale={[8, 3, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.2} position={[-5, 0, 1]} scale={[3, 6, 1]} color="#5aa9ff" />
        <Lightformer form="circle" intensity={1.2} position={[0, -4, 3]} scale={4} color="#20304a" />
      </Environment>
      <Ball panels={panels} onReady={onReady} />
    </>
  );
}

function Hero({ modelUrl, onReady }: { modelUrl: string; onReady: () => void }) {
  const [panels, setPanels] = useState<Panel[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    new GLTFLoader().load(
      modelUrl,
      (gltf) => {
        if (cancelled) return;
        const fromFile = panelsFromGltf(gltf.scene);
        setPanels(fromFile.length ? fromFile : buildProceduralPanels());
      },
      undefined,
      () => {
        /* The homepage must never be missing its ball because one file did not
         * arrive. The procedural build is the same 32 panels from arithmetic. */
        if (!cancelled) setPanels(buildProceduralPanels());
      },
    );
    return () => {
      cancelled = true;
    };
  }, [modelUrl]);

  if (!panels) return null;

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 3.05], fov: 42 }}
      style={{ width: '100%', height: '100%' }}
    >
      <Scene panels={panels} onReady={onReady} />
    </Canvas>
  );
}

let root: Root | null = null;

/** Mount the ball into `container`. Returns the handle the host drives it with. */
export function mount(container: HTMLElement, options: { modelUrl: string }): HeroHandle {
  let settle: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    settle = resolve;
  });

  root = createRoot(container);
  root.render(
    <StrictMode>
      <Hero modelUrl={options.modelUrl} onReady={settle} />
    </StrictMode>,
  );

  return {
    setSpin: (turns: number) => {
      spin.turns = turns;
    },
    ready,
    dispose: () => {
      root?.unmount();
      root = null;
    },
  };
}
