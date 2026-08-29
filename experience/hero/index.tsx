/**
 * The scene at /experience/, mounted into the site's own homepage.
 *
 * This file is deliberately almost empty. It does not reimplement the study, it
 * renders it: the same SoccerCanvas, the same SoccerModel, the same lights,
 * grid, bloom and Taremi. An earlier version of this was a smaller lookalike
 * with its own camera rig and its own explode, and the trouble with a lookalike
 * is that it is only alike on the day you write it.
 *
 * The two hosts differ in exactly two ways, and both are parameters rather than
 * forks:
 *
 *   - Where the assets live. The Next export serves them under its own base
 *     path; the homepage serves the same files out of assets/scene/.
 *   - Who reads the scroll. The study has a ScrollTrigger of its own; the
 *     homepage already has one, and pushes progress in through setProgress.
 *
 * Everything else — the choreography, the shader, the framing — comes from
 * lib/choreography.ts and the shared components, so there is one copy of it.
 *
 * The site around this is a static generator with no npm dependencies and no
 * React. So this is not a page: it is a bundle with one function in it, built
 * by scripts/build-hero.mjs and dropped into the site's assets.
 */
import { createRoot, type Root } from 'react-dom/client';

import SoccerCanvas from '../components/SoccerCanvas';
import { setAssetBase, setScrollProgress } from '../lib/scroll';

export type HeroOptions = {
  /** Directory the scene's own assets sit under, e.g. ".../assets/scene". */
  assetBase: string;
};

export type HeroHandle = {
  /** 0 to 1 across the whole three-chapter story. */
  setProgress: (progress: number) => void;
  /** Resolves once the ball exists and the scene has something to draw. */
  ready: Promise<void>;
  dispose: () => void;
};

let root: Root | null = null;

export function mount(container: HTMLElement, options: HeroOptions): HeroHandle {
  setAssetBase(options.assetBase);

  let settle: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    settle = resolve;
  });

  /* No StrictMode. Its double-invoke is a development aid inside a React app;
   * here it would build the whole scene twice on a page that is not otherwise
   * React, for a diagnostic nobody would ever read. */
  root = createRoot(container);
  root.render(<SoccerCanvas onReady={settle} />);

  return {
    setProgress: setScrollProgress,
    ready,
    dispose: () => {
      root?.unmount();
      root = null;
    },
  };
}
