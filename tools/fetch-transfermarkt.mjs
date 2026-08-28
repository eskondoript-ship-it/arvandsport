/**
 * Fill content/careers.json from Transfermarkt.
 *
 * Only players that already carry a `transfermarktId` are fetched — the id is
 * the number in a profile URL, e.g. 307058 in
 * /mehdi-taremi/profil/spieler/307058.
 *
 * Two rules govern this script, because the site's standing rule is that no
 * figure about a real person may be invented:
 *
 *  1. It never writes a partially understood page. Every parsed row is
 *     validated, and a player whose page yields nothing that passes is left
 *     exactly as it was rather than written with holes.
 *  2. It never fails a build. Network errors, layout changes and blocks are
 *     reported and skipped; the committed file survives untouched.
 *
 * Transfermarkt's markup is not a contract and does change. Treat a run that
 * reports "0 rows" as a parser that needs updating, not as an empty career.
 *
 * Usage: npm run transfermarkt
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'content/careers.json');

const HOST = 'https://www.transfermarkt.com';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TIMEOUT_MS = 20000;
const GAP_MS = 3000; /* be a polite client: one page every few seconds */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' },
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return { html: await res.text() };
  } catch (err) {
    return { error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------------------------------------------- parsing */

const stripTags = (s) => s.replace(/<[^>]+>/g, ' ');
const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n));
const clean = (s) => decode(stripTags(s)).replace(/\s+/g, ' ').trim();

const rowsOf = (html) => [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
const cellsOf = (row) => [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => clean(m[1]));

const SEASON = /^\d{2}\/\d{2}$/;
const toInt = (s) => {
  const n = Number(String(s).replace(/[.,]/g, '').replace(/[^\d-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** Transfers: rows carrying a season, a left club, a joined club and a fee. */
function parseTransfers(html) {
  const out = [];
  for (const row of rowsOf(html)) {
    const c = cellsOf(row);
    if (c.length < 5) continue;
    const season = c.find((v) => SEASON.test(v));
    if (!season) continue;
    const i = c.indexOf(season);
    /* season, date, left, joined, ..., fee — clubs are the two cells after
     * the date, and the fee is the last non-empty cell on the row. */
    const from = c[i + 2];
    const to = c[i + 3];
    const fee = [...c].reverse().find((v) => /^(€|£|\$|Free|Loan|-|\?)/i.test(v));
    if (!from || !to || from === to) continue;
    const date = c[i + 1] && !Number.isNaN(Date.parse(c[i + 1])) ? new Date(c[i + 1]).toISOString().slice(0, 10) : '';
    const entry = { season, from, to };
    if (date) entry.date = date;
    if (fee && fee !== '-' && fee !== '?') entry.fee = fee;
    out.push(entry);
  }
  return out;
}

/** Season stats: a season cell plus at least appearances and goals. */
function parseSeasons(html) {
  const out = [];
  for (const row of rowsOf(html)) {
    const c = cellsOf(row);
    if (c.length < 5) continue;
    const season = c.find((v) => SEASON.test(v));
    if (!season) continue;
    /* Trailing numeric run: appearances, goals, assists, ... minutes. */
    const nums = c.slice(c.indexOf(season) + 1).map(toInt);
    const run = [];
    for (const n of nums) if (n !== null) run.push(n);
    if (run.length < 2) continue;
    const competition = c[c.indexOf(season) + 1] || '';
    const club = c.find((v, idx) => idx > c.indexOf(season) && /[A-Za-z]{3}/.test(v) && v !== competition) || '';
    const [appearances, goals, assists] = run;
    const entry = { season, club, competition, appearances, goals };
    if (assists !== undefined) entry.assists = assists;
    out.push(entry);
  }
  return out;
}

/** Refuse anything that does not look like a real career table. */
function plausible(transfers, seasons) {
  const okT = transfers.every((t) => SEASON.test(t.season) && t.from && t.to);
  const okS = seasons.every(
    (s) =>
      SEASON.test(s.season) &&
      Number.isInteger(s.appearances) &&
      s.appearances >= 0 &&
      s.appearances <= 80 &&
      Number.isInteger(s.goals) &&
      s.goals >= 0 &&
      s.goals <= 80,
  );
  return okT && okS && (transfers.length > 0 || seasons.length > 0);
}

/* ------------------------------------------------------------------- run */

const data = JSON.parse(await readFile(FILE, 'utf8'));
const entries = Object.entries(data.players || {}).filter(([, v]) => v && v.transfermarktId);

if (!entries.length) {
  console.log('no players carry a transfermarktId — nothing to fetch');
  process.exit(0);
}

let written = 0;
let first = true;

for (const [slug, record] of entries) {
  if (!first) await sleep(GAP_MS);
  first = false;

  const id = record.transfermarktId;
  const [t, s] = [
    await get(`${HOST}/x/transfers/spieler/${id}`),
    (await sleep(GAP_MS), await get(`${HOST}/x/leistungsdatendetails/spieler/${id}`)),
  ];

  if (t.error && s.error) {
    console.log(`  ${slug.padEnd(18)} skipped (${t.error})`);
    continue;
  }

  const transfers = t.html ? parseTransfers(t.html) : [];
  const seasons = s.html ? parseSeasons(s.html) : [];

  if (!plausible(transfers, seasons)) {
    console.log(`  ${slug.padEnd(18)} skipped (0 rows understood — parser likely out of date)`);
    continue;
  }

  data.players[slug] = {
    ...record,
    updated: new Date().toISOString().slice(0, 10),
    ...(transfers.length ? { transfers } : {}),
    ...(seasons.length ? { seasons } : {}),
  };
  written += 1;
  console.log(`  ${slug.padEnd(18)} ${transfers.length} transfers, ${seasons.length} seasons`);
}

if (!written) {
  console.log('nothing understood — leaving content/careers.json untouched');
  process.exit(0);
}

await writeFile(FILE, `${JSON.stringify(data, null, 2)}\n`);
console.log(`updated ${written} player(s)`);
