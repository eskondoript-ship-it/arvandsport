/**
 * The opening set piece's choreography.
 *
 * Six beats over one sticky stage: the brand line, the agency, the strike, the
 * stadium, the tactical read, the globe, and the mark it collapses into. This
 * side owns the copy, the instrument frame and the scrub; the ball itself is
 * drawn by the React Three Fiber island in experience/hero/.
 *
 * The windows below and the beats in experience/lib/choreography.ts describe
 * the same story from two sides, and they have to agree: a chapter whose
 * window does not sit over its beat is copy about a stadium arriving while the
 * ball is still being kicked.
 *
 * Budget matters here: this is the first thing a phone renders. Only transform
 * and opacity are touched, so the whole sequence stays on the compositor, and
 * the readouts are written straight to the DOM rather than tweened. With GSAP
 * absent or reduced motion set, the markup already describes a composed still
 * and nothing needs to run.
 */
import { $, $$, gsap, ScrollTrigger, canAnimate } from './env.js';

/**
 * Whether this visitor is getting the real ball.
 *
 * The scene is the glass Trionda itself -- an actual model under actual lights,
 * turning as the page is scrolled -- and it is what the hero is. Everyone who
 * can render it gets it, phones included.
 *
 * It is not free: 364KB gzipped of JavaScript, which is what React Three Fiber
 * costs and there is no cheap version of it, plus a 939KB model with its
 * textures. It was desktop-only for exactly that reason. Serving it to phones
 * is a deliberate trade of bytes for the thing the page is about, and it is
 * hedged rather than blind -- the bundle is fetched after the page has painted,
 * the sprite sheet is not fetched at all when the scene is coming, and the
 * canvas renders at a lower pixel ratio and without full-screen multisampling
 * on a touch device.
 *
 * The decision itself is not made here. It is made in the head, before the
 * first paint, and left on <html> as `wants-scene` -- early enough to stop the
 * browser fetching a sprite sheet nobody will see. This reads that answer; the
 * reasoning, and the three questions it asks, are with SCENE_BOOT in
 * src/templates/layout.mjs. Deciding it twice is how a phone once ended up
 * downloading a scene it had been excluded from.
 *
 * Every way this can fail ends the same way: the sprite comes back, and nothing
 * else on the page notices.
 */
function wantsWebgl() {
  return document.documentElement.classList.contains('wants-scene');
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

  /* The sprite is 48 frames of a full rotation laid out 8 across, 6 down.
   * Setting a frame is one background-position write, which the compositor
   * handles without a layout or a paint of anything else.
   *
   * It was 30, and 12 degrees a step is visible as stepping on a ball this
   * size -- the panels jump rather than travel. 48 is 7.5 degrees and reads as
   * a turn. The grid is decided in tools/render-sprite.mjs, which prints these
   * two numbers and the stylesheet's background-size at the end of a render;
   * all three have to agree and nothing checks that they do. */
  const COLS = 8;
  const ROWS = 6;
  const FRAMES = COLS * ROWS;
  /* Every screen. The sprite is the fallback everywhere now rather than the
     hero of one device class, and a fallback that turns is worth having on a
     phone as much as on a laptop; phones are served a smaller sheet with the
     same 8x6 layout, so nothing below has to know which one is loaded. */
  const spriteActive = () => true;

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
  /* Decided before anything below reads it, and before the bundle is asked
   * for. It was declared further down and `driver` referred to it from up
   * here -- a const in its temporal dead zone, which throws on the first line
   * of the hero and which `node --check` cannot see because it is not a syntax
   * error. */
  const expectsScene = wantsWebgl();

  /* Shown from the first paint either way now. It used to be held at zero for
     anyone about to get the scene, on the reasoning that the sprite and the
     scene are two renderings of the same ball and swapping between them would
     read as the ball being replaced. That was written when they genuinely
     differed -- the sprite was the matte textured ball, the scene was glass.
     They have been rendered from the same GLB with the same material since, so
     there is nothing to give away, and holding it back meant the page opened
     on an empty stage for as long as the bundle took to arrive and compile. */
  if (object) object.style.opacity = '1';

  /* The scene path is handed the single still, not the sheet, so there are no
     frames to step through -- writing a background-position on a `contain`
     background would slide one picture around inside the box. */
  let driver = expectsScene ? () => {} : spriteFrame;
  const showFrame = (n) => driver(n);

  /* The scene's own progress. Null until the island is up, and null forever on
   * the sprite path — a background image cannot come apart or fly, so those
   * visitors get the same six chapters with the ball simply turning behind
   * them. */
  let setSceneProgress = null;

  /* The gate is asked once, above, and decides both things: whether the sprite
     is held back, and whether the bundle is fetched at all. Reading it in only
     one of those places is how a phone ended up downloading the scene. */
  (expectsScene ? mountWebglBall(section, pin) : Promise.resolve(null)).then((handle) => {
    if (!handle) {
      /* It was going to work and did not. Give the sprite back -- a turning
       * ball is a great deal better than the empty stage this was holding.
       *
       * Dropping the class is what starts the sheet downloading, and that is
       * the whole trade: the common path never pays for it, and this one waits
       * a moment longer for a fallback it was not going to need. */
      if (expectsScene) {
        /* Dropping the class swaps the still for the turning sheet, and hands
           the frame writes back to it. The still was never wrong, only
           motionless. */
        document.documentElement.classList.remove('wants-scene');
        driver = spriteFrame;
      }
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
  /* Spins up and settles, rather than appearing already turning.
   *
   * Written as a fraction of a revolution rather than as a frame count, so
   * changing FRAMES does not silently change how far the ball turns. It was a
   * bare -14, which at 30 frames was most of a half turn and at 48 would have
   * become a third of one. */
  const TURN = (fraction) => fraction * FRAMES;
  const spin = { f: -TURN(0.47) };
  intro
    /* Scale only when the scene is coming: `from` on opacity would tween the
       held-back sprite straight back to visible. */
    .from(object, { opacity: 0, scale: 0.82, duration: 1.4, ease: 'power2.out' }, 0)
    .to(spin, { f: 0, duration: 2.2, ease: 'power3.out', onUpdate: () => showFrame(spin.f) }, 0)
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
    [0, 0.08],       // ARVAND / SPORT
    [0.06, 0.2],     // 01 who we are      -- the ball turns
    [0.2, 0.34],     // 02 what we do      -- the strike
    [0.34, 0.52],    // 03 the match       -- down into the stadium
    [0.52, 0.68],    // 04 the read        -- the tactical take-apart
    [0.68, 0.86],    // 05 the reach       -- the globe
    [0.86, 1],       // the mark
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
   * little under half a revolution across the section, which reads as
   * deliberate rather than as a loop. Once the island is up this is a no-op,
   * because the mesh turns itself from the same progress. */
  const scrubbed = { f: 0 };
  exit.to(scrubbed, { f: TURN(0.45), duration: 1, ease: 'none', onUpdate: () => showFrame(scrubbed.f) }, 0);

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
      /* A turn and a half while it is in the air, over slightly longer than
         the arc, so it is still slowing as it lands rather than stopping dead
         at the top of the bounce. */
      .to(spinFrames, {
        f: dir * TURN(1.5),
        duration: 1.25,
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
