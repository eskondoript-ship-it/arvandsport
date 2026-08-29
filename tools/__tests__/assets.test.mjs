/**
 * Every internal reference in the built site must resolve from the page it is
 * written into.
 *
 * This exists because of a real escape: picture() started emitting <source
 * srcset>, and relativise() only rewrote href and src. The <img> fallback was
 * correctly relative while every WebP source stayed site-absolute — which
 * looks perfect at a domain root and 404s for every WebP-capable browser under
 * the Pages prefix, i.e. all of them. A link check that only understood href
 * and src would not have caught it, so this one reads srcset too.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = join(ROOT, 'dist');

/* Same normalisation the build uses, so the two cannot drift. */
const PREFIX = process.env.BASE_PATH ? `/${process.env.BASE_PATH.replace(/^\/|\/$/g, '')}` : '';

let checked = 0;
const failures = [];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const EXTERNAL = /^(https?:|mailto:|tel:|data:|#)/;

async function resolves(from, ref) {
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean) return true;
  const target = join(from, clean);
  try {
    const st = await stat(target);
    if (st.isDirectory()) await stat(join(target, 'index.html'));
    return true;
  } catch {
    return false;
  }
}

const files = await walk(DIST);
if (!files.length) {
  console.error('no built pages found — run `npm run build` first');
  process.exit(1);
}

for (const file of files) {
  const html = await readFile(file, 'utf8');
  const dir = dirname(file);
  const page = file.replace(DIST, '') || '/';

  const refs = [];
  for (const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) refs.push(m[1]);
  /* srcset carries several URLs, each followed by a width or density. */
  for (const m of html.matchAll(/\bsrcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) {
      const url = part.trim().split(/\s+/)[0];
      if (url) refs.push(url);
    }
  }

  for (const ref of refs) {
    if (EXTERNAL.test(ref)) continue;
    /* 404.html is served at an unknown depth and stays absolute by design. */
    if (page === '/404.html' && ref.startsWith('/')) continue;
    checked += 1;

    /* The WebGL experience is a Next.js static export, and Next writes every
     * asset path absolute with the deploy prefix already baked in. Those are
     * correct, not broken — but only if the prefix they were built with
     * matches the one this build used, which is exactly the mismatch worth
     * catching. So they are resolved from the dist root against BASE_PATH
     * rather than waved through, and a stale export built at the wrong prefix
     * fails here instead of on the live site. */
    if (page.startsWith('/experience/') && ref.startsWith('/')) {
      if (!ref.startsWith(PREFIX)) {
        failures.push(`${page} -> ${ref} (built for a different BASE_PATH; expected ${PREFIX})`);
      } else if (!(await resolves(DIST, ref.slice(PREFIX.length)))) {
        failures.push(`${page} -> ${ref} (missing)`);
      }
      continue;
    }

    if (ref.startsWith('/')) {
      failures.push(`${page} -> ${ref} (site-absolute; will 404 under a path prefix)`);
      continue;
    }
    if (!(await resolves(dir, ref))) failures.push(`${page} -> ${ref} (missing)`);
  }
}

if (failures.length) {
  console.error(`asset check: ${failures.length} broken of ${checked}`);
  for (const f of [...new Set(failures)].slice(0, 20)) console.error('  ' + f);
  process.exit(1);
}
console.log(`asset check: ${checked} internal references all resolve`);
