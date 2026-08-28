/**
 * The animation system: scroll reveals, split headings, counters, parallax and
 * pointer micro-interactions.
 *
 * Contract with the CSS: nothing is hidden until this module has confirmed
 * animation is both possible (GSAP present) and wanted (no reduced-motion
 * preference). It sets `.motion-ready` on <html> at that point, which is the
 * only thing that turns the "start hidden" rules on. Without JS, without GSAP
 * or with reduced motion, every page renders complete and static.
 */
import { gsap, ScrollTrigger, canAnimate, $$, prefersReducedMotion } from './env.js';
import { splitWords, splitChars, splitLines, unsplit, scramble } from './text.js';
import { initScenes, killScenes } from './scenes.js';

const triggers = new Set();

function track(st) {
  if (st) triggers.add(st);
  return st;
}

/** Tear down everything this module created, before a page transition swap. */
export function teardownMotion(root = document) {
  killScenes();
  for (const st of triggers) {
    if (!root.contains(st.trigger) || root === document) st.kill(true);
  }
  triggers.clear();
}

/* ------------------------------------------------------------- reveals */

function revealElements(root) {
  const items = $$('[data-reveal]', root);
  if (!items.length) return;
  ScrollTrigger.batch(items, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.08,
        overwrite: true,
      }),
  });
  gsap.set(items, { y: 26 });
}

function revealCards(root) {
  const groups = [
    ['.player-card', 'top 90%'],
    ['.news-card', 'top 90%'],
    ['.service', 'top 88%'],
    ['.person', 'top 92%'],
    ['.office', 'top 90%'],
  ];
  for (const [selector, start] of groups) {
    const items = $$(selector, root).filter((el) => !el.hasAttribute('data-reveal'));
    if (!items.length) continue;
    gsap.set(items, { opacity: 0, y: 34, scale: 0.985 });
    track(
      ScrollTrigger.batch(items, {
        start,
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { opacity: 1, y: 0, scale: 1, duration: 0.85, ease: 'power3.out', stagger: 0.06 }),
      })[0],
    );
  }
}

/* ------------------------------------------------ split heading reveals */

function animateSplits(root) {
  for (const el of $$('[data-split]', root)) {
    const inners = splitWords(el);
    gsap.set(inners, { yPercent: 115 });
    track(
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        once: true,
        onEnter: () => gsap.to(inners, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.045 }),
      }),
    );
  }

  /* Per-character stagger, for the few headings that earn the extra weight. */
  for (const el of $$('[data-split-chars]', root)) {
    const chars = splitChars(el);
    gsap.set(chars, { yPercent: 120, opacity: 0 });
    track(
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        once: true,
        onEnter: () => gsap.to(chars, { yPercent: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.018 }),
      }),
    );
  }

  /* Paragraphs rise line by line. Line grouping is a function of width, so
   * the wrappers are unwound as soon as the reveal finishes — after that the
   * text is plain again and reflows normally on resize. */
  for (const el of $$('[data-split-lines]', root)) {
    const inners = splitLines(el);
    gsap.set(inners, { yPercent: 110, opacity: 0 });
    track(
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: () =>
          gsap.to(inners, {
            yPercent: 0,
            opacity: 1,
            duration: 0.9,
            ease: 'expo.out',
            stagger: 0.07,
            onComplete: () => unsplit(el),
          }),
      }),
    );
  }
}

/* ---------------------------------------------------------- nav scramble */

function scrambleLinks(root) {
  for (const link of $$('[data-scramble]', root)) {
    let cancel = null;
    link.addEventListener('pointerenter', () => {
      cancel?.();
      cancel = scramble(link);
    });
    link.addEventListener('pointerleave', () => cancel?.());
  }
}

/* ------------------------------------------------------------ counters */

/* Counters driven by a scrubbed scene carry data-scrub-counter instead, so
 * they are not also animated on entry by this generic handler. */
function animateCounters(root) {
  for (const el of $$('[data-counter]', root)) {
    const target = Number(el.dataset.counter) || 0;
    const state = { value: 0 };
    track(
      ScrollTrigger.create({
        trigger: el,
        start: 'top 92%',
        once: true,
        onEnter: () =>
          gsap.to(state, {
            value: target,
            duration: 2,
            ease: 'power2.out',
            onUpdate: () => {
              el.textContent = Math.round(state.value).toLocaleString('en-US');
            },
          }),
      }),
    );
  }
}

/* ---------------------------------------------------------------- hero */

function animateHero(root) {
  const hero = root.querySelector('[data-hero]');
  if (!hero) return;

  const chars = $$('[data-hero-title] .ch', hero);
  const tagline = $$('[data-hero-tagline] .word__inner', hero);
  const eyebrow = hero.querySelector('[data-hero-eyebrow]');
  const actions = hero.querySelector('[data-hero-actions]');
  const scroll = hero.querySelector('[data-hero-scroll]');

  /* Start states are set explicitly rather than with .from(), so the only
   * thing that can leave the hero hidden is a tween that never runs — and
   * failsafe() below catches that case. */
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  if (eyebrow) {
    gsap.set(eyebrow, { opacity: 0, y: 18 });
    tl.to(eyebrow, { opacity: 1, y: 0, duration: 0.8 }, 0.15);
  }
  if (chars.length) {
    gsap.set(chars, { yPercent: 118, opacity: 0 });
    tl.to(chars, { yPercent: 0, opacity: 1, duration: 1.1, stagger: 0.03 }, 0.2);
  }
  if (tagline.length) {
    gsap.set(tagline, { yPercent: 110 });
    tl.to(tagline, { yPercent: 0, duration: 0.9, stagger: 0.05 }, 0.5);
  }
  if (actions) {
    gsap.set(actions.children, { opacity: 0, y: 22 });
    tl.to(actions.children, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08 }, 0.7);
  }
  if (scroll) {
    gsap.set(scroll, { opacity: 0 });
    tl.to(scroll, { opacity: 1, duration: 0.8 }, 0.9);
  }

  /* Parallax: background drifts slower than the smoke layer above it. */
  const bg = hero.querySelector('[data-hero-bg]');
  const smoke = hero.querySelector('[data-hero-smoke]');
  if (bg) {
    track(
      gsap.to(bg, {
        yPercent: 14,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
      }).scrollTrigger,
    );
  }
  if (smoke) {
    track(
      gsap.to(smoke, {
        yPercent: -10,
        opacity: 0.15,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
      }).scrollTrigger,
    );
  }
}

/* ------------------------------------------------------- other parallax */

function parallaxMedia(root) {
  const pairs = [
    ['[data-player-media] img', 8],
    ['[data-article-media] img', 12],
  ];
  for (const [selector, amount] of pairs) {
    for (const el of $$(selector, root)) {
      track(
        gsap.fromTo(
          el,
          { yPercent: -amount / 2 },
          {
            yPercent: amount / 2,
            ease: 'none',
            scrollTrigger: { trigger: el.closest('section, header') || el, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        ).scrollTrigger,
      );
    }
  }
}

/* -------------------------------------------------- pointer interactions */

const fine = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function magnetise(root) {
  if (!fine()) return;
  for (const el of $$('[data-magnetic]', root)) {
    const strength = 0.28;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, {
        x: (e.clientX - (r.left + r.width / 2)) * strength,
        y: (e.clientY - (r.top + r.height / 2)) * strength,
        duration: 0.5,
        ease: 'power3.out',
      });
    };
    const onLeave = () => gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, .4)' });
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
  }
}

/** Cards track the cursor for the radial highlight and a slight 3D tilt. */
function tiltCards(root) {
  if (!fine()) return;
  for (const el of $$('[data-tilt]', root)) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
      gsap.to(el, {
        rotateX: (0.5 - py) * 5,
        rotateY: (px - 0.5) * 5,
        transformPerspective: 900,
        duration: 0.5,
        ease: 'power2.out',
      });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { rotateX: 0, rotateY: 0, duration: 0.7, ease: 'power3.out' }));
  }
}

/* -------------------------------------------------------------- exports */

/* --------------------------------------------------------------- failsafe
 * requestAnimationFrame is throttled to a standstill in background tabs, and a
 * GSAP tween that never ticks would leave its target at the hidden start
 * state. A plain timer (which keeps running) sweeps up anything still
 * invisible well after the intro should have finished.
 */
const FAILSAFE_MS = 4000;
let failsafeTimer = null;
let probe = null;

/** Give up on animation entirely and show every page in its finished state. */
function engageFailsafe() {
  document.documentElement.classList.add('motion-failsafe');
  /* kill(true) reverts pinning, so a stalled scene cannot leave the pin
   * spacer behind as a block of empty page. */
  teardownMotion();
  gsap.globalTimeline.clear();
  gsap.set(
    '[data-reveal], .word__inner, .line__inner, .ch, [data-hero-eyebrow], [data-hero-actions] > *,' +
      ' [data-hero-scroll], .player-card, .news-card, .service, .person, .office, [data-clip],' +
      ' [data-strike] *, [data-rail-track]',
    { clearProps: 'all' },
  );
}

function failsafe() {
  clearTimeout(failsafeTimer);
  /* A hidden tab throttles rAF on purpose; wait until it is looked at. */
  if (document.hidden) {
    document.addEventListener('visibilitychange', () => failsafe(), { once: true });
    return;
  }
  probe = gsap.to({ v: 0 }, { v: 1, duration: 0.5 });
  failsafeTimer = setTimeout(() => {
    if (document.hidden) return failsafe();
    if (probe.progress() < 1) engageFailsafe();
  }, FAILSAFE_MS);
}

/** Animate one container. Called on first load and after every page swap. */
export function initMotion(root = document) {
  if (!canAnimate()) {
    document.documentElement.classList.remove('motion-ready');
    return;
  }
  document.documentElement.classList.add('motion-ready');
  animateHero(root);
  animateSplits(root);
  revealElements(root);
  revealCards(root);
  animateCounters(root);
  parallaxMedia(root);
  magnetise(root);
  tiltCards(root);
  scrambleLinks(root);
  initScenes(root);
  ScrollTrigger.refresh();
  failsafe();
}

/**
 * If the visitor flips the OS setting mid-visit, stop animating immediately.
 * @param {() => void} [onDisable] extra teardown, e.g. removing the cursor.
 */
export function watchMotionPreference(onDisable) {
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
    if (prefersReducedMotion()) {
      onDisable?.();
      teardownMotion();
      gsap?.globalTimeline.clear();
      document.documentElement.classList.remove('motion-ready');
      gsap?.set('[data-reveal], .player-card, .news-card, .service, .person, .office, .word__inner', {
        clearProps: 'all',
      });
    }
  });
}
