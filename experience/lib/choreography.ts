/**
 * Where everything in the scene is, at a given point in the scroll.
 *
 * One pure function of progress, and the only description of the choreography
 * anywhere. Two very different hosts run this scene — the study at
 * /experience/, and the island embedded in the site's own homepage hero — and
 * the whole point of the user asking for it "exactly" is that they are the same
 * thing. Two copies of these numbers would not stay the same thing for a week.
 *
 * It was a GSAP timeline before, scrubbed by a ScrollTrigger inside the
 * component. That works when the component owns its own scroll and does not
 * when something else does, so the easing curves are written out here instead
 * and the hosts just say how far along they are. It also takes GSAP out of the
 * homepage bundle, which it was otherwise being carried into for four tweens.
 *
 * The six beats, over one scroll:
 *
 *   0 → 16%    the ball turns and the camera closes in
 *   16 → 32%   the strike: the ball compresses, the ring goes, and it leaves
 *              on an arc
 *   32 → 50%   the camera follows it down into a stadium, which builds itself
 *              out of the ground around it
 *   50 → 66%   the shell opens along its seams and the ball crosses to a
 *              tactical read of itself -- wireframe, panels apart, measured
 *   66 → 84%   the pieces gather back into a globe, lit from inside
 *   84 → 100%  the globe collapses to a point, and the mark is what is left
 *
 * The beats overlap on purpose. A scene that finished one move before starting
 * the next would read as six animations played in a row; the strike is still
 * settling as the stadium starts coming up, and the globe is already gathering
 * before the tactical read has finished being taken apart.
 */

export type SceneState = {
  /** The opening turn, and the camera closing in with it. */
  spin: number;
  /** Camera closing in. Kept separate from spin: the camera eases, the ball does not. */
  dolly: number;
  /** The moment of contact: rises and falls across its own short window. */
  contact: number;
  /**
   * The same moment, but running one way only.
   *
   * The impact ring needs to expand and fade, and both of those are monotonic.
   * Driven off the `contact` pulse it was brightest at its smallest -- which is
   * inside the ball -- and largest once it had already faded out, so it was
   * never actually seen.
   */
  struck: number;
  /** The flight away from the boot. */
  kick: number;
  /** The descent into the bowl -- the camera following the ball down. */
  arrive: number;
  /** How far the bowl has been built, floor to roof. */
  build: number;
  /** How far the panels have travelled outward. */
  explode: number;
  /** Shaded surface at 0, glowing wireframe at 1. */
  wire: number;
  /** The tactical read: callouts live, the ball measured rather than shown. */
  detail: number;
  /** The pieces gathering back into a sphere, and the sphere lighting up. */
  globe: number;
  /** The globe closing to a point, and the mark taking its place. */
  collapse: number;
};

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

/** A window of the timeline, remapped to 0..1. */
const span = (progress: number, start: number, length: number) =>
  clamp01((progress - start) / length);

/** GSAP's power2.out, which is what the kick was authored with. */
const power2Out = (t: number) => 1 - (1 - t) ** 2;

/**
 * A pulse: nought, up to one, back to nought across the window.
 *
 * The strike used to be derived from the first twelve percent of `kick`, which
 * over the whole page was about ninety pixels of scroll out of five thousand.
 * The compression, the flash and the impact ring all lived in there, so unless
 * a visitor happened to stop on exactly those ninety pixels the ball was
 * simply already in flight and nothing had visibly hit it.
 */
const pulse = (t: number) => Math.sin(clamp01(t) * Math.PI);

/** GSAP's power3.inOut, for the camera moves that have to settle. */
const power3InOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

export function sceneState(progress: number): SceneState {
  const p = clamp01(progress);
  const approach = span(p, 0, 0.16);
  return {
    spin: approach,
    dolly: approach,
    /* Contact opens beat two. Both windows start together and `contact` is two
       thirds the length of `struck`, which is not decoration: it puts the peak
       of the pulse at struck 0.33, and Boot.tsx places the boot on the ball at
       exactly that number. Change one length without the other and the boot
       swings through empty space again.

       Lengthened from 0.05 and 0.075 -- the strike went past faster than it
       could be read. */
    contact: pulse(span(p, 0.185, 0.08)),
    struck: span(p, 0.185, 0.12),
    /* Linear, not eased out.
     *
     * A struck ball takes its whole velocity at contact and then travels at
     * very nearly constant speed -- the deceleration a power2Out describes is
     * what a thrown ball does at the top of its arc, not what a kicked one does
     * leaving the boot. Coming almost straight down the camera axis, constant
     * world speed is also what makes it appear to accelerate: perspective does
     * that on its own, and easing out cancelled it, so the ball drifted forward
     * and stopped instead of arriving. */
    kick: span(p, 0.2, 0.19),
    /* Eased at both ends: the camera is chasing something, and a chase that
       starts and stops at a constant rate reads as a slide. */
    arrive: power3InOut(span(p, 0.3, 0.2)),
    build: span(p, 0.34, 0.16),
    explode: span(p, 0.5, 0.14),
    wire: span(p, 0.48, 0.12),
    detail: span(p, 0.5, 0.16),
    /* Starts before the tactical read is done, so the pieces are already being
       drawn back together while the callouts are still up. */
    globe: power3InOut(span(p, 0.63, 0.19)),
    collapse: power3InOut(span(p, 0.84, 0.16)),
  };
}

/**
 * How far each panel travels outward at full explode, in ball radii.
 *
 * Far enough that the ball comes fully apart. The reference this scene follows
 * takes its camera all the way to pieces -- the elements end up separated by
 * clear space, laid out as an exploded diagram rather than a cracked object --
 * and a shell that only gapes is the least convincing point on that journey.
 * At 1.75 radii the four quarters clear each other completely and you can see
 * straight through the middle of the ball.
 *
 * The camera has to give ground to match: see the explode term in
 * SoccerModel's range, which pulls back further than the pieces travel.
 */
export const EXPLODE_DISTANCE = 1.75;

/** Which of the three chapters a given progress sits in. */
export function chapterFor(progress: number): number {
  if (progress < 0.3) return 0;
  if (progress < 0.7) return 1;
  return 2;
}
