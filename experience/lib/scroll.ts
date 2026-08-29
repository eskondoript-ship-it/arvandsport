'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

/**
 * One scroll engine, one progress value, read by both the 3D scene and the HUD.
 *
 * The scene runs at 60fps and the HUD is React. If scroll progress lived in
 * React state, every frame of a scrub would re-render the overlay, and the
 * overlay is the expensive half. So progress lives in a plain mutable object
 * that useFrame reads directly, and React only hears about it when the chapter
 * index actually changes -- three times over the whole page instead of a few
 * hundred.
 */

export const CHAPTER_COUNT = 3;

/** Mutated every frame by the scrub. Read it, never store it in state. */
export const scrollState = { progress: 0 };

type ChapterListener = (chapter: number) => void;
const chapterListeners = new Set<ChapterListener>();
let lastChapter = -1;

export function chapterFor(progress: number): number {
  // 0-30 / 30-70 / 70-100, matching the timeline in SoccerModel.
  if (progress < 0.3) return 0;
  if (progress < 0.7) return 1;
  return 2;
}

export function setScrollProgress(progress: number): void {
  scrollState.progress = progress;
  const chapter = chapterFor(progress);
  if (chapter !== lastChapter) {
    lastChapter = chapter;
    chapterListeners.forEach((fn) => fn(chapter));
  }
}

export function onChapterChange(fn: ChapterListener): () => void {
  chapterListeners.add(fn);
  fn(lastChapter < 0 ? 0 : lastChapter);
  return () => {
    chapterListeners.delete(fn);
  };
}

let lenis: Lenis | null = null;

/**
 * Lenis, wired to GSAP. Three things have to agree or the page fights itself:
 * ScrollTrigger is updated from Lenis's scroll event, GSAP's ticker drives
 * Lenis instead of Lenis running its own rAF, and lag smoothing goes off --
 * skipping ahead after a slow frame is right for a tween and wrong for a
 * scroll position.
 *
 * It stays off for reduced motion and on touch. Phones scroll smoothly
 * already, on the compositor, and replacing that with a main-thread loop costs
 * the most on the device that can least afford it.
 */
export function initSmoothScroll(): () => void {
  gsap.registerPlugin(ScrollTrigger);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduced || !fine) return () => {};

  lenis = new Lenis({
    duration: 1.05,
    easing: (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t)),
    smoothWheel: true,
    syncTouch: false,
  });

  const update = () => ScrollTrigger.update();
  lenis.on('scroll', update);

  const tick = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  return () => {
    lenis?.off('scroll', update);
    gsap.ticker.remove(tick);
    gsap.ticker.lagSmoothing(500, 33);
    lenis?.destroy();
    lenis = null;
  };
}

/** Public asset URL, honouring the Pages sub-path the export is mounted at. */
export function asset(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return `${base}${path}`;
}
