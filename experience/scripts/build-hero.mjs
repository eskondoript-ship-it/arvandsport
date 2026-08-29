/**
 * Bundle hero/index.tsx into one ES module the static site can import.
 *
 * Next is not used for this. Next builds pages, and the hero is not a page —
 * it is a function called by a plain script on a page the site generator
 * already produced. esbuild is the right size of tool: one entry point, one
 * file out, no framework around it.
 *
 * The output goes to dist-hero/ and is copied into the site by
 * tools/build.mjs, the same way experience/out is. It is not committed: it is
 * derived from the sources beside it, and a megabyte of generated JavaScript
 * in the repository would go stale the first time nobody remembered to
 * regenerate it.
 */
import { build } from 'esbuild';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'dist-hero');

await mkdir(OUT, { recursive: true });

const result = await build({
  entryPoints: [join(ROOT, 'hero/index.tsx')],
  outfile: join(OUT, 'hero.js'),
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  platform: 'browser',
  minify: true,
  sourcemap: false,
  jsx: 'automatic',
  // React reads this to pick its production build. Without it the development
  // build ships, which is both larger and much slower.
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
  metafile: true,
});

const bytes = (await stat(join(OUT, 'hero.js'))).size;
const gzipped = gzipSync(readFileSync(join(OUT, 'hero.js')), { level: 9 }).length;

/* Written next to the bundle so the site build can report the real transfer
 * cost rather than the raw size, which is roughly triple and misleading. */
await writeFile(
  join(OUT, 'hero.meta.json'),
  JSON.stringify({ bytes, gzipped, built: new Date().toISOString() }, null, 2) + '\n',
);

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
console.log(`hero bundle: ${kb(bytes)} raw, ${kb(gzipped)} gzipped -> dist-hero/hero.js`);

/* A quiet regression here would be a slow homepage nobody noticed, so it is a
 * hard failure rather than a warning. The ceiling is deliberately close to the
 * current size: React, react-dom and three are most of it, and anything that
 * moves this much has pulled in something that needs a second look. */
const CEILING = 340 * 1024;
if (gzipped > CEILING) {
  console.error(`hero bundle is ${kb(gzipped)} gzipped, over the ${kb(CEILING)} ceiling.`);
  console.error('Check what was added before raising this — it loads on the homepage.');
  process.exit(1);
}

void result;
