/**
 * The opening set piece's choreography.
 *
 * Three chapters over one sticky stage: the brand line, then the ball, the
 * strike and the player. This side owns the copy, the instrument frame and the
 * scrub; the ball itself is drawn by the React Three Fiber island in
 * experience/hero/, which is the same scene as the page at /experience/ rather
 * than a version of it.
 *
 * Budget matters here: this is the first thing a phone renders. Only transform
 * and opacity are touched, so the whole sequence stays on the compositor, and
 * the readouts are written straight to the DOM rather than tweened. With GSAP
 * absent or reduced motion set, the markup already describes a composed still
 * and nothing needs to run.
 */
import { $, $$, gsap, ScrollTrigger, canAnimate } from './env.js';

/**
 * Decide whether this visitor gets the real thing, and if so, fetch it.
 *
 * The scene is 364KB gzipped of JavaScript — React, react-dom and three, which
 * is what React Three Fiber costs and there is no version of it that is cheap —
 * plus a 939KB Trionda with its textures. That is far more than the rest of this
 * site put together, so it is not something every visitor is handed. It goes to
 * wide screens with a mouse and a working WebGL2 context, and it is fetched
 * after the page has already painted, over the top of a sprite that is already
 * turning.
 *
 * Phones keep the sprite and read the same three chapters over it. A phone is
 * where the weight hurts most and where the ball is smallest and half-faded
 * behind the type — it would be paying the whole cost for the least of the
 * benefit.
 *
 * Every way this can fail ends the same way: the sprite stays, and nothing on
 * the page notices.
 */
/**
 * Whether this visitor is getting the scene, decided before anything is
 * fetched.
 *
 * Split out from the mount so the answer is available at once. It has to be:
 * the sprite and the scene are two renderings of the same ball and they do not
 * look identical -- one is a lit photograph of it, the other is glass -- so
 * showing the sprite and then swapping is a visible change of object a second
 * into the visit. Knowing up front means the sprite is simply never painted
 * for anyone who is about to get the real thing.
 */
function wantsWebgl() {
  /* Wide, mouse-driven, and not asking for less motion. */
  if (!window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  /* Save-Data is an explicit request not to be sent a third of a megabyte. */
  if (navigator.connection?.saveData) return false;

  /* Ask for a context rather than sniffing for support: software renderers and
   * blocklisted drivers both answer this honestly, and a lost context here is
   * far cheaper than a dead canvas where the hero used to be. */
  try {
    const probe = document.createElement('canvas').getContext('webgl2');
    if (!probe) return false;
    probe.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    return false;
  }
  return true;
}

async function mountWebglBall(section, stage) {
  const mount = $('[data-apex-webgl]', section);
  if (!mount || !stage) return null;

  try {
    /* Both paths are resolved against this module's own URL, so they hold at
     * whatever depth the page is served from and under a deploy prefix,
     * without the build having to rewrite anything inside a string. */
    const bundle = new URL('../hero/hero.js', import.meta.url).href;
    /* The scene keeps its own assets in one directory and asks for them by the
     * paths it uses at /experience/; the site just tells it where that
     * directory is here. */
    const assetBase = new URL('../scene', import.meta.url).href;
    const hero = await import(/* @vite-ignore */ bundle);
    const handle = hero.mount(mount, { assetBase });
    await handle.ready;

    /* Only now does the sprite go. Swapping on mount rather than on first
     * frame would show an empty hole for as long as the model takes. */
    stage.classList.add('is-webgl');
    return handle;
  } catch (error) {
    console.warn('[arvand] WebGL hero unavailable, keeping the sprite', error);
    return null;
  }
}

export function initApex(root = document) {
  const section = $('[data-apex]', root);
  if (!section) return;

  const ball = $('[data-apex-ball]', section);
  const object = $('[data-apex-object]', section);
  const pin = $('[data-apex-pin]', section);
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

  const spriteFrame = (n) => {
    if (!ball || !spriteActive()) return;
    const f = ((Math.round(n) % FRAMES) + FRAMES) % FRAMES;
    ball.style.backgroundPositionX = `${((f % COLS) / (COLS - 1)) * 100}%`;
    ball.style.backgroundPositionY = `${(Math.floor(f / COLS) / (ROWS - 1)) * 100}%`;
  };

  /* Every timeline below turns the ball by calling showFrame with a frame
   * number. That indirection is the whole seam between the two ways of drawing
   * it: the sprite rounds the number and moves a background, and the WebGL
   * ball turns a mesh by the same fraction of a revolution. Handing over is
   * one reassignment, and no timeline knows which is on the other side — so
   * the choreography cannot drift between the two, because there is only one
   * copy of it. */
  let driver = spriteFrame;
  const showFrame = (n) => driver(n);

  /* The scene's own progress. Null until the island is up, and null forever on
   * the sprite path — a background image cannot come apart or fly, so those
   * visitors get the same three chapters with the ball simply turning behind
   * them. */
  let setSceneProgress = null;

  /* Decided before the bundle is even asked for, so the sprite can be held
   * back rather than shown and then replaced. */
  const expectsScene = wantsWebgl();
  /* The stylesheet has already hidden it for the media half of this decision,
     before the first paint. This settles the half CSS cannot ask about: a
     desktop with no WebGL2, or with Save-Data on, gets the sprite back. */
  if (object) object.style.opacity = expectsScene ? '0' : '1';

  /* The gate is asked once, above, and decides both things: whether the sprite
     is held back, and whether the bundle is fetched at all. Reading it in only
     one of those places is how a phone ended up downloading the scene. */
  (expectsScene ? mountWebglBall(section, pin) : Promise.resolve(null)).then((handle) => {
    if (!handle) {
      /* It was going to work and did not. Give the sprite back -- a turning
       * ball is a great deal better than the empty stage this was holding. */
      if (expectsScene && object) gsap.to(object, { opacity: 1, duration: 0.4 });
      return;
    }
    setSceneProgress = handle.setProgress;
    /* The scene owns its own rotation from here, so the sprite's frame writes
     * stop rather than fighting it. */
    driver = () => {};
    /* Faded from here rather than by the `is-webgl` class, because the intro
     * tween leaves an inline opacity on the sprite and no stylesheet rule
     * outranks an inline style -- the ball sat there in front of the scene. */
    gsap.to(object, { opacity: 0, duration: 0.5, ease: 'power2.out' });
  });

  gsap.set(fades, { opacity: 0, y: 14 });

  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  /* Spins up and settles, rather than appearing already turning. */
  const spin = { f: -14 };
  intro
    /* Scale only when the scene is coming: `from` on opacity would tween the
       held-back sprite straight back to visible. */
    .from(object, expectsScene
      ? { scale: 0.82, duration: 1.1, ease: 'power2.out' }
      : { opacity: 0, scale: 0.82, duration: 1.1, ease: 'power2.out' }, 0)
    .to(spin, { f: 0, duration: 1.5, ease: 'power3.out', onUpdate: () => showFrame(spin.f) }, 0)
    .to(fades, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08 }, 0.3);

  /* Scroll drives both chapters from one timeline over the whole section.
   *
   * The stage is held by CSS `position: sticky`, not by a ScrollTrigger pin, so
   * this trigger only reads the scroll — it never moves the element. That is
   * why the end is `bottom bottom`: the section is two screens tall and the
   * story runs the full length of it, finishing as the last screen clears,
   * rather than at the moment the top leaves.
   *
   * The halves are 0 to 0.5 for the brand chapter and 0.5 to 1 for the player.
   * Both are positions on one timeline rather than two triggers, because the
   * ball carries straight through the join and two triggers would each want to
   * own it across the handover. */
  const stage = $('[data-apex-pin]', section);
  const chapters = $$('[data-apex-chapter]', section);
  const rail = $$('[data-apex-rail]', section);
  const bar = $('[data-apex-bar]', section);
  const count = $('[data-apex-count]', section);
  const readout = $('[data-apex-readout]', section);

  /* Which chapter a given progress sits in. The same three windows the scene
   * uses -- see experience/lib/choreography.ts, which is the one description of
   * this story that both the homepage and /experience/ read. */
  const chapterFor = (p) => (p < 0.3 ? 0 : p < 0.7 ? 1 : 2);
  let lit = -1;

  /* Everything the scrub has to write on a frame, in one place. The readouts go
   * straight to the DOM rather than through tweens: they change every frame and
   * a tween per frame per element is the one thing that would cost real time
   * here. Class work is guarded on the chapter actually changing, so it runs
   * three times over the whole page instead of on every frame. */
  const paint = (p) => {
    setSceneProgress?.(p);

    const pct = String(Math.round(p * 100)).padStart(3, '0');
    if (count) count.textContent = pct;
    if (bar) {
      bar.style.transform = window.matchMedia('(max-width: 760px)').matches
        ? `scaleX(${p.toFixed(4)})`
        : `scaleY(${p.toFixed(4)})`;
    }
    if (readout) {
      readout.textContent = `X ${(Math.sin(p * 6.28) * 100).toFixed(1)}  Y ${(p * 360).toFixed(1)}°`;
    }
    stage?.classList.toggle('is-story', p > 0.04);

    const now = chapterFor(p);
    if (now === lit) return;
    lit = now;
    rail.forEach((el, i) => el.classList.toggle('is-live', i === now));
    stage?.classList.toggle('is-chapter-3', now === 2);
  };

  /* Scroll drives everything from one trigger over the whole section.
   *
   * The stage is held by CSS `position: sticky`, not by a ScrollTrigger pin, so
   * this only reads the scroll and never moves the element. `bottom bottom` is
   * therefore right: the section is four screens tall and the story runs the
   * full length of it, finishing as the last screen clears rather than at the
   * moment the top leaves.
   *
   * The readouts are written straight to the DOM here rather than through a
   * tween, because they change every frame of a scrub and a tween per frame per
   * element is the one thing that would make this drop frames. */
  const exit = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.4,
      invalidateOnRefresh: true,
      onUpdate: (self) => paint(self.progress),
    },
  });

  /* The brand line is chapter zero: the homepage still has to say whose it is
   * before it becomes a study. It leaves as the first act opens, and the three
   * chapters then hand over at the same seams the scene does -- 0.3 and 0.7 --
   * so the copy and the ball are always describing the same moment.
   *
   * Positions on one timeline rather than four triggers, because the scene runs
   * straight through the joins and separate triggers would each want to own it
   * there. The windows overlap by a fade's width on purpose: a hard cut between
   * two pieces of copy over a continuous scene reads as a glitch. */
  const WINDOWS = [
    [0, 0.1],     // ARVAND / SPORT
    [0.08, 0.3],  // 01 the ball
    [0.3, 0.7],   // 02 the strike
    [0.7, 1],     // 03 the player
  ];
  const FADE = 0.05;

  /* A spacer that fixes the timeline at exactly one unit long.
   *
   * ScrollTrigger maps the section's scroll range onto the timeline's duration,
   * and a timeline's duration is wherever its last tween happens to end -- so
   * without this, every position below means a fraction of *that*, not of the
   * section. Measured: 0.75 without it, which put the last chapter's fade at
   * 0.70-0.75 three quarters of the way down a page it should have finished
   * at, and it read as a chapter that never quite arrived.
   *
   * It has to animate something real. A tween on a bare {} has no properties to
   * touch, so GSAP discards it and the length is unchanged -- which is exactly
   * what happened on the first attempt at this. */
  exit.to({ length: 0 }, { length: 1, duration: 1, ease: 'none' }, 0);

  /* The sprite's own rotation, for everyone who is not getting the scene: a
   * little over half a revolution across the section, which reads as deliberate
   * rather than as a loop. Once the island is up this is a no-op, because the
   * mesh turns itself from the same progress. */
  const scrubbed = { f: 0 };
  exit.to(scrubbed, { f: 17, duration: 1, ease: 'none', onUpdate: () => showFrame(scrubbed.f) }, 0);

  chapters.forEach((chapter, i) => {
    const [from, to] = WINDOWS[i] || [0, 1];
    if (i === 0) {
      /* Already visible on load, so it only needs its exit. */
      exit.to(chapter, { opacity: 0, ease: 'none', duration: FADE }, to - FADE);
      return;
    }
    exit.fromTo(chapter, { opacity: 0 }, { opacity: 1, ease: 'none', duration: FADE }, from);
    if (i < chapters.length - 1) {
      exit.to(chapter, { opacity: 0, ease: 'none', duration: FADE }, to - FADE);
    }
  });

  /* The trigger only fires once the scroll moves, so the frame the page lands
   * on would otherwise show an unlit rail and a blank counter. */
  exit.scrollTrigger?.refresh();
  paint(exit.scrollTrigger?.progress ?? 0);

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
