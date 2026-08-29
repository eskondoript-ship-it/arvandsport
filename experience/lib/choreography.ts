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
 * The three acts, unchanged:
 *
 *   0 → 30%    the camera closes in, one full turn of the ball
 *   30 → 70%   the strike: contact, flight, the shell opening along its seams,
 *              and the material crossing to a glowing neon wireframe
 *   70 → 100%  the camera comes round to the side, callouts active
 */

export type SceneState = {
  /** One full revolution over the approach. */
  spin: number;
  /** Camera closing in. */
  dolly: number;
  /** Contact and flight. */
  kick: number;
  /** How far the panels have travelled outward. */
  explode: number;
  /** Shaded surface at 0, glowing wireframe at 1. */
  wire: number;
  /** The camera's swing round to the detail. */
  detail: number;
};

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

/** A window of the timeline, remapped to 0..1. */
const span = (progress: number, start: number, length: number) =>
  clamp01((progress - start) / length);

/** GSAP's power2.out, which is what the kick was authored with. */
const power2Out = (t: number) => 1 - (1 - t) ** 2;

export function sceneState(progress: number): SceneState {
  const p = clamp01(progress);
  const approach = span(p, 0, 0.3);
  return {
    spin: approach,
    dolly: approach,
    kick: power2Out(span(p, 0.3, 0.4)),
    explode: span(p, 0.36, 0.34),
    wire: span(p, 0.34, 0.3),
    detail: span(p, 0.7, 0.3),
  };
}

/**
 * How far each panel travels outward at full explode, in ball radii.
 *
 * Tuned for the four-panel ball: a quarter-shell is a much bigger piece than a
 * hexagon and covers a lot of frame on its way out, so it parts less far than
 * the thirty-two small panels did.
 */
export const EXPLODE_DISTANCE = 0.62;

/** Which of the three chapters a given progress sits in. */
export function chapterFor(progress: number): number {
  if (progress < 0.3) return 0;
  if (progress < 0.7) return 1;
  return 2;
}
