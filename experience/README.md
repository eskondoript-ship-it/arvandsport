# The match ball experience

A scroll-driven WebGL set piece: the client's own thirty-two panel match ball,
struck by Mehdi Taremi, coming apart into a blueprint of itself.

It deploys to `/experience/` alongside the main site.

## Why this is a separate app

The site in the parent directory is a static generator with **no npm
dependencies at all** — CI runs `npm run build` with nothing installed, and
that is deliberate. React Three Fiber cannot live inside that: it needs React,
a bundler, and around half a megabyte of runtime.

So it lives here, in its own Next.js app with its own `package.json`, and is
statically exported into `dist/experience/` by the same Pages workflow. The
main site's build is untouched, and nobody visiting `arvandsport.com` pays for
three.js unless they open this page.

The weight is real and worth stating plainly: **about 700KB over the wire**,
against roughly 580KB for the whole of the main site on a phone. That is the
price of a real 3D runtime, and it is why this is one page rather than the
homepage.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static export into out/
npm run typecheck
```

`npm run model` regenerates `public/models/soccer-ball.glb` from the client's
OBJ in `../assets-src/`. You only need it if the source mesh changes.

## How it fits together

| File | What it does |
| --- | --- |
| `app/page.tsx` | Lenis, the fixed canvas, and three transparent 100vh sections that give the page its scroll height |
| `components/SoccerCanvas.tsx` | The R3F canvas: tone mapping, lighting, selective bloom, Taremi, and the fallback boundary |
| `components/SoccerModel.tsx` | The ball — geometry, the PBR-to-wireframe shader, and the GSAP scroll timeline |
| `components/BlueprintHUD.tsx` | Everything that is text: stat cards, crosshairs, chapter counters |
| `lib/scroll.ts` | The single scroll-progress source both the scene and the HUD read |
| `lib/taremi.ts` | The player data, copied from the repo's own content files |

### The timeline

One `ScrollTrigger` publishes a 0–1 progress value; the scene and the overlay
are both downstream of it, so they cannot disagree about where the page is.

- **0 → 30%** camera closes in, one full turn of the ball
- **30 → 70%** the strike: contact, flight, the shell opening along its seams,
  and the material crossing to a glowing neon wireframe
- **70 → 100%** camera round to the side, stat callouts active

### Things worth knowing before changing it

- **Progress is not React state.** It is a mutable object in `lib/scroll.ts`
  that `useFrame` reads directly. React only hears about the chapter changing —
  three times a page instead of a few hundred. Putting it in state re-renders
  the overlay on every scrubbed frame, and the overlay is the expensive half.
- **The wireframe is a shader, not `wireframe: true`.** It needs the `aBary`
  and `aEdge` attributes added in `withBarycentrics`, which must run before
  the geometry is un-indexed.
- **Every timeline lives in a `gsap.context()`.** React strict mode
  double-invokes effects; without the context you get two ScrollTriggers
  scrubbing the same object and a stutter that only appears in development.
- **No CDN assets.** The environment is built from lightformers rather than a
  fetched HDRI, because a static export on Pages should not depend on someone
  else's CDN being up.
- **The player data is sourced, not written.** Everything in `lib/taremi.ts`
  comes from `content/players.json` and `content/club-updates.json` in the
  parent repo, which carry their own sources. There are no season-by-season
  stats here because `content/careers.json` is still empty — the career shows
  as moves, which are published, rather than as per-season figures, which for
  these players are not. Do not fill that gap by estimating.
