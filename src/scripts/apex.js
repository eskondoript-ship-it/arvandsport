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
  const facetEls = $$('.apex__facet', section);
  const words = $$('[data-apex-word]', section);
  const fades = $$('[data-apex-fade]', section);

  if (!canAnimate() || !ScrollTrigger || !facetEls.length) return;

  /* Intro: the ball pulls itself together once, on load. Each facet carries
   * its own outward offset from the template, so the scatter follows the
   * geometry rather than being random per visit. */
  gsap.set(facetEls, {
    x: (i, el) => Number(el.dataset.dx) || 0,
    y: (i, el) => Number(el.dataset.dy) || 0,
    rotate: (i, el) => Number(el.dataset.spin) || 0,
    scale: 0.35,
    opacity: 0,
  });
  gsap.set(fades, { opacity: 0, y: 14 });

  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  intro
    .to(facetEls, {
      x: 0,
      y: 0,
      rotate: 0,
      scale: 1,
      opacity: 1,
      duration: 1.15,
      stagger: { each: 0.006, from: 'center' },
    })
    .to(fades, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08 }, 0.35);

  if (words.length === 2) {
    gsap.from(words, {
      opacity: 0,
      y: 40,
      duration: 1,
      ease: 'power3.out',
      stagger: 0.08,
    });
  }

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
  exit
    .to(ball, { rotate: 26, scale: 1.18, ease: 'none' }, 0)
    .to(pin, { opacity: 0.25, ease: 'none' }, 0.55);

  if (words.length === 2) {
    exit
      .to(words[0], { xPercent: -14, ease: 'none' }, 0)
      .to(words[1], { xPercent: 14, ease: 'none' }, 0);
  }

  return () => intro.kill();
}
