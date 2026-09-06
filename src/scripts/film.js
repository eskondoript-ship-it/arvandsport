/**
 * Scrub a clip from the scroll position.
 *
 * The section is three viewports tall with a `position: sticky` stage inside
 * it, so the browser does the holding; this only has to turn "how far through
 * the section are we" into "which frame".
 *
 * ## Why this is more than one line
 *
 * `video.currentTime = t` looks like the whole job and is not. Three things
 * make a scrubbed video stutter, and all three are handled here:
 *
 *  1. **Seeking faster than the decoder.** Writing currentTime on every scroll
 *     event queues seeks the decoder cannot service, and it answers by
 *     dropping the ones in between -- the picture lurches instead of running.
 *     So a write only happens on an animation frame, and only when the
 *     previous seek has finished.
 *
 *  2. **Asking for times between frames.** The clip is 30fps; a time halfway
 *     between two frames is rounded to one of them by the decoder anyway, and
 *     asking for it repeatedly re-seeks to the same picture. The target is
 *     quantised to the frame grid, and a seek is skipped when it would land on
 *     the frame already shown.
 *
 *  3. **Fetching it before it is wanted.** The markup says preload="none", so
 *     nothing is downloaded until this file calls load(). That happens when
 *     the section is within a screen of the viewport, not on page load.
 *
 * ## What this does not do
 *
 * It never plays the video. There is no audio track in the file at all, and
 * without a play() call there is no autoplay policy to satisfy on any browser.
 * Seeking a muted, inline, already-loaded video needs no user gesture.
 */
import { $, gsap, ScrollTrigger, canAnimate } from './env.js';

/* The clip's own frame rate. It is encoded as constant 30fps on purpose --
 * tools that produce a variable rate make every seek land somewhere slightly
 * different from where it was asked to, which is a stutter no amount of care
 * on this side can smooth out. */
const FPS = 30;

let previous = null;

export function initFilm(root = document) {
  if (previous) {
    previous();
    previous = null;
  }

  const section = $('[data-film]', root);
  if (!section) return () => {};

  const video = $('[data-film-video]', section);
  const pin = $('[data-film-pin]', section);
  const count = $('[data-film-count]', section);
  if (!video || !pin || !canAnimate() || !ScrollTrigger) return () => {};

  section.classList.add('is-live');

  /* Fetched when it is nearly needed, not on page load. Until this fires the
     poster is what is on screen, which is also what a visitor who never gets
     here sees. */
  let asked = false;
  const fetchWhenClose = ScrollTrigger.create({
    trigger: section,
    start: 'top bottom+=100%',
    once: true,
    onEnter: () => {
      if (asked) return;
      asked = true;
      video.load();
    },
  });

  let duration = 0;
  video.addEventListener('loadedmetadata', () => {
    duration = video.duration || 0;
    section.classList.add('is-ready');
  });

  /* The frame the picture is currently showing, so a seek that would not
     change it is not made at all. */
  let shown = -1;
  let seeking = false;
  let wanted = 0;
  video.addEventListener('seeked', () => {
    seeking = false;
  });

  const draw = () => {
    if (!duration) return;
    /* Quantised to the frame grid. Asking for 1.234s when frames land every
       1/30s is asking for the frame at 1.2333 with extra steps, and doing it
       every frame is asking for the same picture over and over. */
    const frame = Math.min(
      Math.round(wanted * duration * FPS),
      Math.max(0, Math.floor(duration * FPS) - 1),
    );
    if (frame === shown || seeking) return;
    shown = frame;
    seeking = true;
    video.currentTime = frame / FPS;
  };

  const trigger = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      wanted = self.progress;
      if (count) count.textContent = String(Math.round(self.progress * 100)).padStart(3, '0');
    },
  });

  /* One writer, on the ticker, rather than a seek per scroll event. GSAP's
     ticker is already running the rest of the page's motion, so this costs a
     function call a frame and keeps the seeks on the same clock as everything
     else. */
  gsap.ticker.add(draw);

  previous = () => {
    gsap.ticker.remove(draw);
    trigger.kill();
    fetchWhenClose.kill();
    section.classList.remove('is-live', 'is-ready');
  };
  return previous;
}
