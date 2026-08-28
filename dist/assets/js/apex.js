/**
 * The opening set piece's choreography.
 *
 * The ball assembles from scattered facets as the section is scrolled, the two
 * halves of the display line drift apart to make room for it, and everything
 * else fades up. Scroll-driven rather than timed, so the visitor controls it.
 *
 * Budget matters here: this is the first thing a phone renders. Facets are
 * animated in one batched tween with a stagger rather than one tween each, and
 * only transform and opacity are touched, so the whole sequence stays on the
 * compositor. With GSAP absent or reduced motion set, the markup already
 * describes the assembled ball and nothing needs to run.
 */
import { $, $$, gsap, ScrollTrigger, canAnimate } from './env.js';

export function initApex(root = document) {
  const section = $('[data-apex]', root);
  if (!section) return;

  const pin = $('[data-apex-pin]', section);
  const ball = $('[data-apex-ball]', section);
  const object = $('[data-apex-object]', section);
  const words = $$('[data-apex-word]', section);
  const fades = $$('[data-apex-fade]', section);

  if (!canAnimate() || !ScrollTrigger) return;

  /* The sprite is 30 frames of a full rotation laid out 6 across, 5 down.
   * Setting a frame is one background-position write, which the compositor
   * handles without a layout or a paint of anything else. */
  const COLS = 6;
  const ROWS = 5;
  const FRAMES = COLS * ROWS;
  const spriteActive = () => window.matchMedia('(min-width: 761px)').matches;

  const showFrame = (n) => {
    if (!ball || !spriteActive()) return;
    const f = ((Math.round(n) % FRAMES) + FRAMES) % FRAMES;
    ball.style.backgroundPositionX = `${((f % COLS) / (COLS - 1)) * 100}%`;
    ball.style.backgroundPositionY = `${(Math.floor(f / COLS) / (ROWS - 1)) * 100}%`;
  };

  gsap.set(fades, { opacity: 0, y: 14 });

  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  /* Spins up and settles, rather than appearing already turning. */
  const spin = { f: -14 };
  intro
    .from(object, { opacity: 0, scale: 0.82, duration: 1.1, ease: 'power2.out' }, 0)
    .to(spin, { f: 0, duration: 1.5, ease: 'power3.out', onUpdate: () => showFrame(spin.f) }, 0)
    .to(fades, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08 }, 0.3);

  /* Scroll: the ball turns and recedes while the two halves of the line part
   * further, so the gap the ball sits in opens as the section leaves. */
  const exit = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: 'bottom top',
      scrub: 0.4,
      invalidateOnRefresh: true,
    },
  });
  /* Scroll turns the ball: a little over half a revolution across the
   * section, which reads as deliberate rather than as a spinning loop. */
  const scrubbed = { f: 0 };
  exit
    .to(scrubbed, { f: 17, ease: 'none', onUpdate: () => showFrame(scrubbed.f) }, 0)
    .to(object, { scale: 1.14, ease: 'none' }, 0)
    .to(pin, { opacity: 0.25, ease: 'none' }, 0.55);


  /* Kick it. Clicking the ball drives it away along a shallow arc, spinning
   * hard, then lets it come back and settle — a toy, but the kind visitors
   * actually poke at. Guarded so a second click cannot stack timelines, and
   * the frame scrub is handed back to scroll when it lands. */
  let kicking = false;
  const kick = () => {
    if (kicking || !object) return;
    kicking = true;
    const spinFrames = { f: 0 };
    const dir = Math.random() < 0.5 ? -1 : 1;

    gsap
      .timeline({
        defaults: { ease: 'power2.out' },
        onComplete: () => {
          kicking = false;
          exit.scrollTrigger?.refresh();
        },
      })
      /* Squash on contact, then away. */
      .to(object, { scaleX: 1.14, scaleY: 0.86, duration: 0.07, ease: 'power2.in' })
      .to(object, { scaleX: 1, scaleY: 1, duration: 0.16 })
      .to(object, { x: dir * 190, y: -150, duration: 0.42, ease: 'power2.out' }, 0.06)
      .to(object, { y: 0, duration: 0.5, ease: 'power2.in' }, 0.48)
      .to(object, { x: 0, duration: 0.62, ease: 'power2.inOut' }, 0.48)
      /* Two full turns while it is in the air. */
      .to(spinFrames, {
        f: dir * FRAMES * 2,
        duration: 1.05,
        ease: 'power2.out',
        onUpdate: () => showFrame(spinFrames.f),
      }, 0.06)
      /* A short bounce on the way down rather than a dead stop. */
      .to(object, { y: -34, duration: 0.16, ease: 'power2.out' }, 0.98)
      .to(object, { y: 0, duration: 0.22, ease: 'power2.in' });
  };

  if (object) {
    object.style.pointerEvents = 'auto';
    object.style.cursor = 'pointer';
    object.addEventListener('click', kick);
  }

  if (words.length === 2) {
    exit
      .to(words[0], { xPercent: -14, ease: 'none' }, 0)
      .to(words[1], { xPercent: 14, ease: 'none' }, 0);
  }

  return () => intro.kill();
}
