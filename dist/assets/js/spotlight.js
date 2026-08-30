/**
 * Scrub the client spotlight: one number in, the whole scene out.
 *
 * Everything the section does -- the panel fading, the ground going out, each
 * card coming forward out of the dark, the lead card turning and falling back
 * among them -- is written in the stylesheet as a calc() off a single custom
 * property. This writes that property and nothing else. Twelve elements move
 * and the main thread touches one.
 *
 * It never reads layout during the scroll either. ScrollTrigger hands over a
 * progress that it maintains from its own cached measurements, so a frame here
 * costs one style write on one element.
 *
 * The class is the contract with the stylesheet. Without `is-live` the section
 * renders its composed still -- panel readable, field already open -- which is
 * what a visitor gets with no JavaScript, with GSAP missing, or with reduced
 * motion set. This adds the class only when it is really going to drive the
 * thing, so those three cases are one case.
 */
import { $, ScrollTrigger, canAnimate } from './env.js';

/* The page transition re-runs every init against the new document without
 * calling anyone's teardown, and motion.js only kills the triggers it made
 * itself. So this holds its own and kills it on the way in. */
let previous = null;

export function initSpotlight(root = document) {
  if (previous) {
    previous();
    previous = null;
  }

  const section = $('[data-spotlight]', root);
  if (!section) return () => {};

  const pin = $('[data-spotlight-pin]', section);
  if (!pin || !canAnimate() || !ScrollTrigger) return () => {};

  section.classList.add('is-live');

  /* The stage is held by `position: sticky`, so the trigger has no pinning to
     do -- it only has to report where in the section the scroll is. The range
     is the section's height less the one viewport the sticky stage occupies,
     which is exactly the distance the stage can hold for. */
  const trigger = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      section.style.setProperty('--p', self.progress.toFixed(4));
      /* The closing link is only clickable once it is actually there. */
      pin.classList.toggle('is-open', self.progress > 0.82);
    },
  });

  /* Set the opening frame now rather than waiting for the first scroll event:
     a visitor who lands halfway down the page and scrolls up should not meet
     the section mid-move with --p still at its default. */
  section.style.setProperty('--p', '0');

  previous = () => {
    trigger.kill();
    section.classList.remove('is-live');
    section.style.removeProperty('--p');
    pin.classList.remove('is-open');
  };
  return previous;
}

/* Deliberately not a GSAP timeline. There is nothing here to tween: the
 * stylesheet already expresses every position as a function of progress, and a
 * timeline would only be a second place for those positions to live -- one
 * that would then disagree with the first. */
