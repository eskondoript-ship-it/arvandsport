/** Shared environment facts every module agrees on. */
export const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

export const prefersReducedMotion = () => reduceMotionQuery.matches;

/** GSAP is vendored and loaded as a classic deferred script before this module. */
export const gsap = window.gsap || null;
export const ScrollTrigger = window.ScrollTrigger || null;

export const canAnimate = () => Boolean(gsap) && !prefersReducedMotion();

if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger, window.ScrollToPlugin);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Run fn now if the document is ready, otherwise on DOMContentLoaded. */
export function ready(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}
