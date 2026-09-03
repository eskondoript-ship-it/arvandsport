---
name: story-check
description: Verify the arvandsport homepage's scroll story in a real browser — the sticky hero stage, the three chapters, the WebGL gate, the stat column, and that the sections below survive. Use this after ANY change to src/scripts/apex.js, src/templates/apex.mjs, src/templates/spotlight.mjs, the .apex or .spot blocks in src/styles/pages.css, experience/lib/choreography.ts, or the hero bundle — and whenever asked to check, verify, test or screenshot the homepage, the hero, the ball, or the scroll animation. Reading the HTML cannot tell you whether any of it works; this scrolls the page and looks.
---

# Checking the homepage story

The hero is four viewport-heights of `position: sticky` stage carrying three
chapters of copy, a WebGL island that only some visitors are sent, and a stat
column that must appear on the last chapter and nowhere else. Every one of
those is a function of scroll position and half of them are drawn on a canvas,
so none of it can be confirmed by reading markup. Run the page.

## The command

```bash
cd /home/user/arvandsport
npm run build                                    # the harness reads dist/, not src/
node .claude/skills/story-check/scripts/verify-story.mjs
```

It exits non-zero if either viewport fails, so it works in a chain.

To keep screenshots — worth doing whenever the change was visual, because the
checks below say "the stat column is visible", not "the stat column looks
right":

```bash
node .claude/skills/story-check/scripts/verify-story.mjs dist /tmp/story
```

Then look at them. `desktop-98.png` is the last chapter and the one most
changes affect.

If playwright is not resolvable from the repo, point the script at a copy:

```bash
PLAYWRIGHT_PATH=/path/to/node_modules/playwright/index.mjs \
  node .claude/skills/story-check/scripts/verify-story.mjs
```

## Reading the output

Each viewport prints a row per sample and then six verdicts:

```
   45%  chapters [0 0 1 0]  rail 1  count 045  stats 0  pinTop 0  webgl true
  stage stays stuck across the whole 2700px story: true
  chapters crossfade: true
  rail tracks the acts: true
  stat cards only on chapter three: true
  webgl gate correct (want true): true
  sections kept below: all present
  errors: none
```

What each one is protecting against, because a failure is much easier to fix
when you know what it was watching for:

- **stage stays stuck** — `pinTop` is the sticky stage's distance from the top
  of the viewport, and it must be 0 at every sample. Anything but 0 means
  sticky has stopped working, which on this page is almost always an
  `overflow` other than `visible` on an ancestor. That kills `position: sticky`
  silently and there is no console warning for it.
- **chapters crossfade** — exactly one chapter is lit at a time, the first at
  the top and the last at the bottom. Catches a timeline whose duration is not
  what you assumed: GSAP's is where its *last tween ends*, not 1, so a story
  can quietly compress into the first three-quarters of its own section.
- **rail tracks the acts** — the index down the side follows the same three
  windows the scene does.
- **stat cards only on chapter three** — they must be invisible at the top.
- **webgl gate correct** — the desktop run expects the island, the phone run
  expects it never to arrive. This is the one that catches a gate change
  sending 371KB of three.js to phones, which costs nothing visible and is the
  whole reason the gate exists.
- **sections kept below** — a sticky stage that covers the rest of the page
  passes every other check on this list.

## When it fails

Take the screenshots and look before changing anything. Most failures here are
one of a handful of things, all of which look obvious in a picture and cryptic
in the numbers:

- An inline style beating a stylesheet rule. The intro tween leaves inline
  opacity on elements it touched, and no CSS rule outranks that.
- A `filter` on an element that also carries a 3D transform — a filter forces
  `transform-style: flat`, so the 3D silently collapses.
- Something else already owning the same `data-` attribute. `scenes.js` claims
  `[data-rail]` for the Our Team page; two systems driving one element move it
  at neither one's rate.

## Do not write a second harness

The most expensive mistake available here is scrolling with `window.scrollTo`.
Lenis owns the scroll position and snaps a raw `scrollTo` straight back, so
such a harness reports `pinTop 0` and identical readings at every offset — it
looks like a pass, and it has measured the top of the page five times. The
script scrolls through `window.lenis`. If you need a variation, copy this
script and keep that part.
