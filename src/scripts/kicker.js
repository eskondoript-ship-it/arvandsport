/**
 * Poses the stroke figure through an overhead kick.
 *
 * The motion is original artwork. It was choreographed against a reference
 * clip the client supplied, but nothing from that footage is reproduced here —
 * these are hand-authored joint coordinates in the figure's own 200×200 space.
 *
 * A pose names the endpoints of each limb segment plus the head centre.
 * Segments share endpoints (a shin starts where its thigh ends), so posing is
 * a matter of moving joints and letting the strokes follow.
 */

/** @typedef {{head:[number,number], neck:[number,number], hip:[number,number],
 *   elbowNear:[number,number], handNear:[number,number],
 *   elbowFar:[number,number], handFar:[number,number],
 *   kneeNear:[number,number], footNear:[number,number],
 *   kneeFar:[number,number], footFar:[number,number]}} Pose */

/** @type {Record<string, Pose>} */
export const POSES = {
  /* Running in, leaning forward. */
  approach: {
    head: [96, 44], neck: [98, 60], hip: [102, 106],
    elbowNear: [116, 78], handNear: [126, 96],
    elbowFar: [84, 80], handFar: [76, 62],
    kneeNear: [116, 132], footNear: [126, 162],
    kneeFar: [90, 136], footFar: [78, 168],
  },
  /* Plant and load — weight down, arms starting to drive up. */
  load: {
    head: [92, 58], neck: [95, 74], hip: [102, 116],
    elbowNear: [112, 96], handNear: [116, 118],
    elbowFar: [80, 96], handFar: [72, 116],
    kneeNear: [116, 142], footNear: [108, 172],
    kneeFar: [92, 146], footFar: [84, 174],
  },
  /* Leaving the ground, torso rotating back. */
  launch: {
    head: [80, 66], neck: [88, 78], hip: [112, 104],
    elbowNear: [96, 104], handNear: [86, 124],
    elbowFar: [78, 92], handFar: [58, 92],
    kneeNear: [130, 84], footNear: [130, 52],
    kneeFar: [126, 132], footFar: [148, 152],
  },
  /* Inverted, striking leg whipping over the top. Contact. */
  strike: {
    head: [54, 152], neck: [70, 140], hip: [122, 106],
    elbowNear: [58, 112], handNear: [34, 96],
    elbowFar: [82, 170], handFar: [64, 188],
    /* Striking leg fully extended overhead — the boot is the highest point
     * of the figure, and the ball rests exactly there. */
    kneeNear: [136, 70], footNear: [130, 24],
    /* Trailing leg tucked in so the silhouette reads as a scissor, not a fall. */
    kneeFar: [136, 128], footFar: [166, 116],
  },
  /* Legs scissor past, body still falling. */
  follow: {
    head: [52, 158], neck: [68, 148], hip: [118, 118],
    elbowNear: [58, 124], handNear: [38, 116],
    elbowFar: [80, 172], handFar: [64, 190],
    kneeNear: [128, 96], footNear: [96, 74],
    kneeFar: [150, 138], footFar: [178, 122],
  },
};

/** Which two joints each drawn segment runs between. */
const SEGMENTS = {
  torso: ['neck', 'hip'],
  armNear: ['neck', 'elbowNear'],
  foreNear: ['elbowNear', 'handNear'],
  armFar: ['neck', 'elbowFar'],
  foreFar: ['elbowFar', 'handFar'],
  legNear: ['hip', 'kneeNear'],
  shinNear: ['kneeNear', 'footNear'],
  legFar: ['hip', 'kneeFar'],
  shinFar: ['kneeFar', 'footFar'],
};

/**
 * Apply a pose immediately.
 * @param {SVGElement} svg the figure
 * @param {Pose} pose
 */
export function setPose(svg, pose) {
  for (const [name, [from, to]] of Object.entries(SEGMENTS)) {
    const line = svg.querySelector(`[data-joint="${name}"]`);
    if (!line) continue;
    line.setAttribute('x1', pose[from][0]);
    line.setAttribute('y1', pose[from][1]);
    line.setAttribute('x2', pose[to][0]);
    line.setAttribute('y2', pose[to][1]);
  }
  const head = svg.querySelector('[data-joint="head"]');
  if (head) {
    head.setAttribute('cx', pose.head[0]);
    head.setAttribute('cy', pose.head[1]);
  }
}

/**
 * Add a tween from the figure's current pose to `pose` onto a timeline.
 *
 * Every segment is tweened as SVG attributes rather than transforms, so limbs
 * genuinely change length and angle the way a posed figure does.
 *
 * @param {gsap.core.Timeline} timeline
 * @param {object} gsap the GSAP instance
 * @param {SVGElement} svg
 * @param {Pose} pose
 * @param {number} position timeline position
 * @param {number} duration
 * @param {string} ease
 */
export function poseTo(timeline, gsap, svg, pose, position, duration, ease = 'power2.inOut') {
  for (const [name, [from, to]] of Object.entries(SEGMENTS)) {
    const line = svg.querySelector(`[data-joint="${name}"]`);
    if (!line) continue;
    timeline.to(
      line,
      { attr: { x1: pose[from][0], y1: pose[from][1], x2: pose[to][0], y2: pose[to][1] }, duration, ease },
      position,
    );
  }
  const head = svg.querySelector('[data-joint="head"]');
  if (head) {
    timeline.to(head, { attr: { cx: pose.head[0], cy: pose.head[1] }, duration, ease }, position);
  }
}

/** Where the striking boot is in figure space, for lining the ball up. */
export const BOOT = (pose) => pose.footNear;
