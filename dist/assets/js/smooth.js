/**
 * Lenis smooth scrolling, wired to GSAP.
 *
 * Three things have to agree or the page fights itself:
 *
 *  1. ScrollTrigger has to be told the scroll position changed. Lenis moves
 *     the page on its own schedule, so without this every pin and scrub on
 *     the site lags behind by a frame or drifts outright.
 *  2. Lenis has to be driven by GSAP's ticker rather than its own rAF loop,
 *     so scroll and tweens advance on the same frame. Two loops means the
 *     scrubbed scenes judder against the scroll they are following.
 *  3. GSAP's lag smoothing has to be off. It skips ahead after a slow frame,
 *     which is right for a tween and wrong for a scroll position.
 *
 * It stays off for anyone who asked for reduced motion, and off on touch.
 * Phones already scroll smoothly, the platform does it on the compositor,
 * and hijacking that trades a free native behaviour for a JavaScript loop on
 * the device least able to afford one.
 */
import { gsap, ScrollTrigger, prefersReducedMotion } from './env.js';

let lenis = null;

export function initSmoothScroll() {
  if (lenis) return lenis;

  const Lenis = window.Lenis;
  if (!Lenis || !gsap || !ScrollTrigger) return null;
  if (prefersReducedMotion()) return null;

  /* Coarse pointer means touch. Native scrolling there is already smooth and
   * runs off the main thread; replacing it makes things worse, not better. */
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return null;

  lenis = new Lenis({
    duration: 1.05,
    /* Exponential ease-out: quick to respond, long to settle. */
    easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
    smoothWheel: true,
    syncTouch: false,
    wheelMultiplier: 1,
  });

  lenis.on('scroll', ScrollTrigger.update);

  const tick = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  /* Anchor jumps and the header's scroll-to must go through Lenis too, or
   * they set scrollTop directly and Lenis immediately pulls it back. */
  ScrollTrigger.scrollerProxy(document.documentElement, {
    scrollTop(value) {
      if (arguments.length) lenis.scrollTo(value, { immediate: true });
      return lenis.actualScroll;
    },
  });

  window.lenis = lenis;
  document.documentElement.classList.add('has-smooth-scroll');
  return lenis;
}

/** Used by the header's anchor handling so one scroll engine owns the page. */
export function scrollToTarget(target, offset = 0) {
  if (lenis) {
    lenis.scrollTo(target, { offset: -offset, duration: 1.1 });
    return true;
  }
  return false;
}

export function destroySmoothScroll() {
  if (!lenis) return;
  lenis.destroy();
  lenis = null;
  delete window.lenis;
  gsap?.ticker.lagSmoothing(500, 33);
  document.documentElement.classList.remove('has-smooth-scroll');
}
