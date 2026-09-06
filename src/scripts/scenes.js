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

/* ------------------------------------------------------ stacking services */

/* The service cards used to be dealt in from depth here, with a scrubbed
 * fromTo that set rotateX:14 and z:-220 as its start state.
 *
 * Two problems, both real. Every .service already carries data-reveal, so the
 * cards were driven by two systems at once. And fromTo writes its start state
 * the moment it is built: if the ScrollTrigger then dies — as one of the two
 * grids' did — the cards are stranded at a 14-degree tilt for the rest of the
 * visit, which is what made them look sideways on the live site.
 *
 * The standard reveal already covers these cards, and it is the path with the
 * failsafe behind it, so the extra layer is gone rather than patched.
 */

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

  /* onUpdate only fires while the page is actually scrolling, so whatever it
   * wrote last is the value that stays. That left the news grid at a
   * permanent slant once the visitor stopped — the cards read as crooked
   * rather than as a moving flourish. An idle timer returns it to zero
   * shortly after scrolling ends. */
  let idle;
  const settle = () => {
    clearTimeout(idle);
    idle = setTimeout(() => {
      for (const set of setSkew) set(0);
    }, 120);
  };

  scene(
    ScrollTrigger.create({
      onUpdate: (self) => {
        const velocity = self.getVelocity();
        /* Halved: at six degrees the slant read as a layout fault mid-scroll. */
        const skew = gsap.utils.clamp(-3, 3, velocity / 640);
        for (const set of setSkew) set(skew);
        settle();
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
  heroExit(root);
  velocityEffects(root);
  clipReveals(root);
  watermarkDrift(root);
}
