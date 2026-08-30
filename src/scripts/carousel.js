/**
 * Tilt the roster's cards in 3D as they travel.
 *
 * The row itself moves on a CSS animation, which is deliberate -- that keeps
 * the travel on the compositor and running even when the main thread is busy.
 * What CSS cannot do is give each card a rotation that depends on where it
 * happens to be at that instant, so this adds exactly that and nothing else.
 *
 * It never reads layout. The obvious implementation calls
 * getBoundingClientRect() on every card every frame, which is twenty-two forced
 * reflows a frame for a purely decorative effect. Instead it asks the Web
 * Animations API what time the track's animation is at, works out the offset
 * from that, and derives each card's centre arithmetically. One number in,
 * geometry out, no reads at all.
 *
 * Off entirely for reduced motion, and paused whenever the section is out of
 * view -- there is no reason to compute a tilt nobody is looking at.
 */
import { $$, canAnimate } from './env.js';

/* How hard the row curves away at the edges. Degrees at the frame's edge.
 * Steep on purpose: the reference this follows turns its outer cards until
 * they are nearly edge-on, and a gentle version of that does not read as
 * depth at all -- it reads as a flat row that someone has nudged. */
const MAX_TILT = 40;
/** How far the outer cards fall back, in pixels of Z. */
const MAX_DEPTH = 150;
/* How far the outer cards are drawn back toward the middle, in pixels.
 * Depth alone opens gaps: a card pushed away shrinks about its own centre and
 * stops meeting its neighbours, so the row turns into islands. Pulling the
 * turned cards inward closes that and gives the overlap a coverflow has. */
const MAX_PULL = 96;
/** How far out of focus a card at the edge of the frame goes, in pixels. */
const MAX_BLUR = 4;

export function initCarousel(root = document) {
  const stops = [];

  for (const wrap of $$('[data-carousel]', root)) {
    const track = wrap.querySelector('[data-carousel-track]');
    const cards = Array.from(wrap.querySelectorAll('.player-card'));
    if (!track || cards.length < 2) continue;

    if (!canAnimate()) {
      /* Reduced motion already turns the row into something the visitor
       * scrolls; a perspective tilt on top of that is motion they did not
       * ask for. */
      continue;
    }

    wrap.classList.add('is-dimensional');

    let running = true;
    let frame = 0;

    /* One card's share of the track, measured once. The row is a grid of
     * equal columns, so this holds until the viewport changes -- and a resize
     * re-measures rather than recomputing it per frame. */
    let pitch = 0;
    let half = 0;
    const measure = () => {
      pitch = track.scrollWidth / cards.length;
      half = wrap.clientWidth / 2;
    };
    measure();

    const tick = () => {
      if (!running) return;
      frame = requestAnimationFrame(tick);
      if (!pitch) return;

      /* Where the track has got to, from the animation rather than from the
       * DOM. currentTime is in milliseconds and the animation runs one full
       * cycle -- half the track's width -- per iteration. */
      const [animation] = track.getAnimations?.() ?? [];
      const duration = animation?.effect?.getTiming?.().duration;
      if (!animation || typeof duration !== 'number') return;
      const phase = ((animation.currentTime ?? 0) % duration) / duration;
      const offset = -phase * (track.scrollWidth / 2);

      for (let i = 0; i < cards.length; i++) {
        /* Distance from the middle of the frame, as a fraction of a half-width:
         * 0 dead centre, 1 at the edge, beyond that off screen. */
        const centre = offset + i * pitch + pitch / 2;
        const t = Math.max(-1.2, Math.min(1.2, (centre - half) / half));
        const card = cards[i];
        card.style.setProperty('--ry', `${-t * MAX_TILT}deg`);
        card.style.setProperty('--tz', `${-Math.abs(t) * MAX_DEPTH}px`);
        card.style.setProperty('--tx', `${-t * MAX_PULL}px`);
        /* A little smaller and a little dimmer as it falls back, so depth
         * reads even where the rotation is nearly edge-on. */
        /* Light scale only. The perspective does most of the shrinking now,
         * and doubling up on it made the outer cards tiny rather than far. */
        card.style.setProperty('--cs', String(1 - Math.abs(t) * 0.05));
        card.style.setProperty('--co', String(1 - Math.abs(t) * 0.35));
        /* Depth of field. One card is the one being looked at and the rest are
         * around it -- which the eye reads from focus long before it reads it
         * from size. Quadratic, so the middle of the frame stays sharp across a
         * useful width instead of only at the exact centre. */
        card.style.setProperty('--cb', `${(t * t * MAX_BLUR).toFixed(2)}px`);
        card.style.setProperty('--cl', String(1 - t * t * 0.4));
      }
    };

    /* Nothing runs while the section is off screen. */
    const watcher = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting;
        cancelAnimationFrame(frame);
        if (running) frame = requestAnimationFrame(tick);
      },
      { rootMargin: '120px' },
    );
    watcher.observe(wrap);

    const onResize = () => measure();
    window.addEventListener('resize', onResize, { passive: true });

    stops.push(() => {
      running = false;
      cancelAnimationFrame(frame);
      watcher.disconnect();
      window.removeEventListener('resize', onResize);
    });
  }

  return () => stops.forEach((stop) => stop());
}
