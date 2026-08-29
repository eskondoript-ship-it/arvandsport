'use client';

import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Environment, Lightformer, Grid, AdaptiveDpr, Preload } from '@react-three/drei';
import { EffectComposer, SelectiveBloom, Selection, Select, Vignette } from '@react-three/postprocessing';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';

import SoccerModel from '@/components/SoccerModel';
import { buildProceduralPanels } from '@/lib/ball';
import { asset, scrollState } from '@/lib/scroll';
import { TAREMI } from '@/lib/taremi';

/* ------------------------------------------------------------------ *
 * GLB fallback
 * ------------------------------------------------------------------ */

/**
 * If the model cannot be fetched or parsed, fall back to the procedural
 * truncated icosahedron rather than dropping the whole scene.
 *
 * useGLTF throws a promise on suspend and a real error on failure, and only a
 * class component can catch the second. The alternative -- probing the URL with
 * fetch first -- costs a round trip on every load to guard against a case that
 * should never happen in production.
 */
class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[arvand] ball model unavailable, using the procedural build', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** The same 32 panels, no file, no shader extras -- just something on screen. */
function ProceduralBall() {
  const panels = useMemo(() => buildProceduralPanels(), []);
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.25;
  });
  return (
    <group ref={group}>
      {panels.map((panel) => (
        <mesh key={panel.name} geometry={panel.geometry}>
          <meshStandardMaterial
            color={panel.kind === 'pent' ? '#08090c' : '#eef1f4'}
            roughness={panel.kind === 'pent' ? 0.42 : 0.36}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * Taremi
 * ------------------------------------------------------------------ */

/**
 * Taremi himself, as a cut-out plane in the scene.
 *
 * This is his actual photograph from the site, standing in 3D space and lit by
 * the same rig as the ball -- not a modelled figure. There is no scanned mesh
 * of him, and inventing a body for a real, named client is not a thing this
 * repo does. A photograph that is genuinely him beats an approximation that is
 * not, and it costs 45KB instead of several megabytes.
 *
 * He sweeps in from the left across the strike, arriving as the ball leaves.
 */
function Taremi() {
  const mesh = useRef<THREE.Mesh>(null);
  const texture = useLoader(THREE.TextureLoader, asset(TAREMI.portrait));

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
  }, [texture]);

  // 529 x 760 in the source; keep the aspect or he stretches.
  const height = 3.2;
  const width = height * (529 / 760);

  useFrame((state) => {
    if (!mesh.current) return;
    const p = scrollState.progress;
    // Nothing until the strike is close, then a fast entry and a slow settle.
    const entry = THREE.MathUtils.clamp((p - 0.26) / 0.16, 0, 1);
    const settle = THREE.MathUtils.clamp((p - 0.66) / 0.2, 0, 1);
    const eased = 1 - Math.pow(1 - entry, 3);

    mesh.current.position.set(
      THREE.MathUtils.lerp(-6.6, -3.0, eased) - settle * 0.25,
      -1.45 + Math.sin(state.clock.elapsedTime * 0.6) * 0.03,
      THREE.MathUtils.lerp(-2.4, -1.0, eased) + settle * 0.35,
    );
    mesh.current.rotation.y = THREE.MathUtils.lerp(0.55, 0.22, eased) - settle * 0.14;

    const material = mesh.current.material as THREE.MeshBasicMaterial;
    material.opacity = entry * 0.98;
    mesh.current.visible = entry > 0.005;
  });

  return (
    <mesh ref={mesh} visible={false}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ *
 * The owner
 * ------------------------------------------------------------------ */

/**
 * The agency's founder, standing on the grid.
 *
 * His mesh is the client's own -- a Tripo scan, decimated from 192,296
 * triangles to 19,512 by tools/decimate-glb.py, which is what makes a
 * 4.6MB figure a 456KB one. He is here from the opening and steps back as
 * Taremi arrives, so the scene starts with a person on a field rather than an
 * object in a void.
 *
 * He is untextured for now, and deliberately so. The mesh has no UVs at all,
 * so there is nothing for a photograph to be applied to yet; a front
 * projection can give him his own face once the source image is to hand. Until
 * then he is a matte figure lit by the scene, which is honest about being a
 * form rather than a likeness.
 */
function Owner() {
  const holder = useRef<THREE.Group>(null);
  const [figure, setFigure] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    let cancelled = false;
    new GLTFLoader().load(
      asset('/models/owner.glb'),
      (gltf) => {
        if (cancelled) return;
        gltf.scene.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.material = new THREE.MeshStandardMaterial({
            color: '#8e9bab',
            roughness: 0.72,
            metalness: 0.08,
          });
        });
        setFigure(gltf.scene);
      },
      undefined,
      () => {
        /* No figure is better than a broken one; the scene stands without him. */
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useFrame(() => {
    if (!holder.current) return;
    const p = scrollState.progress;
    /* Present from the start, and out of the way by the time the third chapter
     * brings Taremi into the same corner of the frame. */
    const leave = THREE.MathUtils.clamp((p - 0.58) / 0.18, 0, 1);
    holder.current.visible = leave < 0.999;
    holder.current.position.set(-3.15 - leave * 1.6, -2.1, -1.5 - leave * 1.2);
    holder.current.rotation.y = 0.42;
    holder.current.scale.setScalar(3.1);
  });

  if (!figure) return null;
  return (
    <group ref={holder}>
      <primitive object={figure} />
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * Canvas
 * ------------------------------------------------------------------ */

export type SoccerCanvasProps = {
  /** Fires once the ball's panels exist and the scene has something to draw. */
  onReady?: () => void;
};

export default function SoccerCanvas({ onReady }: SoccerCanvasProps = {}) {
  const keyLight = useRef<THREE.DirectionalLight>(null);
  const fillLight = useRef<THREE.DirectionalLight>(null);
  const [lightsReady, setLightsReady] = useState(false);

  return (
    <Canvas
      /* Fixed behind the copy, so it must never eat the scroll. */
      className="!pointer-events-none"
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      camera={{ position: [0, 0.25, 6.4], fov: 42, near: 0.1, far: 60 }}
      onCreated={() => setLightsReady(true)}
    >
      {/* Key and fill, plus an environment built in-scene rather than fetched.
          drei's HDRI presets pull a file off a CDN at runtime, which a static
          export sitting on Pages should not depend on; lightformers give the
          same soft studio reflections out of geometry that ships with the JS. */}
      <ambientLight intensity={0.35} />
      <directionalLight ref={keyLight} position={[4.5, 6, 5]} intensity={2.1} color="#ffffff" />
      <directionalLight ref={fillLight} position={[-6, -1.5, -3]} intensity={1.1} color="#7fb6ff" />

      <Environment resolution={256}>
        <Lightformer form="rect" intensity={1.5} position={[0, 4, 2]} scale={[8, 3, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.4} position={[-5, 0, 1]} scale={[3, 6, 1]} color="#5aa9ff" />
        <Lightformer form="rect" intensity={1.1} position={[5, -1, -2]} scale={[3, 6, 1]} color="#ff7a45" />
        <Lightformer form="circle" intensity={1.6} position={[0, -4, 3]} scale={4} color="#20304a" />
      </Environment>

      {/* Tactical floor, well under the ball and fading out before the edge of
          frame so it reads as a grid rather than as a plane with a border. */}
      <Grid
        position={[0, -2.1, 0]}
        args={[40, 40]}
        cellSize={0.6}
        cellThickness={0.5}
        cellColor="#1b2733"
        sectionSize={3}
        sectionThickness={0.9}
        sectionColor="#2b4457"
        fadeDistance={26}
        fadeStrength={1.4}
        infiniteGrid
      />

      <Suspense fallback={null}>
        <Taremi />
      </Suspense>
      <Owner />

      <Selection>
        {/* autoClear off: the composer draws over the transparent canvas rather
            than wiping the alpha the page background shows through. */}
        <EffectComposer autoClear={false} multisampling={4}>
          <SelectiveBloom
            lights={lightsReady ? [keyLight, fillLight] : []}
            luminanceThreshold={0.72}
            luminanceSmoothing={0.22}
            intensity={1.15}
            mipmapBlur
          />
          <Vignette offset={0.24} darkness={0.72} />
        </EffectComposer>

        {/* Two filters, deliberately. The selection decides which objects may
            bloom at all -- the ball and its impact ring, never the grid or the
            photograph -- and the luminance threshold decides what within them
            is bright enough, which is how the shaded white panels stay matte
            while the neon edges flare. */}
        <Select enabled>
          <ModelBoundary fallback={<ProceduralBall />}>
            <Suspense fallback={<ProceduralBall />}>
              <SoccerModel onPanelsReady={onReady && (() => onReady())} />
            </Suspense>
          </ModelBoundary>
        </Select>
      </Selection>

      <AdaptiveDpr pixelated={false} />
      <Preload all />
    </Canvas>
  );
}
