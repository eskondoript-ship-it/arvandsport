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

* **Hero** — masked per-letter title reveal, staggered tagline, dual-layer
  parallax on the stadium plate and the smoke overlay.
* **Scroll reveals** — batched `ScrollTrigger` entries for cards, services,
  people and offices; per-heading word masks.
* **Counters** — the four real figures (25 / 46 / 80 / 230) count up on entry.
* **Page transitions** — internal links are intercepted, the next document is
  fetched and its container swapped behind a wipe; `popstate` and prefetch on
  hover are handled. Any failure hands the navigation back to the browser.
* **Micro-interactions** — magnetic buttons, cursor-tracking tilt and radial
  highlight on service cards, hover-scaled media, an infinite partner marquee,
  a scroll-progress bar, and a header that hides going down and returns going up.
* **Roster filtering** — FLIP-style transforms so cards glide between layouts.

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

## Known constraints

* The hero background (`static/assets/img/ui/hero-bg.jpeg`, 1.9 MB) is the only
  size WordPress has for that image — no resized variant exists on the origin.
  Generating a WebP/AVIF set is the obvious next optimisation.
* "Former Clients" and "Coaches & Academy" are decorative image grids on the
  live site with no linked pages behind them; they are reproduced as such.
