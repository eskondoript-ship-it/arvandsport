/**
 * Static site generator for arvandsport.com.
 *
 * Reads content/*.json (real content pulled from the live WordPress install by
 * tools/extract.mjs) and writes a fully static dist/ that mirrors the live
 * URL structure, so no existing link or indexed URL changes.
 */
import { readFile, writeFile, mkdir, rm, cp, readdir, stat } from 'node:fs/promises';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const site = JSON.parse(await readFile(join(ROOT, 'content/site.json'), 'utf8'));
const players = JSON.parse(await readFile(join(ROOT, 'content/players.json'), 'utf8'));
const news = JSON.parse(await readFile(join(ROOT, 'content/news.json'), 'utf8'));
const feed = JSON.parse(await readFile(join(ROOT, 'content/feed.json'), 'utf8'));
const careers = JSON.parse(await readFile(join(ROOT, 'content/careers.json'), 'utf8'));
const clubUpdates = JSON.parse(await readFile(join(ROOT, 'content/club-updates.json'), 'utf8'));

/* The scraped club is frozen at whatever the live site said when the extractor
 * last ran, and several were years stale. Corrections live in their own file
 * with a source against each, and are folded in here so every template — card,
 * dossier, facts table, search index — sees one club and cannot disagree with
 * itself. The bio row keeps the same treatment for the same reason. */
for (const player of players) {
  const update = clubUpdates.players?.[player.slug];
  if (!update?.club || update.club === player.club) continue;
  const previous = player.club;
  player.club = update.club;
  player.clubSource = update.source;
  for (const row of player.bio || []) {
    if (row.label === 'Current club' && row.value === previous) row.value = update.club;
  }
}

/* Which WebP derivatives actually exist, so picture() cannot reference one
 * that was never generated. Keyed by the image's site-absolute stem. */
const { setImageManifest } = await import('../src/templates/partials.mjs');
const derivatives = new Map();
for (const rel of await walk(join(ROOT, 'static/assets/img'))) {
  const m = /^(.*)-(\d+)\.webp$/.exec(rel.split(sep).join('/'));
  if (!m) continue;
  const stem = `/assets/img/${m[1]}`;
  if (!derivatives.has(stem)) derivatives.set(stem, new Set());
  derivatives.get(stem).add(Number(m[2]));
}
setImageManifest(derivatives);

const { renderHome } = await import('../src/templates/home.mjs');
const { renderPlayerIndex, renderPlayer } = await import('../src/templates/players.mjs');
const { renderNewsIndex, renderArticle } = await import('../src/templates/news.mjs');
const { renderRegistration } = await import('../src/templates/registration.mjs');
const { renderArchive } = await import('../src/templates/archive.mjs');
const { renderNotFound } = await import('../src/templates/notfound.mjs');
const { renderRedirect } = await import('../src/templates/redirect.mjs');
const { renderServices, renderAbout, renderContact } = await import('../src/templates/pages.mjs');

const ctx = { site, players, news, feed };

/* --------------------------------------------------------------- helpers */

/**
 * Rewrite the site-absolute URLs the templates emit into paths relative to the
 * page being written.
 *
 * Templates are authored with `/assets/...` and `/player/...` because that is
 * what they mean, but the output has to survive being served from a subpath —
 * a GitHub Pages project site lives at `/<repo>/`, and the same tree may be
 * opened straight off disk. Relative paths work at the domain root, under any
 * prefix, and from file:// with no build flag to remember.
 *
 * Absolute `https://arvandsport.com/...` URLs are deliberately untouched:
 * canonical tags, Open Graph and JSON-LD must keep naming the real origin.
 */
/* Deploy prefix for the 404 page only, e.g. "/arvandsport/". Normalised so
 * the workflow can pass it with or without surrounding slashes. */
const BASE_PATH = (() => {
  const raw = (process.env.BASE_PATH || '').trim();
  if (!raw || raw === '/') return '/';
  return `/${raw.replace(/^\/+|\/+$/g, '')}/`;
})();

function relativise(html, route) {
  /* The 404 page is served by the host for *any* missing path, at any depth,
   * so no relative prefix is correct for it and it stays site-absolute. That
   * is right at a domain root but breaks under a subpath, where `/assets/...`
   * resolves above the site and the page loads with no CSS at all — which is
   * exactly how it is served on a Pages project site. BASE_PATH names that
   * prefix (the workflow passes the repo name); unset, this is a no-op and
   * the output is byte-identical to the domain-root form. */
  if (route === '/404.html') {
    if (BASE_PATH === '/') return html;
    return html.replace(
      /\b(href|src)="\/([^"/][^"]*)?"/g,
      (_m, attr, path = '') => `${attr}="${BASE_PATH}${path}"`,
    );
  }

  /* '/' -> './', '/news' -> '../', '/player/mehdi-taremi' -> '../../' */
  const depth = route.split('/').filter(Boolean).length;
  const base = depth === 0 ? './' : '../'.repeat(depth);

  const toRelative = (path) => {
    const rest = path.replace(/^\//, '');
    return rest ? base + rest : base;
  };

  /* srcset is a comma-separated list of "url descriptor" pairs, so it needs
   * its own pass — the href/src rewrite below does not see inside it. Missing
   * this shipped a <picture> whose <img> fallback was correctly relative but
   * whose WebP sources were still site-absolute: fine at a domain root, and a
   * 404 for every source under the Pages prefix, which is every browser that
   * supports WebP. */
  const relativiseSrcset = (value) =>
    value
      .split(',')
      .map((part) => {
        const bit = part.trim();
        if (!bit.startsWith('/')) return bit;
        const [url, ...rest] = bit.split(/\s+/);
        return [toRelative(url), ...rest].join(' ');
      })
      .join(', ');

  return html
    .replace(/\bsrcset="([^"]*)"/g, (_m, value) => `srcset="${relativiseSrcset(value)}"`)
    .replace(/\b(href|src)="\/([^"]*)"/g, (_m, attr, path) => `${attr}="${toRelative('/' + path)}"`)
    /* <meta http-equiv="refresh" content="0; url=/registration/"> */
    .replace(/(content="\d+;\s*url=)\/([^"]*)"/g, (_m, head, path) => `${head}${toRelative('/' + path)}"`)
    /* location.replace("/registration/") in the redirect stubs */
    .replace(/(location\.replace\(")\/([^"]*)"/g, (_m, head, path) => `${head}${toRelative('/' + path)}"`);
}

async function emit(route, html) {
  const file = route === '/404.html' ? join(DIST, '404.html') : join(DIST, route, 'index.html');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, relativise(html, route));
  return route;
}

async function walk(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, base)));
    else out.push(relative(base, full));
  }
  return out;
}

/** Concatenate the stylesheet parts in a deterministic, meaningful order. */
const CSS_ORDER = [
  'tokens.css',
  'base.css',
  'motion.css',
  'layout.css',
  'components.css',
  'pages.css',
];

async function buildCss() {
  const parts = [];
  for (const name of CSS_ORDER) {
    parts.push(`/* ===== ${name} ===== */`);
    parts.push(await readFile(join(ROOT, 'src/styles', name), 'utf8'));
  }
  await mkdir(join(DIST, 'assets/css'), { recursive: true });
  await writeFile(join(DIST, 'assets/css/main.css'), parts.join('\n\n'));
}

/* ------------------------------------------------------------------ pages */

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

const routes = [];

routes.push(await emit('/', renderHome(ctx)));
routes.push(await emit('/player', renderPlayerIndex(ctx)));
for (const player of players) {
  routes.push(await emit(`/player/${player.slug}`, renderPlayer({ ...ctx, player, careers })));
}
routes.push(await emit('/news', renderNewsIndex(ctx)));
for (const article of news) {
  routes.push(await emit(`/news/${article.slug}`, renderArticle({ ...ctx, article })));
}
routes.push(await emit('/services', renderServices(ctx)));
routes.push(await emit('/about', renderAbout(ctx)));
routes.push(await emit('/contact', renderContact(ctx)));
routes.push(await emit('/registration', renderRegistration(ctx)));

/* Author archive — the live site exposes /author/arvand-admin/. */
routes.push(
  await emit(
    '/author/arvand-admin',
    renderArchive({
      ...ctx,
      heading: 'Arvand-admin',
      kicker: 'Author archive',
      posts: news,
      canonicalPath: '/author/arvand-admin/',
    }),
  ),
);

/* Category archives, as WordPress publishes them. */
routes.push(
  await emit(
    '/category/news',
    renderArchive({ ...ctx, heading: 'News', kicker: 'Category', posts: news, canonicalPath: '/category/news/' }),
  ),
);
routes.push(
  await emit(
    '/category/player',
    renderArchive({
      ...ctx,
      heading: 'Player',
      kicker: 'Category',
      posts: players.map((p) => ({
        title: p.name,
        url: p.url,
        image: p.image,
        date: p.date,
        excerpt: [p.position.detail, p.club].filter(Boolean).join(' · '),
      })),
      canonicalPath: '/category/player/',
    }),
  ),
);

/* Date archives, one per year and per year/month that actually has posts. */
const allPosts = [
  ...news.map((n) => ({ title: n.title, url: n.url, image: n.image, date: n.date, excerpt: n.excerpt })),
  ...players.map((p) => ({
    title: p.name,
    url: p.url,
    image: p.image,
    date: p.date,
    excerpt: [p.position.detail, p.club].filter(Boolean).join(' · '),
  })),
].sort((a, b) => (a.date < b.date ? 1 : -1));

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const byYear = new Map();
const byMonth = new Map();
for (const post of allPosts) {
  const [y, m] = post.date.split('T')[0].split('-');
  if (!byYear.has(y)) byYear.set(y, []);
  byYear.get(y).push(post);
  const key = `${y}/${m}`;
  if (!byMonth.has(key)) byMonth.set(key, []);
  byMonth.get(key).push(post);
}
for (const [year, posts] of byYear) {
  routes.push(
    await emit(`/${year}`, renderArchive({ ...ctx, heading: year, kicker: 'Archive', posts, canonicalPath: `/${year}/` })),
  );
}
for (const [key, posts] of byMonth) {
  const [year, month] = key.split('/');
  routes.push(
    await emit(`/${key}`, renderArchive({
      ...ctx,
      heading: `${MONTHS[Number(month) - 1]} ${year}`,
      kicker: 'Archive',
      posts,
      canonicalPath: `/${key}/`,
    })),
  );
}

/* URL preservation: two live URLs that must keep resolving.
 * - /player/amir-roustae/ is how the homepage roster links to Amir Roustaei
 *   (the live link drops the trailing "i" of the post slug).
 * - /profile-2/ is an orphaned WordPress page that renders the registration
 *   screen; it carries no content of its own. */
routes.push(await emit('/player/amir-roustae', renderRedirect({ ...ctx, to: '/player/amir-roustaei/' })));
routes.push(await emit('/profile-2', renderRedirect({ ...ctx, to: '/registration/' })));

await emit('/404.html', renderNotFound(ctx));

/* ------------------------------------------------------------ static + css */

await buildCss();
await cp(join(ROOT, 'static'), DIST, { recursive: true });
await mkdir(join(DIST, 'assets/js'), { recursive: true });
await cp(join(ROOT, 'src/scripts'), join(DIST, 'assets/js'), { recursive: true });

/* --------------------------------------------------------- sitemap / robots */

const origin = site.brand.url;
const lastmod = (route) => {
  if (route === '/') return news[0].modified;
  const player = players.find((p) => p.url === `${route}/`);
  if (player) return player.modified;
  const article = news.find((n) => n.url === `${route}/`);
  if (article) return article.modified;
  return news[0].modified;
};
const indexable = routes.filter((r) => !['/player/amir-roustae', '/profile-2'].includes(r));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexable
  .map((r) => {
    const loc = r === '/' ? `${origin}/` : `${origin}${r}/`;
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod(r).split('T')[0]}</lastmod>\n  </url>`;
  })
  .join('\n')}
</urlset>
`;
await writeFile(join(DIST, 'sitemap.xml'), sitemap);

await writeFile(
  join(DIST, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
);

/* ------------------------------------------------------- WebGL experience */

/**
 * Fold experience/out into dist/experience, if it has been built.
 *
 * This belongs in the build rather than in the workflow beside it. The first
 * thing this file does is delete dist/ outright, so a copy made anywhere else
 * has to happen afterwards or it is thrown away — and "afterwards" is a rule
 * that lives in someone's head right up until the day it does not. Doing it
 * here makes the ordering a property of the build instead of a thing to
 * remember.
 *
 * It is skipped silently when the app has not been built. The experience is a
 * separate Next.js app with its own dependencies, and the main site still has
 * to build on a clean checkout with nothing installed — which is the whole
 * reason the two are separate.
 */
const EXPERIENCE_OUT = join(ROOT, 'experience/out');
let experienceFiles = 0;
try {
  await stat(join(EXPERIENCE_OUT, 'index.html'));
  await cp(EXPERIENCE_OUT, join(DIST, 'experience'), { recursive: true });
  experienceFiles = (await walk(join(DIST, 'experience'))).length;
} catch {
  /* Not built. Nothing to say about it beyond the report line below. */
}

/* ------------------------------------------------------------------ report */

const files = await walk(DIST);
let bytes = 0;
for (const f of files) bytes += (await stat(join(DIST, f))).size;
console.log(`pages:  ${routes.length + 1}`);
console.log(`files:  ${files.length}`);
console.log(`size:   ${(bytes / 1024 / 1024).toFixed(2)} MB`);
console.log(
  experienceFiles
    ? `webgl:  dist/experience, ${experienceFiles} files`
    : 'webgl:  not built — run `npm ci && npm run build` in experience/',
);
