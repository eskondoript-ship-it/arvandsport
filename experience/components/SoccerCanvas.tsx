'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Environment, Lightformer, Grid, AdaptiveDpr, Preload } from '@react-three/drei';
import { EffectComposer, SelectiveBloom, Selection, Select, Vignette } from '@react-three/postprocessing';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';

import SoccerModel from '@/components/SoccerModel';
import { buildProceduralPanels } from '@/lib/ball';
import { asset, scrollState } from '@/lib/scroll';

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
 * The owner
 * ------------------------------------------------------------------ */

/**
 * The agency's founder, standing on the grid.
 *
 * His mesh is the client's own -- a Tripo scan, decimated from 192,296
 * triangles to 19,512 by tools/decimate-glb.py, which is what makes a
 * 4.6MB figure a 456KB one. He is here from the opening and walks in for the
 * last chapter, which is the agency's -- so the scene starts with a person on a
 * field rather than an object in a void, and ends on the person whose agency it
 * is.
 *
 * He is matte grey until his photograph is baked in. The Tripo mesh has no UVs
 * at all, so there is no coordinate for an image to be read at;
 * tools/project-texture.py makes them by projecting the photograph along +z,
 * which is the direction the scan faces, and writes the picture into the file.
 * The moment a model with a base colour map is dropped in, this uses it.
 *
 * The projection is front-on, so he should not be turned far from that axis --
 * the texture smears on anything facing away from where the camera was.
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
          const existing = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as
            | THREE.MeshStandardMaterial
            | undefined;
          /* Once tools/project-texture.py has given him his own photograph, the
           * file arrives with a base colour map and that is the whole point of
           * it -- so it is kept, and only the finish is nudged to sit in this
           * scene's light. Without one he falls back to matte grey, which is
           * honest about being a form rather than a likeness. */
          if (existing?.map) {
            existing.roughness = 0.82;
            existing.metalness = 0.02;
            existing.envMapIntensity = 0.8;
            /* The photograph was taken in daylight and already carries its own
             * light; this scene is a dark room with one key off to the right,
             * which shades a daylight photograph down to a silhouette. Feeding
             * the same map back as emission restores roughly the exposure it
             * was taken at, and the scene's shading still plays over the top. */
            existing.emissiveMap = existing.map;
            existing.emissive = new THREE.Color('#ffffff');
            existing.emissiveIntensity = 0.42;
            return;
          }
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
    /* He is the last chapter's subject, so he stays for all of it and comes
     * forward as it arrives -- closer, squarer to the camera, clear of the
     * opened ball. Earlier he stepped aside at this point, which was right
     * when the chapter belonged to a player and is not any more. */
    const near = THREE.MathUtils.clamp((p - 0.66) / 0.24, 0, 1);
    const eased = 1 - Math.pow(1 - near, 3);
    holder.current.visible = true;
    /* He starts well left and well back -- far enough that he is not standing
     * behind the first chapter's copy, which is where he was and which made
     * both of them harder to read. */
    holder.current.position.set(
      THREE.MathUtils.lerp(-4.3, -2.35, eased),
      -2.1,
      THREE.MathUtils.lerp(-2.8, 0.6, eased),
    );
    /* Nearly square to the camera throughout. The photograph is projected
     * front-on, so every degree he turns is a degree of it stretching along
     * a surface it was never taken of -- the vertex shading baked in by
     * tools/project-texture.py darkens that rather than hiding it, and the
     * cheapest way to have less of it is to turn him less. */
    holder.current.rotation.y = THREE.MathUtils.lerp(0.2, 0.05, eased);
    holder.current.scale.setScalar(3.1 + eased * 0.5);
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
