/**
 * Pulls the real content of arvandsport.com out of its public WordPress REST
 * API and writes it to content/players.json + content/news.json.
 *
 * Everything this script emits comes from the live site. Nothing is invented.
 * Run it with the site reachable:  node tools/extract.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://arvandsport.com/wp-json/wp/v2';
const CAT = { player: 11, news: 1 };

/* Featured / card imagery, keyed by post slug. The live roster grid links each
 * card image to its player page, so the mapping is taken straight from
 * https://arvandsport.com/player/ rather than guessed. */
const PLAYER_IMAGE = {
  'farzad-tajik': 'farzad-tajik.png',
  'ahoora-zand': 'ahoora-zand.png',
  'payam-parsa': 'payam-parsa.png',
  'ali-pourdara': 'ali-pourdara.png',
  'eslit-sala': 'eslit-sala.png',
  'jafar-salmani': 'jafar-salmani.png',
  'ali-al-mosawe': 'ali-al-mosawe.png',
  'ali-alipour': 'ali-alipour.png',
  'amir-roustaei': 'amir-roustaei.png',
  'mario-fontanella': 'mario-fontanella.png',
  'mehdi-taremi': 'mehdi-taremi.png',
};

const NEWS_IMAGE = {
  'history-of-fifa-transfer-regulations': 'history-of-fifa-transfer-regulations.jpg',
  'persepolis-target-striker-attends-nassaji-training': 'persepolis-target-striker-attends-nassaji-training.webp',
  'iran-palestine-in-thrilling-clash-afc-asian-cup': 'iran-palestine-in-thrilling-clash-afc-asian-cup.jpg',
  'irans-taremi-among-biggest-goal-threats-at-afc-asian-cup': 'irans-taremi-among-biggest-goal-threats-at-afc-asian-cup.jpg',
  'on-the-eve-of-the-afc-asian-cup-with-ali-alipour': 'on-the-eve-of-the-afc-asian-cup-with-ali-alipour.jpeg',
  'amir-roustaei-had-a-successful-season-in-qatar': 'amir-roustaei-had-a-successful-season-in-qatar.jpg',
  'the-contract-of-the-iranian-star-with-kuwait-has-been-extended-until-2029': 'the-contract-of-the-iranian-star-with-kuwait-has-been-extended-until-2029.jpg',
};

/* Images embedded inside article bodies, rehosted locally. */
const INLINE_IMAGE = {
  'famalicao-porto-1024x768.jpg': 'inline-famalicao-porto.jpg',
  'IMG-20220214-WA0048-570x350-1.jpg': 'inline-alipour-interview.jpg',
  'r4gjxfpf.jpg': 'inline-pourdara-kuwait.jpg',
};

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#039': "'",
  '#8211': '–', '#8212': '—', '#8216': '‘', '#8217': '’',
  '#8220': '“', '#8221': '”', '#8230': '…', '#160': ' ',
};

function decode(s = '') {
  return s
    .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
      if (ENTITIES[e] !== undefined) return ENTITIES[e];
      if (/^#x/i.test(e)) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (/^#/.test(e)) return String.fromCodePoint(parseInt(e.slice(1), 10));
      return m;
    })
    .replace(/ /g, ' ');
}

const stripTags = (s = '') => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

async function api(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

/* ---------------------------------------------------------------- players */

/** "Attack – Centre-Forward" -> { group: "Attack", detail: "Centre-Forward" } */
function parsePosition(raw) {
  if (!raw) return { group: 'Player', detail: '' };
  /* Only the en/em dash separates group from role — plain hyphens belong to
   * role names such as "Centre-Forward" and "Left-Back". */
  const parts = raw.split(/\s*[–—]\s*/).map((p) => p.trim()).filter(Boolean);
  const head = (parts[0] || '').toLowerCase();
  const detail = parts.slice(1).join(' – ');
  if (head.startsWith('goalkeeper')) return { group: 'Goalkeeper', detail: detail || 'Goalkeeper' };
  if (head.startsWith('defen')) return { group: 'Defender', detail: detail || raw };
  if (head.startsWith('midfield')) return { group: 'Midfield', detail: detail || raw };
  if (head.startsWith('attack')) return { group: 'Attack', detail: detail || raw };
  /* Some entries skip the group and name the role directly. */
  if (/back|centre-back|center-back/i.test(raw)) return { group: 'Defender', detail: raw };
  if (/midfield/i.test(raw)) return { group: 'Midfield', detail: raw };
  if (/forward|winger|striker/i.test(raw)) return { group: 'Attack', detail: raw };
  return { group: 'Player', detail: raw };
}

function parseBioList(html) {
  const rows = [];
  for (const m of html.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
    const text = stripTags(m[1]);
    if (!text) continue;
    /* Rows are "Label: value", occasionally with a second label glued on:
     * "Joined: Aug 31, 2020 – Contract expires: Jun 30, 2024" */
    const split = text.split(/\s*[–—]\s*(?=Contract\s+(?:expires|option))/i);
    for (const chunk of split) {
      const idx = chunk.indexOf(':');
      if (idx === -1) { rows.push({ label: '', value: chunk.trim() }); continue; }
      rows.push({
        label: chunk.slice(0, idx).replace(/\s*[–—-]\s*$/, '').trim(),
        value: chunk.slice(idx + 1).replace(/\s+/g, ' ').trim(),
      });
    }
  }
  return rows.filter((r) => r.value);
}

const findRow = (rows, re) => rows.find((r) => re.test(r.label))?.value || '';

function extraProse(html) {
  const withoutLists = html.replace(/<ul[\s\S]*?<\/ul>/g, '').replace(/<figure[\s\S]*?<\/figure>/g, '');
  return stripTags(withoutLists);
}

function outboundLinks(html) {
  const seen = new Map();
  for (const m of html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const href = m[1];
    if (href.includes('arvandsport.com')) continue;
    const label = stripTags(m[2]);
    if (!label) continue;
    if (!seen.has(href)) seen.set(href, label);
  }
  return [...seen].map(([href, label]) => ({ href, label }));
}

function buildPlayer(post) {
  const html = post.content.rendered;
  const rows = parseBioList(html);
  const name = stripTags(post.title.rendered);
  const positionRaw = findRow(rows, /^position$/i);
  const position = parsePosition(positionRaw);
  const citizenship = findRow(rows, /citizenship/i)
    .split(/\s*[–—]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const caps = findRow(rows, /caps\s*\/\s*goals/i);
  const [capsCount = '', goalsCount = ''] = caps.split('/').map((s) => s.trim());
  const parts = name.split(/\s+/);

  return {
    id: post.id,
    slug: post.slug,
    name,
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
    url: `/player/${post.slug}/`,
    image: `/assets/img/players/${PLAYER_IMAGE[post.slug]}`,
    date: post.date,
    modified: post.modified,
    position: { raw: positionRaw, ...position },
    club: findRow(rows, /current club/i),
    citizenship,
    nationality: citizenship[0] || '',
    height: findRow(rows, /^height$/i),
    foot: findRow(rows, /^foot$/i),
    birth: findRow(rows, /date of birth/i),
    placeOfBirth: findRow(rows, /place of birth/i),
    joined: findRow(rows, /^joined$/i),
    contractExpires: findRow(rows, /contract\s*(?:–\s*)?expires/i),
    contractOption: findRow(rows, /contract option/i),
    outfitter: findRow(rows, /outfitter/i),
    internationalTeam: findRow(rows, /current international/i),
    caps: capsCount,
    goals: goalsCount,
    bio: rows,
    note: extraProse(html),
    links: outboundLinks(html),
  };
}

/* ------------------------------------------------------------------- news */

/** Rewrite the article body so it points at local assets and has no WP cruft. */
function cleanArticle(html) {
  let out = html;
  out = out.replace(/<img([^>]*?)>/g, (tag, attrs) => {
    const src = /src="([^"]+)"/.exec(attrs)?.[1] || '';
    const file = src.split('/').pop();
    const local = INLINE_IMAGE[file];
    if (!local) return '';
    const alt = /alt="([^"]*)"/.exec(attrs)?.[1] || '';
    return `<img src="/assets/img/news/${local}" alt="${alt}" loading="lazy" decoding="async">`;
  });
  out = out.replace(/\s(?:class|style|srcset|sizes|width|height|id|data-[\w-]+)="[^"]*"/g, '');
  out = out.replace(/<figure[^>]*>\s*<\/figure>/g, '');
  out = out.replace(/<p>\s*<\/p>/g, '');
  out = out.replace(/<div>\s*<\/div>/g, '');
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

function buildArticle(post) {
  const body = cleanArticle(post.content.rendered);
  const plain = stripTags(post.content.rendered);
  const words = plain.split(/\s+/).filter(Boolean).length;
  return {
    id: post.id,
    slug: post.slug,
    title: stripTags(post.title.rendered),
    url: `/news/${post.slug}/`,
    image: `/assets/img/news/${NEWS_IMAGE[post.slug]}`,
    date: post.date,
    modified: post.modified,
    author: 'Arvand-admin',
    authorSlug: 'arvand-admin',
    excerpt: plain.slice(0, 220).trim().replace(/\s\S*$/, '') + '…',
    readingMinutes: Math.max(1, Math.round(words / 200)),
    words,
    body,
  };
}

/* ------------------------------------------------------------------- main */

const posts = await api('/posts?per_page=100&_fields=id,slug,title,content,date,modified,categories,link');

const players = posts
  .filter((p) => p.categories.includes(CAT.player))
  .map(buildPlayer)
  .sort((a, b) => a.name.localeCompare(b.name));

const news = posts
  .filter((p) => p.categories.includes(CAT.news))
  .map(buildArticle)
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));

const missingPlayerImage = players.filter((p) => p.image.endsWith('undefined'));
const missingNewsImage = news.filter((n) => n.image.endsWith('undefined'));
if (missingPlayerImage.length || missingNewsImage.length) {
  throw new Error(`Unmapped imagery: ${[...missingPlayerImage, ...missingNewsImage].map((x) => x.slug).join(', ')}`);
}

await mkdir(join(ROOT, 'content'), { recursive: true });
await writeFile(join(ROOT, 'content/players.json'), JSON.stringify(players, null, 2) + '\n');
await writeFile(join(ROOT, 'content/news.json'), JSON.stringify(news, null, 2) + '\n');

console.log(`players: ${players.length}`);
console.log(`news:    ${news.length}`);
