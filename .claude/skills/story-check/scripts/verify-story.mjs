/**
 * Drive the homepage's scroll story in a real browser and report what it did.
 *
 * The hero is four screens of sticky stage, three chapters of copy, a WebGL
 * island that only some visitors get, and a stat column that must appear on the
 * last chapter and nowhere else. None of that can be checked by reading the
 * HTML: it is all a function of scroll position, and half of it is drawn on a
 * canvas. So this scrolls the page and looks.
 *
 * Two things it does that anything written from scratch tends to get wrong,
 * and which is most of the reason this exists as a file rather than as
 * instructions:
 *
 *   * It scrolls through Lenis, not through window.scrollTo. Lenis owns the
 *     scroll position and snaps a raw scrollTo straight back, so a harness that
 *     uses window.scrollTo silently measures the top of the page at every
 *     offset and reports that everything is fine.
 *   * It measures the story's range as the section's height less one viewport.
 *     That is the distance the sticky stage can hold for, which is exactly the
 *     range the ScrollTrigger runs over. Sampling past it measures the page
 *     after the story has correctly finished, which is a different thing.
 *
 * Usage:  node .claude/skills/story-check/scripts/verify-story.mjs [dist] [shots]
 * Needs:  playwright. Set PLAYWRIGHT_PATH if it is not resolvable from here.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIST = process.argv[2] || 'dist';
const SHOTS = process.argv[3] || '';
const PORT = Number(process.env.PORT || 8151);

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.woff2': 'font/woff2',
};

const { chromium } = process.env.PLAYWRIGHT_PATH
  ? await import(path.resolve(process.env.PLAYWRIGHT_PATH))
  : await import('playwright').catch(() => {
      console.error(
        'playwright is not resolvable from here. Install it, or point\n' +
          'PLAYWRIGHT_PATH at an existing copy:\n' +
          '  PLAYWRIGHT_PATH=/path/to/node_modules/playwright/index.mjs node <this file>',
      );
      process.exit(2);
    });

const server = http.createServer((req, res) => {
  let file = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404);
    return res.end();
  }
  const body = fs.readFileSync(file);
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Content-Length': body.length,
  });
  res.end(body);
});
await new Promise((ready) => server.listen(PORT, ready));

if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

/* swiftshader, because CI and most sandboxes have no GPU and the WebGL gate
   would otherwise fail for a reason that has nothing to do with the site. */
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

const goTo = (page, y) =>
  page.evaluate((v) => {
    if (window.lenis) {
      window.lenis.scrollTo(v, { immediate: true });
      return;
    }
    window.scrollTo(0, v);
  }, y);

async function run(label, context, expectWebgl) {
  const page = await browser.newPage(context);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 110));
  });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  /* The island is fetched after first paint and then has a model to load. */
  await page.waitForTimeout(9000);

  const range = await page.evaluate(
    () => document.querySelector('[data-apex]').offsetHeight - window.innerHeight,
  );

  const rows = [];
  for (const mark of [0, 0.15, 0.45, 0.75, 0.98]) {
    await goTo(page, Math.round(range * mark));
    await page.waitForTimeout(2600);
    rows.push({
      mark,
      ...(await page.evaluate(() => {
        const pin = document.querySelector('[data-apex-pin]');
        return {
          webgl: Boolean(pin?.classList.contains('is-webgl')),
          chapters: [...document.querySelectorAll('[data-apex-chapter]')].map((el) =>
            Number(Number(getComputedStyle(el).opacity).toFixed(2)),
          ),
          lit: [...document.querySelectorAll('[data-apex-rail]')].findIndex((el) =>
            el.classList.contains('is-live'),
          ),
          count: document.querySelector('[data-apex-count]')?.textContent,
          stats: Number(getComputedStyle(document.querySelector('.apex__stat') || document.body).opacity),
          pinTop: Math.round(pin.getBoundingClientRect().top),
        };
      })),
    });
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/${label}-${Math.round(mark * 100)}.png` });
    }
  }

  /* Everything below the story has to survive it. A sticky stage that
     accidentally covers the rest of the page still passes every check above. */
  const missing = (
    await page.evaluate(() =>
      ['#about', '#services', '#players', '[data-strike]', '#news', '#partners'].map((sel) => [
        sel,
        Boolean(document.querySelector(sel)),
      ]),
    )
  )
    .filter(([, ok]) => !ok)
    .map(([sel]) => sel);

  const stuck = rows.every((r) => Math.abs(r.pinTop) <= 1);
  const swap =
    rows[0].chapters[0] > 0.9 &&
    rows.at(-1).chapters.at(-1) > 0.9 &&
    rows.at(-1).chapters[0] < 0.15;
  const railOk = rows[0].lit === 0 && rows.at(-1).lit === 2;
  const statsOk = rows[0].stats < 0.1 && rows.at(-1).stats > 0.9;
  const gate = rows.every((r) => r.webgl === expectWebgl);

  console.log(`\n--- ${label} ---`);
  for (const r of rows) {
    console.log(
      `  ${String(Math.round(r.mark * 100)).padStart(3)}%  chapters [${r.chapters.join(' ')}]` +
        `  rail ${r.lit}  count ${r.count}  stats ${r.stats}  pinTop ${r.pinTop}  webgl ${r.webgl}`,
    );
  }
  console.log(`  stage stays stuck across the whole ${range}px story: ${stuck}`);
  console.log(`  chapters crossfade: ${swap}`);
  console.log(`  rail tracks the acts: ${railOk}`);
  console.log(`  stat cards only on chapter three: ${statsOk}`);
  console.log(`  webgl gate correct (want ${expectWebgl}): ${gate}`);
  console.log(`  sections kept below: ${missing.length ? 'MISSING ' + missing.join(', ') : 'all present'}`);
  console.log(`  errors: ${errors.length ? errors.slice(0, 3).join(' | ') : 'none'}`);

  await page.close();
  return stuck && swap && railOk && statsOk && gate && !missing.length && !errors.length;
}

const desktop = await run('desktop', { viewport: { width: 1440, height: 900 } }, true);
const phone = await run(
  'phone',
  { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  false,
);

console.log(`\n${[desktop, phone].filter(Boolean).length}/2 passed`);
await browser.close();
server.close();
process.exit(desktop && phone ? 0 : 1);
