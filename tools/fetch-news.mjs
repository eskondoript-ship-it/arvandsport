/**
 * Pulls football headlines from the sources in content/feeds.json and writes
 * content/feed.json for the build to render.
 *
 * This aggregates, it does not republish: each item keeps only its headline,
 * the feed's own one-line summary, its timestamp and a link back to the
 * publisher. Full article text is never copied.
 *
 * Every source is fetched independently and failures are swallowed, so one
 * dead feed cannot break a scheduled build. If *every* source fails the
 * existing feed.json is left untouched rather than replaced with an empty one.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TIMEOUT_MS = 12000;

const config = JSON.parse(await readFile(join(ROOT, 'content/feeds.json'), 'utf8'));

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

const unwrapCdata = (value = '') => value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

function decode(value = '') {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
    if (ENTITIES[e] !== undefined) return ENTITIES[e];
    if (/^#x/i.test(e)) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (/^#/.test(e)) return String.fromCodePoint(parseInt(e.slice(1), 10));
    return m;
  });
}

/**
 * Feed text to plain text.
 *
 * Order matters. CDATA has to be unwrapped first, because `<![CDATA[…]]>`
 * itself matches the tag pattern — stripping tags first swallows the content
 * whole and silently drops the item. Entities are decoded next so that
 * escaped markup in a description becomes real tags, and only then are tags
 * removed.
 */
const text = (value = '') =>
  decode(unwrapCdata(value))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** First matching tag body, tolerant of namespaces and attributes. */
function tag(block, name) {
  const m = new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'i').exec(block);
  return m ? m[1] : '';
}

/** Atom puts the URL in an attribute rather than the element body. */
function linkOf(block) {
  const plain = text(tag(block, 'link'));
  if (plain && /^https?:/i.test(plain)) return plain;
  const href = /<link\b[^>]*\bhref="([^"]+)"[^>]*>/i.exec(block);
  return href ? decode(href[1]) : '';
}

function parseFeed(xml, source) {
  const blocks = xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) || [];
  const items = [];
  for (const block of blocks) {
    const title = text(tag(block, 'title'));
    const link = linkOf(block);
    if (!title || !link) continue;
    const stamp =
      text(tag(block, 'pubDate')) || text(tag(block, 'published')) ||
      text(tag(block, 'updated')) || text(tag(block, 'date'));
    const when = stamp ? new Date(stamp) : null;
    const summary = text(tag(block, 'description') || tag(block, 'summary'));
    items.push({
      title,
      link,
      source: source.name,
      region: source.region,
      date: when && !Number.isNaN(when.valueOf()) ? when.toISOString() : null,
      /* Trimmed hard — this is a pointer to the article, not the article. */
      summary: summary.length > 180 ? `${summary.slice(0, 177).trimEnd()}…` : summary,
    });
  }
  return items;
}

async function fetchSource(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'user-agent': 'ArvandSportBot/1.0 (+https://arvandsport.com)', accept: 'application/rss+xml, application/xml, text/xml, */*' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = parseFeed(await res.text(), source);
    console.log(`  ${source.name.padEnd(14)} ${String(items.length).padStart(3)} items`);
    return items;
  } catch (error) {
    console.log(`  ${source.name.padEnd(14)} skipped (${error.message})`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

const results = await Promise.all(config.sources.map(fetchSource));
let items = results.flat();

if (!items.length) {
  console.log('every source failed — leaving the existing feed in place');
  process.exit(0);
}

/* Drop anything stale, de-duplicate by link, newest first, then cap. */
const cutoff = Date.now() - config.maxAgeHours * 3600 * 1000;
const seen = new Set();
items = items
  .filter((item) => !item.date || new Date(item.date).valueOf() >= cutoff)
  .filter((item) => (seen.has(item.link) ? false : seen.add(item.link)))
  .sort((a, b) => (a.date || '').localeCompare(b.date || '') * -1)
  .slice(0, config.maxItems);

await writeFile(
  join(ROOT, 'content/feed.json'),
  JSON.stringify({ updated: new Date().toISOString(), items }, null, 2) + '\n',
);

const iran = items.filter((i) => i.region === 'iran').length;
console.log(`wrote ${items.length} items (${iran} Iran, ${items.length - iran} world)`);
