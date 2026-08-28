# arvandsport.com — animated rebuild

A fully animated, statically generated rebuild of **Arvand Sport** (`arvandsport.com`),
a FIFA-licensed football and match agency. Tagline: *A STREAM TO SUCCESS*.

Every word, image and colour in this repository comes from the live WordPress
site. Nothing is invented, and the site has no products, cart or checkout —
because the real one has none.

---

## What was rebuilt

| Route | Source on the live site |
| --- | --- |
| `/` | Home (Elementor page 2336) — hero, about, stats, services, roster, former clients, coaches, team, latest news, partners, contact |
| `/player/` | Players index (page 2181), now with position / nationality / text filtering |
| `/player/<slug>/` | 11 player posts (category `player`, id 11) |
| `/news/` | News index (page 1716) with search |
| `/news/<slug>/` | 7 news posts (category `news`, id 1) |
| `/registration/` | Registration (page 1568) — the Elementor Pro form, wired to the same handler |
| `/author/arvand-admin/` | Author archive |
| `/category/news/`, `/category/player/` | Category archives |
| `/2024/`, `/2024/01/`, `/2025/`, `/2025/09/` | Date archives, one per period that actually has posts |
| `/404.html` | Not-found page |

Two legacy URLs are preserved as redirects rather than dropped:

* `/player/amir-roustae/` — how the live homepage links to Amir Roustaei (the
  live link is missing the slug's trailing `i`) → `/player/amir-roustaei/`
* `/profile-2/` — an orphaned WordPress page that renders the registration
  screen and carries no content of its own → `/registration/`

`sitemap.xml` and `robots.txt` are generated; canonical tags, Open Graph tags
and JSON-LD (`SportsOrganization`, `Person`, `NewsArticle`, `ItemList`, `Blog`)
are emitted per page.

## Where the content came from

The live site exposes an open WordPress REST API. Players and news are both
`post` records separated by category, not custom post types:

```
https://arvandsport.com/wp-json/wp/v2/posts?per_page=100   # 11 players + 7 news
https://arvandsport.com/wp-json/wp/v2/categories           # 1 = news, 11 = player
```

* `tools/extract.mjs` pulls posts from that API and writes `content/players.json`
  and `content/news.json`. It parses each player's bio list into typed fields
  (position group, club, citizenship, height, foot, contract dates …) so the
  roster can be filtered and the profile pages can render a real data table.
  Re-run it with `npm run extract` when the live site changes.
* `content/site.json` holds the parts of the homepage that live inside Elementor
  markup rather than the API — services, team bios, offices, partners, form ids.
  Each string is copied verbatim from the rendered page.

Brand values were read from the live Elementor kit (`elementor-kit-12`):

| Token | Value |
| --- | --- |
| Primary | `#003458` |
| Secondary | `#0F1C2A` |
| Accent | `#3E64FF` |
| Cyan | `#05EDFF` |
| Ice | `#ECFCFF` |
| Type | Roboto (self-hosted, same variable subsets the live site serves) |

Imagery — logo, favicon, hero, player cards, service icons, partner logos, team
and client portraits, article images — is downloaded from `wp-content/uploads`
into `static/assets/img/`.

## Forms

Both forms post to the **existing WordPress handler**, unchanged:

```
POST https://arvandsport.com/wp-admin/admin-ajax.php
action=elementor_pro_forms_send_form
post_id / form_id / referer_title / queried_id + form_fields[...]
```

The ids and field names in `content/site.json` are exactly the ones the live
markup submits (registration: post 1568, form `ff436cd`; footer subscribe:
post 95, form `2592ccd`), so submissions land in the same inbox. reCAPTCHA v3
is loaded lazily with the site's own key and its token is attached to the
request. If the request fails, the form says so and points at the office email
rather than silently swallowing the message.

Note: reCAPTCHA keys are domain-bound, and browsers apply CORS to a
cross-origin POST. Served from `arvandsport.com` itself this is a same-origin
request and works as-is; served from any other host, add that host to the
reCAPTCHA key's domain list and allow it in the WordPress CORS headers.

## Animation

GSAP 3.13 with ScrollTrigger and ScrollToPlugin, vendored under
`static/vendor/gsap/` (no CDN, no runtime third-party dependency).

### The strike sequence

A pinned, scroll-scrubbed set piece on the home page, built around the site's
own cutout of Mehdi Taremi. The visitor scrubs it themselves — 320% of viewport
height drives one timeline:

| Scrub | Stage |
| --- | --- |
| 0.00–0.18 | pitch markings draw themselves in (`stroke-dashoffset`), his name rises letter by letter |
| 0.18–0.38 | run-up — the figure drives in from the left, speed lines streak behind |
| 0.32–0.45 | plant, leap, invert — the figure articulates through its poses |
| 0.43–0.46 | contact — striking boot at the apex, flash on the ball |
| 0.45–0.72 | the strike — ball fires along a parabola, spinning 1080°, comet tail behind it |
| 0.66–0.85 | the net takes it — mesh ripples and settles on an elastic ease, shockwave ring expands |
| 0.84–1.00 | payoff — his real record counts up: 79 caps, 43 goals |

Two things worth knowing about how it is built:

* **The figure is original artwork, not footage.** The moving player is a
  stroke figure posed joint by joint through five hand-authored keyframes
  (`src/scripts/kicker.js`): approach, load, launch, strike, follow-through.
  The overhead kick was choreographed against a reference clip supplied by the
  client, but no frame, crop or trace of that footage is reproduced or shipped
  — the repository contains no broadcast imagery. The site's own studio
  portrait of Taremi stays in the copy panel, where it establishes who this is.
  `content/site.json` → `strike.image` is the single swap point for it.
* **The flight is measured, not guessed.** `flightX`/`flightY` read
  `offsetLeft`/`offsetTop` off the ball and the net's wrapper — layout values
  that transforms do not disturb — so the ball lands in the goal at any
  viewport size. (The net is wrapped in a `div` for exactly this reason: SVG
  elements have no `offset*` properties.) The values are functions, so
  `invalidateOnRefresh` re-measures them after a resize. The ball's rest
  position is derived in CSS from the figure's own geometry (`--fig-*` custom
  properties), so it sits on the striking boot at every viewport size rather
  than at a hand-tuned offset.

### Everything else

* **Hero** — masked per-letter title reveal, staggered tagline, dual-layer
  parallax on the stadium plate and smoke, and a blurred recede on exit.
* **Scroll reveals** — batched `ScrollTrigger` entries for cards, services,
  people and offices.
* **Text** — hand-rolled splitters in `src/scripts/text.js` (GSAP's SplitText is
  a Club plugin): word masks for headings, character staggers for page titles,
  measured line masks for body copy, and a character scramble on nav hover.
  Line wrappers are unwound once revealed, so text reflows normally afterwards.
* **Clip reveals** — figures wipe in behind a moving `clip-path` edge.
* **Deal-in cards** — service cards arrive from depth on a scrubbed `rotateX`.
* **Horizontal rail** — the former-clients row scrolls sideways while pinned.
* **Velocity effects** — scroll speed skews content slightly and drives the
  partner marquee, which speeds up and reverses with scroll direction.
* **Counters** — the four real figures (25 / 46 / 80 / 230) count up on entry.
  Scene-driven counters use `data-scrub-counter` so the generic handler does
  not also animate them.
* **Page transitions** — internal links are intercepted, the next document is
  fetched and its container swapped behind a wipe; `popstate` and hover
  prefetch are handled. Any failure hands the navigation back to the browser.
* **Pointer** — a custom two-part cursor that lags and swells over targets,
  magnetic buttons, cursor-tracking tilt and radial highlight on service cards.
* **Chrome** — scroll-progress bar, a header that hides going down and returns
  going up, drifting watermark behind player heroes.

### Motion safety

Three separate guarantees, because an animation that never finishes is worse
than no animation:

1. **No JS / no GSAP** — the CSS ships every element in its *finished* state.
   Nothing is hidden until `motion.js` has confirmed GSAP is present and motion
   is wanted, at which point it sets `.motion-ready` on `<html>`.
2. **`prefers-reduced-motion: reduce`** — no start states are ever applied, all
   durations collapse, the transition overlay and marquee are disabled, and
   flipping the OS setting mid-visit tears the animations down live.
3. **Stalled `requestAnimationFrame`** (background tabs, some headless
   renderers) — a plain `setTimeout` probe checks after 4 s whether GSAP's
   ticker actually advanced; if not, `.motion-failsafe` is set and every page
   snaps to its finished state. Hidden tabs are skipped and re-checked on
   `visibilitychange`, so a legitimately backgrounded tab still gets its intro.
   Teardown uses `kill(true)`, which reverts pinning — a stalled scene can
   never leave its pin spacer behind as a block of empty page.

## Repository layout

```
content/       real content, extracted from the live site (JSON)
tools/         extract.mjs (crawler), build.mjs (generator), serve.mjs (dev server)
src/templates/ page templates — plain ES modules returning HTML strings
src/styles/    tokens, base, motion, layout, components, pages (concatenated)
src/scripts/   env, motion, header, roster, forms, transitions, main (ES modules)
static/        images, fonts, vendored GSAP — copied verbatim into dist/
dist/          generated output, committed so the site can be served directly
```

## Build

No dependencies. Node 18+.

```bash
npm run build     # regenerate dist/
npm run dev       # build, then serve dist/ on http://localhost:4173
npm run extract   # re-pull content from the live WordPress API
```

`dist/` is a plain static tree — deployable to any static host. Directory-style
URLs (`/player/mehdi-taremi/`) resolve via `index.html`, so no server rules are
needed; point 404s at `dist/404.html`.

### Paths are relative

Templates are authored with site-absolute URLs (`/assets/…`, `/player/…`)
because that is what they mean, but the generator rewrites them to paths
relative to each page as it writes. The output therefore works unchanged at a
domain root (`arvandsport.com/player/`), under any prefix (a GitHub Pages
project site at `/arvandsport/player/`), and straight off disk over `file://` —
with no base-path flag to set at build time.

Two deliberate exceptions:

* Canonical, Open Graph and JSON-LD URLs stay absolute and keep naming
  `arvandsport.com`, so a preview deploy never competes with the real site.
* `404.html` stays site-absolute. The host serves it for a missing path at any
  depth, so no single relative prefix can be right; absolute is correct on the
  real domain and merely unstyled on a subpath preview.

Because the header sits outside the container that page transitions swap, its
relative links would otherwise still describe the previous page's depth after a
client-side navigation. `syncChrome()` copies the freshly fetched document's
header hrefs across on every swap.

### GitHub Pages

`.github/workflows/pages.yml` builds and publishes `dist/`. It only takes
effect once **Settings → Pages → Source** is set to **GitHub Actions**. While
the source is a branch, Pages serves the repository root through Jekyll and
renders this README instead of the site.

## Known constraints

* The hero background (`static/assets/img/ui/hero-bg.jpeg`, 1.9 MB) is the only
  size WordPress has for that image — no resized variant exists on the origin.
  Generating a WebP/AVIF set is the obvious next optimisation.
* "Former Clients" and "Coaches & Academy" are decorative image grids on the
  live site with no linked pages behind them; they are reproduced as such.
