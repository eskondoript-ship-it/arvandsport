/**
 * A custom cursor: a small dot that tracks the pointer exactly, and a ring
 * that lags behind it and swells over interactive targets.
 *
 * Pointer-fine devices only. The real cursor is never hidden — this rides
 * alongside it, so nothing is lost if the element fails to render.
 */
import { gsap, canAnimate } from './env.js';

let teardown = null;

export function initCursor() {
  teardown?.();
  teardown = null;

  if (!canAnimate()) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const root = document.createElement('div');
  root.className = 'cursor';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '<span class="cursor__ring"></span><span class="cursor__dot"></span>';
  document.body.appendChild(root);

  const ring = root.querySelector('.cursor__ring');
  const dot = root.querySelector('.cursor__dot');

  const moveRingX = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' });
  const moveRingY = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' });
  const moveDotX = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power2.out' });
  const moveDotY = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power2.out' });

  const onMove = (event) => {
    moveRingX(event.clientX);
    moveRingY(event.clientY);
    moveDotX(event.clientX);
    moveDotY(event.clientY);
    root.classList.add('is-visible');
  };

  const INTERACTIVE = 'a, button, input, select, textarea, [data-magnetic], .chip, .player-card, .news-card';
  const onOver = (event) => root.classList.toggle('is-active', Boolean(event.target.closest(INTERACTIVE)));
  const onLeave = () => root.classList.remove('is-visible');
  const onDown = () => root.classList.add('is-down');
  const onUp = () => root.classList.remove('is-down');

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerover', onOver, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });

  teardown = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerover', onOver);
    document.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    root.remove();
  };
}

export function destroyCursor() {
  teardown?.();
  teardown = null;
}
