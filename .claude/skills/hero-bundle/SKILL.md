---
name: hero-bundle
description: Build, typecheck and size-check the arvandsport WebGL hero — the React Three Fiber island in experience/ that the homepage loads. Use this after ANY edit to a .ts or .tsx file under experience/ (SoccerCanvas, SoccerModel, lib/ball, lib/choreography, hero/index), and whenever asked to build the hero, the scene, the ball, the island or the R3F app, or to check the bundle size. Editing the TypeScript alone changes nothing a visitor sees — the site loads a bundle that has to be rebuilt.
---

# Building the hero island

`experience/` is a Next.js + React Three Fiber app, but the site does not load
the Next app. It loads a single esbuild bundle of the island, written to
`experience/dist-hero/hero.js`, which the site build then copies into
`dist/assets/hero/`. So a `.tsx` edit reaches a visitor only after two builds,
and running the site build alone will happily ship the previous bundle with no
warning at all.

## The order, and why it is this order

```bash
cd /home/user/arvandsport/experience
npx tsc --noEmit          # 1. types
npm run build:hero        # 2. the island the site actually loads
cd ..
npm run build             # 3. the site, which copies the bundle in
npm test                  # 4. every internal link and asset still resolves
```

Step 1 first because esbuild does not typecheck — it will bundle code with type
errors quite happily, and the failure then arrives as a blank canvas.

Step 3 is not optional. `dist/` is committed in this repo, so an unbuilt site
means the commit ships the old bundle.

`npm run build` in `experience/` (the Next export) is **not** part of this. It
built the standalone page at `/experience/`, which has been removed; running it
only wastes a minute.

## The size ceiling

`build:hero` prints the bundle and fails over 420KB gzipped:

```
hero bundle: 1321KB raw, 371KB gzipped -> dist-hero/hero.js
```

The ceiling is not arbitrary. React, react-dom and three are what React Three
Fiber costs, and this is already more than the entire rest of the site put
together — which is why the bundle goes only to desktops with a working WebGL2
context and is fetched after first paint. If a change pushes it over, the
question is what was added, not what the ceiling should be. Adding a drei
helper is the usual cause; most of them pull in more than they look like.

## After building, check it moved

A green build says the bundle compiled, not that the scene works. The island is
drawn on a canvas, so nothing about it can be confirmed by reading output —
use the `story-check` skill, which scrolls the real page and looks.

## Things about this app that are easy to get wrong

- **No `useGLTF.preload()` at module scope.** It runs when the module is
  evaluated, which is before the homepage has called `setAssetBase`, so the
  preload fetches from the wrong place and 404s on every desktop load. The real
  load then happens a moment later and works, which is what makes it easy to
  miss.
- **`process.env` needs defining.** The bundle runs in a browser;
  `experience/scripts/build-hero.mjs` replaces `NODE_ENV` and
  `NEXT_PUBLIC_BASE_PATH`. A new one that is read at runtime and not declared
  there is a `process is not defined` at mount.
- **The choreography is shared.** `experience/lib/choreography.ts` is the one
  description of the story as a function of scroll progress. The copy that runs
  over it lives in `content/site.json`. Change the timings in one place only.
- **No StrictMode in the island.** It double-mounts, and this scene builds
  geometry on mount.
