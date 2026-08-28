/**
 * Parser tests for the news fetcher.
 *
 * The live sources cannot be reached from every environment, so the parsing
 * itself is verified against fixtures covering the two feed dialects in use
 * (RSS 2.0 and Atom) plus the awkward cases: CDATA, entities, namespaced
 * tags, Atom's link-as-attribute, and items missing a date.
 *
 * Run: node tools/__tests__/feed-parse.test.mjs
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* The fetcher runs top-to-bottom on import, so its parser is re-created here
   from the same source text to keep the test hermetic. */
const src = await readFile(new URL('../fetch-news.mjs', import.meta.url), 'utf8');
const body = src.slice(src.indexOf('const ENTITIES'), src.indexOf('async function fetchSource'));
const { parseFeed } = await import(
  `data:text/javascript,${encodeURIComponent(`${body}\nexport { parseFeed };`)}`
);

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title><![CDATA[Taremi scores twice in Porto win]]></title>
    <link>https://example.com/a</link>
    <pubDate>Tue, 26 Aug 2026 09:30:00 GMT</pubDate>
    <description>&lt;p&gt;The striker struck twice before the hour.&lt;/p&gt;</description>
  </item>
  <item>
    <title>Iran name squad &amp; staff</title>
    <link>https://example.com/b</link>
    <description>Short one.</description>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title type="text">Persepolis sign midfielder</title>
    <link rel="alternate" href="https://example.com/c"/>
    <updated>2026-08-26T08:00:00Z</updated>
    <summary>A deal until 2029.</summary>
  </entry>
</feed>`;

const rss = parseFeed(RSS, { name: 'Test', region: 'iran' });
assert.equal(rss.length, 2, 'both RSS items parse');
assert.equal(rss[0].title, 'Taremi scores twice in Porto win', 'CDATA title unwrapped');
assert.equal(rss[0].link, 'https://example.com/a');
assert.equal(rss[0].date, '2026-08-26T09:30:00.000Z', 'pubDate normalised to ISO');
assert.equal(rss[0].summary, 'The striker struck twice before the hour.', 'entities decoded, tags stripped');
assert.equal(rss[0].source, 'Test');
assert.equal(rss[0].region, 'iran');
assert.equal(rss[1].title, 'Iran name squad & staff', 'entity in title decoded');
assert.equal(rss[1].date, null, 'missing date is null, not an invalid Date');

const atom = parseFeed(ATOM, { name: 'Atom', region: 'world' });
assert.equal(atom.length, 1, 'Atom entry parses');
assert.equal(atom[0].link, 'https://example.com/c', 'Atom link read from href attribute');
assert.equal(atom[0].date, '2026-08-26T08:00:00.000Z');
assert.equal(atom[0].summary, 'A deal until 2029.');

const long = parseFeed(
  `<rss><item><title>T</title><link>https://e.com/x</link><description>${'word '.repeat(80)}</description></item></rss>`,
  { name: 'L', region: 'world' },
);
assert.ok(long[0].summary.length <= 180, 'summary is trimmed to a pointer, not the article');
assert.ok(long[0].summary.endsWith('…'), 'trimmed summary is elided');

const junk = parseFeed('<rss><item><title>No link</title></item></rss>', { name: 'J', region: 'world' });
assert.equal(junk.length, 0, 'items without a link are dropped');

console.log('feed parser: 14 assertions passed');
