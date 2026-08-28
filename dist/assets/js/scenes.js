/**
 * Pinned, scroll-scrubbed set pieces.
 *
 * These are the heavy scenes: each one pins a section and drives a timeline
 * from scroll position rather than from time, so the visitor scrubs the
 * animation themselves. Every scene is registered through `scene()`, which
 * records its ScrollTrigger so the failsafe and page-transition teardown can
 * revert the pinning cleanly.
 *
 * None of this runs unless motion is allowed. The CSS renders each scene as a
 * composed still — player planted, ball at the net, copy in place — so the
 * no-JS and reduced-motion versions are finished pictures, not empty boxes.
 */
import { $, $$, gsap, ScrollTrigger } from './env.js';
import { splitChars } from './text.js';

const registry = new Set();

function scene(trigger) {
  if (trigger) registry.add(trigger);
  return trigger;
}

export function killScenes() {
  for (const trigger of registry) trigger.kill(true);
  registry.clear();
}

/* ------------------------------------------------------------------ strike
 * The Taremi sequence. Stages, all scrubbed:
 *   0.00–0.18  pitch lines draw, heading letters rise
 *   0.18–0.38  run-up: the figure drives in from the left, speed lines streak
 *   0.38–0.45  plant: squash, contact flash
 *   0.45–0.72  the ball fires along a two-part arc, spinning, trailing
 *   0.72–0.85  net catch: mesh ripples, shockwave ring expands
 *   0.85–1.00  payoff: his real caps and goals count up
 */
function strikeScene(root) {
  const section = $('[data-strike]', root);
  if (!section) return;

  const pin = $('[data-strike-pin]', section);
  const player = $('[data-strike-player]', section);
  const ball = $('[data-strike-ball]', section);
  const spin = $('[data-strike-spin]', section);
  const tail = $('[data-strike-tail]', section);
  const net = $('[data-strike-net]', section);
  /* SVG elements have no offsetLeft/offsetWidth, so the net is measured
   * through the plain div that wraps it. */
  const netBox = $('[data-strike-netbox]', section);
  const shock = $('[data-strike-shock]', section);
  const flash = $('[data-strike-flash]', section);
  const copy = $('[data-strike-copy]', section);
  const title = $('[data-strike-title]', section);
  const speedLines = $$('[data-strike-speed] span', section);
  const pitchLines = $$('[data-strike-pitch] [data-draw]', section);
  const stats = $$('[data-strike-stats] [data-scrub-counter]', section);

  const chars = title ? splitChars(title) : [];

  /* Draw-on for the pitch markings: stroke-dashoffset from full to zero. */
  for (const line of pitchLines) {
    const length = line.getTotalLength ? line.getTotalLength() : 300;
    gsap.set(line, { strokeDasharray: length, strokeDashoffset: length });
  }

  gsap.set(player, { xPercent: -46, yPercent: 6, rotate: -7, scale: 0.9, opacity: 0 });
  gsap.set(ball, { x: 0, y: 0, scale: 0, opacity: 0 });
  gsap.set(spin, { rotate: 0 });
  gsap.set(tail, { scaleX: 0, opacity: 0 });

  /* The flight is measured from layout, not guessed in percentages: offsetLeft
   * and offsetTop are unaffected by the transforms the timeline applies, and
   * both elements share .strike__pin as their offset parent. Wrapped in
   * functions so invalidateOnRefresh re-measures them after a resize. */
  const flightX = () => (netBox.offsetLeft + netBox.offsetWidth * 0.42) - (ball.offsetLeft + ball.offsetWidth / 2);
  const flightY = () => (netBox.offsetTop + netBox.offsetHeight * 0.58) - (ball.offsetTop + ball.offsetHeight / 2);
  const apex = () => flightY() - pin.offsetHeight * 0.14;
  /* The goal is dim but present from the start — it reads as the target the
   * shot is aimed at, then brightens on impact. */
  gsap.set(net, { opacity: 0.32, scaleX: 0.94 });
  gsap.set(shock, { scale: 0, opacity: 0 });
  gsap.set(flash, { opacity: 0 });
  gsap.set(speedLines, { scaleX: 0, opacity: 0, transformOrigin: 'right center' });
  gsap.set(chars, { yPercent: 120, opacity: 0 });
  gsap.set(copy, { opacity: 0, y: 30 });

  const timeline = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: '+=320%',
      pin: pin,
      scrub: 0.6,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });
  scene(timeline.scrollTrigger);

  /* Stage 1 — the pitch draws itself in behind everything. */
  timeline
    .to(pitchLines, { strokeDashoffset: 0, duration: 0.18, stagger: 0.02 }, 0)
    .to(chars, { yPercent: 0, opacity: 1, duration: 0.14, stagger: 0.006, ease: 'power2.out' }, 0.02);

  /* Stage 2 — run-up. */
  timeline
    .to(player, { xPercent: -8, yPercent: 0, rotate: -2, scale: 1, opacity: 1, duration: 0.2, ease: 'power2.out' }, 0.18)
    .to(speedLines, { scaleX: 1, opacity: 1, duration: 0.08, stagger: 0.012 }, 0.2)
    .to(speedLines, { scaleX: 0, opacity: 0, duration: 0.08, stagger: 0.012 }, 0.34);

  /* Stage 3 — plant and contact. */
  timeline
    .to(player, { rotate: 3, scaleY: 0.97, scaleX: 1.03, duration: 0.04, ease: 'power3.in' }, 0.38)
    .to(player, { rotate: -1, scaleY: 1, scaleX: 1, duration: 0.06, ease: 'back.out(2)' }, 0.42)
    .to(flash, { opacity: 1, duration: 0.02 }, 0.42)
    .to(flash, { opacity: 0, duration: 0.06 }, 0.44);

  /* Stage 4 — the strike. x is linear, y is two eased halves, which gives a
   * real parabola and stays correct at any viewport size. */
  timeline
    .set(ball, { opacity: 1 }, 0.44)
    .to(ball, { scale: 1, duration: 0.03 }, 0.44)
    .to(ball, { x: flightX, duration: 0.28, ease: 'power1.out' }, 0.45)
    .to(spin, { rotate: 1080, duration: 0.28 }, 0.45)
    /* Two eased halves make a real parabola: up fast, down under gravity. */
    .to(ball, { y: apex, duration: 0.15, ease: 'power2.out' }, 0.45)
    .to(ball, { y: flightY, duration: 0.13, ease: 'power2.in' }, 0.6)
    .to(tail, { scaleX: 1, opacity: 0.8, duration: 0.05 }, 0.46)
    .to(tail, { scaleX: 0, opacity: 0, duration: 0.08 }, 0.64);

  /* Stage 5 — the net takes it. */
  timeline
    .to(net, { opacity: 1, duration: 0.04 }, 0.66)
    .to(net, { scaleX: 1.06, skewY: 2, duration: 0.05, ease: 'power3.out' }, 0.72)
    .to(net, { scaleX: 1, skewY: 0, duration: 0.13, ease: 'elastic.out(1, .35)' }, 0.77)
    .to(ball, { scale: 0.82, duration: 0.05, ease: 'power2.out' }, 0.72)
    .to(shock, { scale: 1, opacity: 0.7, duration: 0.08, ease: 'power2.out' }, 0.72)
    .to(shock, { opacity: 0, duration: 0.1 }, 0.8);

  /* Stage 6 — payoff: his real international record. */
  timeline.to(copy, { opacity: 1, y: 0, duration: 0.12, ease: 'power2.out' }, 0.84);

  for (const el of stats) {
    const target = Number(el.dataset.scrubCounter) || 0;
    el.textContent = '0';
    const value = { n: 0 };
    timeline.to(
      value,
      {
        n: target,
        duration: 0.14,
        onUpdate: () => { el.textContent = Math.round(value.n); },
      },
      0.86,
    );
  }
}

/* ------------------------------------------------------------- hero exit */

/** The hero recedes as the next section rides over it. */
function heroExit(root) {
  const hero = $('[data-hero]', root);
  if (!hero) return;
  const inner = $('.hero__inner', hero);
  if (!inner) return;
  scene(
    gsap.to(inner, {
      yPercent: -18,
      opacity: 0,
      filter: 'blur(6px)',
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'center center', end: 'bottom top', scrub: true },
    }).scrollTrigger,
  );
}

/* ------------------------------------------------- horizontal pinned rail */

/** A row that scrolls sideways while the section is pinned. */
function horizontalRail(root) {
  for (const wrap of $$('[data-rail]', root)) {
    const track = $('[data-rail-track]', wrap);
    if (!track) continue;

    const distance = () => Math.max(0, track.scrollWidth - wrap.offsetWidth);
    if (distance() < 40) continue; /* already fits — nothing to scroll */

    scene(
      gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: wrap,
          start: 'center center',
          end: () => `+=${distance() + wrap.offsetHeight}`,
          pin: true,
          scrub: 0.8,
          invalidateOnRefresh: true,
        },
      }).scrollTrigger,
    );
  }
}

/* ------------------------------------------------------ stacking services */

/** Service cards deal in from depth as the group scrolls through. */
function dealCards(root) {
  for (const grid of $$('[data-deal]', root)) {
    const cards = [...grid.children];
    if (!cards.length) continue;
    gsap.set(cards, { transformPerspective: 1000 });
    scene(
      gsap.fromTo(
        cards,
        { z: -220, rotateX: 14, opacity: 0, y: 60 },
        {
          z: 0,
          rotateX: 0,
          opacity: 1,
          y: 0,
          ease: 'power2.out',
          stagger: 0.06,
          scrollTrigger: { trigger: grid, start: 'top 85%', end: 'top 35%', scrub: 0.7 },
        },
      ).scrollTrigger,
    );
  }
}

/* -------------------------------------------------------- velocity effects */

/**
 * Skew content very slightly in proportion to scroll velocity, and feed the
 * same velocity to the marquee so it speeds up and reverses with the scroll.
 */
function velocityEffects(root) {
  const skewTargets = $$('[data-skew]', root);
  const marquees = $$('[data-marquee]', root);
  if (!skewTargets.length && !marquees.length) return;

  const setSkew = skewTargets.map((el) => gsap.quickTo(el, 'skewY', { duration: 0.5, ease: 'power3.out' }));

  scene(
    ScrollTrigger.create({
      onUpdate: (self) => {
        const velocity = self.getVelocity();
        const skew = gsap.utils.clamp(-6, 6, velocity / 320);
        for (const set of setSkew) set(skew);
        for (const marquee of marquees) {
          const boost = gsap.utils.clamp(0.4, 4, Math.abs(velocity) / 900 + 0.4);
          marquee.style.setProperty('--marquee-speed', String(boost));
          marquee.style.setProperty('--marquee-direction', velocity < 0 ? 'reverse' : 'normal');
        }
      },
    }),
  );
}

/* --------------------------------------------------------- clip reveals */

/** Wipe images in behind a moving clip edge instead of a plain fade. */
function clipReveals(root) {
  const media = $$('[data-clip]', root);
  if (!media.length) return;
  gsap.set(media, { clipPath: 'inset(0% 0% 100% 0%)' });
  scene(
    ScrollTrigger.batch(media, {
      start: 'top 88%',
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power3.inOut', stagger: 0.08 }),
    })[0],
  );
}

/* ------------------------------------------------------ scrubbed watermark */

/** The oversized surname behind a player hero drifts against the scroll. */
function watermarkDrift(root) {
  for (const mark of $$('.player-hero__watermark', root)) {
    scene(
      gsap.fromTo(
        mark,
        { xPercent: -6 },
        {
          xPercent: 6,
          ease: 'none',
          scrollTrigger: { trigger: mark.closest('section') || mark, start: 'top bottom', end: 'bottom top', scrub: true },
        },
      ).scrollTrigger,
    );
  }
}

export function initScenes(root = document) {
  strikeScene(root);
  heroExit(root);
  horizontalRail(root);
  dealCards(root);
  velocityEffects(root);
  clipReveals(root);
  watermarkDrift(root);
}
