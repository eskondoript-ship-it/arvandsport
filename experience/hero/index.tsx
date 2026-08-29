/**
 * The homepage's opening story, as a React Three Fiber island.
 *
 * The site this mounts into is a static generator with no npm dependencies and
 * no React. So this is not a page — it is a bundle with one function in it,
 * built by scripts/build-hero.mjs and dropped into the site's assets. The host
 * page loads it only when it has decided it wants it, calls mount(), and talks
 * to it through the handle that comes back.
 *
 * Two chapters run over one fixed canvas:
 *
 *   01  the ball turns, between the two halves of the display line
 *   02  the shell opens along its seams and Taremi arrives with his figures
 *
 * What the island deliberately does NOT own:
 *
 *   - The copy. Every word in both chapters is in the page's own HTML, written
 *     by the site's templates and styled by its stylesheet. It is there for
 *     search engines and for anyone who never gets this bundle, and there is
 *     no second copy of it in here to fall out of step.
 *   - Chapter one's position, scale and kick. Those stay CSS transforms on the
 *     element around the canvas, driven by the site's existing GSAP timeline.
 *   - Scroll. The host reads it and pushes numbers in.
 *
 * Two numbers go in. setSpin takes turns, where 1 is a full revolution — the
 * same unit the sprite fallback uses, so the two are interchangeable behind one
 * seam in apex.js. setStory takes 0 to 1 across the second chapter.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { createRoot, type Root } from 'react-dom/client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

import { buildProceduralPanels, makePanelMaterial, panelsFromGltf, type Panel } from '../lib/ball';

export type HeroOptions = {
  /** The client's match ball, from tools/obj-to-glb.py. */
  modelUrl: string;
  /** Taremi's cut-out photograph. Always present; used until a mesh exists. */
  portraitUrl: string;
  /**
   * A scanned or modelled Taremi, if one is ever supplied. Absent by default:
   * see the note on TaremiFigure below for why nothing is invented here.
   */
  figureUrl?: string;
};

export type HeroHandle = {
  /** Turns, where 1 is one full revolution. Matches the sprite's unit. */
  setSpin: (turns: number) => void;
  /** 0 to 1 across the second chapter: the shell opens, Taremi arrives. */
  setStory: (progress: number) => void;
  /** Resolves once the ball is actually on screen, so the host can swap. */
  ready: Promise<void>;
  dispose: () => void;
};

/* Read every frame rather than pushed through React. The host sets these from
 * a scrub, and a state update per frame would be the one thing that made this
 * slower than the sprite it replaces. */
const drive = { turns: 0, story: 0 };

const EXPLODE_DISTANCE = 0.95;

function Ball({ panels, onReady }: { panels: Panel[]; onReady: () => void }) {
  const group = useRef<THREE.Group>(null);
  const meshes = useRef<THREE.Mesh[]>([]);
  const materials = useMemo(() => panels.map((p) => makePanelMaterial(p.kind)), [panels]);
  const announced = useRef(false);

  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  useFrame(() => {
    if (!group.current) return;
    group.current.rotation.y = drive.turns * Math.PI * 2;
    group.current.rotation.x = -0.14;

    const open = drive.story;
    for (let i = 0; i < meshes.current.length; i++) {
      const mesh = meshes.current[i];
      if (!mesh) continue;
      const dir = panels[i].dir;
      /* Pentagons lead by a fraction, so the shell peels rather than bursting. */
      const lead = panels[i].kind === 'pent' ? 1.12 : 0.94;
      mesh.position.copy(dir).multiplyScalar(open * EXPLODE_DISTANCE * lead);
      mesh.rotation.set(dir.x * open * 0.7, dir.y * open * 0.7, dir.z * open * 0.7);
    }
    /* The wireframe crosses over faster than the panels travel, so the ball
     * has already turned to blueprint by the time it is fully open. */
    const wire = Math.min(1, open / 0.7);
    for (const material of materials) material.userData.uProgress.value = wire;

    if (!announced.current) {
      announced.current = true;
      onReady();
    }
  });

  return (
    <group ref={group}>
      {panels.map((panel, i) => (
        <mesh
          key={panel.name}
          geometry={panel.geometry}
          material={materials[i]}
          ref={(node) => {
            if (node) meshes.current[i] = node;
          }}
        />
      ))}
    </group>
  );
}

/**
 * Taremi.
 *
 * By default this is his actual photograph, cut out and standing in the scene —
 * not a modelled figure. There is no scanned mesh of him in this repository,
 * and building a body and calling it a named client is not a thing this project
 * does: the same rule that keeps invented stats off his player page keeps an
 * invented likeness out of here. A photograph that is genuinely him beats an
 * approximation that is not, and it costs 45KB rather than several megabytes.
 *
 * If a real model is supplied, drop it at assets/models/taremi.glb and it is
 * used instead — the slot is wired, the plane is what fills it until then. The
 * mesh is fitted to a fixed height on load, so it does not matter what scale or
 * origin it is authored at.
 */
function TaremiFigure({ portraitUrl, figureUrl }: { portraitUrl: string; figureUrl?: string }) {
  const holder = useRef<THREE.Group>(null);
  const [figure, setFigure] = useState<THREE.Object3D | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!figureUrl) return;
    let cancelled = false;
    new GLTFLoader().load(
      figureUrl,
      (gltf) => {
        if (cancelled) return;
        const scene = gltf.scene;
        /* Fit to a known height and stand it on its own feet, so a model
         * authored in centimetres or centred on its chest still lands right. */
        const box = new THREE.Box3().setFromObject(scene);
        const size = new THREE.Vector3();
        const centre = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(centre);
        const scale = size.y > 0 ? 3.3 / size.y : 1;
        scene.scale.setScalar(scale);
        scene.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);
        setFigure(scene);
      },
      undefined,
      () => {
        /* No model, or a bad one. The photograph is the fallback. */
      },
    );
    return () => {
      cancelled = true;
    };
  }, [figureUrl]);

  useEffect(() => {
    if (figure) return;
    let cancelled = false;
    new THREE.TextureLoader().load(portraitUrl, (loaded) => {
      if (cancelled) return;
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.anisotropy = 8;
      setTexture(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [portraitUrl, figure]);

  useFrame((state) => {
    if (!holder.current) return;
    /* Arrives across the first half of the chapter and settles. */
    const entry = THREE.MathUtils.clamp(drive.story / 0.55, 0, 1);
    const eased = 1 - Math.pow(1 - entry, 3);
    holder.current.visible = entry > 0.005;
    /* Ends in front of the ball and to its left, not inside it: the shell
     * opens to nearly two radii and anything at the origin is threaded through
     * the panels rather than standing beside them. */
    holder.current.position.set(
      THREE.MathUtils.lerp(-6.2, -3.05, eased),
      (figure ? -1.85 : -0.4) + Math.sin(state.clock.elapsedTime * 0.6) * 0.03,
      THREE.MathUtils.lerp(-1.4, 1.15, eased),
    );
    holder.current.rotation.y = THREE.MathUtils.lerp(0.6, 0.24, eased);

    if (!figure) {
      const plane = holder.current.children[0] as THREE.Mesh | undefined;
      const material = plane?.material as THREE.MeshBasicMaterial | undefined;
      if (material) material.opacity = entry * 0.98;
    }
  });

  const height = 3.3;
  const width = height * (529 / 760);

  return (
    <group ref={holder} visible={false}>
      {figure ? (
        <primitive object={figure} />
      ) : texture ? (
        <mesh>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

/** Pulls back and swings round as the shell opens, so the panels stay in frame. */
function Rig() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const target = useMemo(() => new THREE.Vector3(), []);
  const wanted = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const open = drive.story;
    /* Field of view is vertical, so a narrow window keeps all the height and
     * loses the width. Pull back by however far the aspect falls short. */
    const aspect = size.width / Math.max(1, size.height);
    const fit = THREE.MathUtils.clamp(1.5 / aspect, 1, 2.1);
    const range = (3.05 + open * 2.5) * fit;
    const orbit = open * 0.5;

    wanted.set(Math.sin(orbit) * range, open * 0.35, Math.cos(orbit) * range);
    camera.position.lerp(wanted, 1 - Math.pow(0.002, delta));
    /* Aim left of the ball once it opens, so it sits clear of the copy column. */
    target.set(-open * 0.95, 0, 0);
    camera.lookAt(target);
  });

  return null;
}

function Scene({ panels, onReady, options }: { panels: Panel[]; onReady: () => void; options: HeroOptions }) {
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
      <Rig />
      <Ball panels={panels} onReady={onReady} />
      <TaremiFigure portraitUrl={options.portraitUrl} figureUrl={options.figureUrl} />
    </>
  );
}

function Hero({ options, onReady }: { options: HeroOptions; onReady: () => void }) {
  const [panels, setPanels] = useState<Panel[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    new GLTFLoader().load(
      options.modelUrl,
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
  }, [options.modelUrl]);

  if (!panels) return null;

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 3.05], fov: 42 }}
      style={{ width: '100%', height: '100%' }}
    >
      <Scene panels={panels} onReady={onReady} options={options} />
    </Canvas>
  );
}

let root: Root | null = null;

/** Mount the scene into `container`. Returns the handle the host drives it with. */
export function mount(container: HTMLElement, options: HeroOptions): HeroHandle {
  let settle: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    settle = resolve;
  });

  /* No StrictMode. Its double-invoke is a development aid inside a React app;
   * here it would build the scene twice on a page that is not otherwise React,
   * for no diagnostic anyone would ever read. */
  root = createRoot(container);
  root.render(<Hero options={options} onReady={settle} />);

  return {
    setSpin: (turns: number) => {
      drive.turns = turns;
    },
    setStory: (progress: number) => {
      drive.story = Math.max(0, Math.min(1, progress));
    },
    ready,
    dispose: () => {
      root?.unmount();
      root = null;
    },
  };
}
