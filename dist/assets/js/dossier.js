/**
 * Player dossier motion: count the vitals up, draw the attribute radar out
 * from its centre, and run the contract bar along its track.
 *
 * Every value is already in the markup, so with GSAP absent or reduced
 * motion set the section simply stands still at its final state.
 */
import { $$, gsap, ScrollTrigger, canAnimate } from './env.js';

const once = { once: true };

function countUp(el) {
  const target = Number(el.dataset.count);
  if (!Number.isFinite(target)) return;
  const proxy = { value: 0 };
  gsap.to(proxy, {
    value: target,
    duration: 1.1,
    ease: 'power2.out',
    scrollTrigger: { trigger: el, start: 'top 88%', ...once },
    onUpdate() {
      el.textContent = String(Math.round(proxy.value));
    },
    onComplete() {
      el.textContent = String(target);
    },
  });
}

function drawRadar(figure) {
  const shape = figure.querySelector('[data-radar-shape]');
  if (!shape) return;
  gsap.from(shape, {
    scale: 0.05,
    opacity: 0,
    duration: 1,
    ease: 'power3.out',
    transformOrigin: '50% 50%',
    scrollTrigger: { trigger: figure, start: 'top 82%', ...once },
  });
  gsap.from(figure.querySelectorAll('.radar__label'), {
    opacity: 0,
    duration: 0.5,
    stagger: 0.06,
    delay: 0.35,
    ease: 'power2.out',
    scrollTrigger: { trigger: figure, start: 'top 82%', ...once },
  });
}

function runBar(fill) {
  gsap.from(fill, {
    scaleX: 0,
    duration: 1.2,
    ease: 'power3.out',
    transformOrigin: 'left center',
    scrollTrigger: { trigger: fill, start: 'top 92%', ...once },
  });
}

export function initDossier(root = document) {
  const counters = $$('[data-count]', root);
  const radars = $$('[data-radar]', root);
  const bars = $$('[data-bar]', root);
  if (!counters.length && !radars.length && !bars.length) return;

  /* Without motion the server-rendered numbers are already correct. */
  if (!canAnimate() || !ScrollTrigger) return;

  counters.forEach(countUp);
  radars.forEach(drawRadar);
  bars.forEach(runBar);
}
