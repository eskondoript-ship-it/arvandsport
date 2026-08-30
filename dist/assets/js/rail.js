/**
 * Turn the roster's vertical scroll into horizontal travel.
 *
 * The section is several viewport-heights tall and the frame inside it is held
 * by `position: sticky`, so scrolling down holds the frame still and this
 * moves the row across it. The card nearest the middle of the frame comes
 * forward -- larger, brighter, its link live -- and the others fall back.
 *
 * Two custom properties do all of it. `--travel` on the track is how far the
 * row has slid; `--f` on each card is how close it is to the middle, 1 at dead
 * centre and 0 at the edge of the frame. Everything visible is a calc() off
 * those in the stylesheet, so a frame here is a handful of style writes and no
 * layout reads at all.
 *
 * Geometry is measured once and re-measured on resize. Every card is the same
 * width by construction, so where a card sits is arithmetic -- index times
 * pitch, less the travel -- and never a getBoundingClientRect in a loop.
 *
 * Without `is-live` the stylesheet lays the row out as a plain scrollable
 * strip. That is what a visitor gets with no JavaScript, with GSAP missing, or
 * with reduced motion set: the same cards, the same order, moved by hand
 * instead of by the page.
 *
 * The attributes are `data-roster-*` rather than `data-rail-*` because
 * scenes.js already owns the second set: it pins and tweens any `[data-rail]`
 * it finds, which the Our Team page uses. Sharing the names had both systems
 * driving this one track, and the row moved at neither one's rate.
 */
import { $, $$, ScrollTrigger, canAnimate } from './env.js';

/* How far past the last card the travel runs, as a fraction of the frame.
 * Enough that the row does not stop dead on the archive card the moment it
 * appears, and not so much that the last stretch of scrolling is empty. */
const MARGIN = 0.32;

let previous = null;

export function initRail(root = document) {
  if (previous) {
    previous();
    previous = null;
  }

  const section = $('[data-roster-rail]', root);
  if (!section) return () => {};

  const viewport = $('[data-roster-viewport]', section);
  const track = $('[data-roster-track]', section);
  const cards = $$('[data-plate]', section);
  if (!viewport || !track || cards.length < 2) return () => {};
  if (!canAnimate() || !ScrollTrigger) return () => {};

  section.classList.add('is-live');

  let pitch = 0;
  let start = 0;
  let width = 0;
  let distance = 0;
  let half = 0;

  const measure = () => {
    const frame = viewport.clientWidth;
    half = frame / 2;
    /* From the cards' own offsets, not from the track's scrollWidth. The track
       carries a gutter of padding either side, so scrollWidth divided by the
       count is a pitch that is too big by a fraction of a card, and every
       card's computed centre drifts further right than the last -- which put
       the "front" card at the edge of the frame instead of the middle of it.
       offsetLeft is layout, so it is read here and never in a frame. */
    start = cards[0].offsetLeft;
    width = cards[0].offsetWidth;
    pitch = cards[1].offsetLeft - cards[0].offsetLeft;
    const last = cards[cards.length - 1];
    /* Ends with the last card's trailing edge at the frame's, and a margin so
       the travel does not stop exactly on it. */
    distance = Math.max(0, last.offsetLeft + last.offsetWidth - frame + frame * MARGIN);
  };

  const paint = (progress) => {
    if (!pitch) return;
    const travel = progress * distance;
    track.style.setProperty('--travel', `${-travel.toFixed(1)}px`);

    for (let i = 0; i < cards.length; i++) {
      /* Where this card's middle is in the frame, from arithmetic rather than
         from the DOM. */
      const centre = start + i * pitch + width / 2 - travel;
      const offset = Math.abs(centre - half) / Math.max(half, 1);
      /* 1 in the middle, 0 by the edge, and squared so the falloff is gentle
         where it matters and steep where it does not. */
      const focus = Math.max(0, 1 - offset);
      cards[i].style.setProperty('--f', (focus * focus).toFixed(3));
      cards[i].classList.toggle('is-front', offset < 0.28);
    }
  };

  measure();

  const trigger = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => paint(self.progress),
    /* `self`, not the trigger this call is assigning to: onRefresh can fire
       during create(), before the binding exists. */
    onRefresh: (self) => {
      measure();
      paint(self.progress);
    },
  });

  paint(0);

  const onResize = () => {
    measure();
    paint(trigger.progress);
  };
  window.addEventListener('resize', onResize, { passive: true });

  previous = () => {
    trigger.kill();
    window.removeEventListener('resize', onResize);
    section.classList.remove('is-live');
    track.style.removeProperty('--travel');
    for (const card of cards) {
      card.style.removeProperty('--f');
      card.classList.remove('is-front');
    }
  };
  return previous;
}
