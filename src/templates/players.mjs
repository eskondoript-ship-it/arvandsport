import { layout, esc, attr, ICONS } from './layout.mjs';
import { sectionHead, playerCard, formatDate, isoDate } from './partials.mjs';

const uniq = (xs) => [...new Set(xs)];

function filterBar(site, players) {
  const groups = uniq(players.map((p) => p.position.group));
  const order = ['Goalkeeper', 'Defender', 'Midfield', 'Attack'];
  groups.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const nations = uniq(players.flatMap((p) => p.citizenship)).sort();
  return `<div class="filters" data-filters>
  <div class="filters__row">
    <div class="filters__chips" role="group" aria-label="Filter by position">
      <button class="chip is-active" type="button" data-filter-position="all">All<span class="chip__count">${players.length}</span></button>
      ${groups
        .map(
          (g) =>
            `<button class="chip" type="button" data-filter-position="${attr(g)}">${esc(g)}<span class="chip__count">${players.filter((p) => p.position.group === g).length}</span></button>`,
        )
        .join('')}
    </div>
    <div class="filters__tools">
      <label class="field field--select">
        <span class="u-sr-only">Filter by nationality</span>
        <select data-filter-nationality>
          <option value="all">All nationalities</option>
          ${nations.map((n) => `<option value="${attr(n)}">${esc(n)}</option>`).join('')}
        </select>
      </label>
      <label class="field field--search">
        <span class="u-sr-only">${esc(site.pages.players.searchPlaceholder)}</span>
        ${ICONS.search}
        <input type="search" data-filter-search placeholder="${attr(site.pages.players.searchPlaceholder)}" autocomplete="off">
      </label>
    </div>
  </div>
  <p class="filters__status" data-filter-status role="status" aria-live="polite"></p>
</div>`;
}

export function renderPlayerIndex({ site, players }) {
  const content = `
<section class="page-hero page-hero--players">
  <div class="shell">
    <p class="page-hero__kicker" data-reveal>${esc(players.length)} professionals represented worldwide</p>
    <h1 class="page-hero__title" data-split-chars>${esc(site.pages.players.title)}</h1>
    <p class="page-hero__intro" data-reveal>${esc(site.playersSection.intro)}</p>
  </div>
  <div class="page-hero__glow" aria-hidden="true"></div>
</section>
<section class="section section--tight">
  <div class="shell">
    ${filterBar(site, players)}
    <div class="roster__grid" data-roster>${players.map((p, i) => playerCard(p, i)).join('')}</div>
    <p class="roster__empty" data-roster-empty hidden>No players match those filters.</p>
  </div>
</section>`;

  return layout({
    site,
    namespace: 'players',
    current: '/player/',
    title: `Players – ${site.brand.name}`,
    description: site.playersSection.intro,
    canonicalPath: '/player/',
    image: players[0]?.image,
    bodyClass: 'page-players',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: site.pages.players.title,
      itemListElement: players.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${site.brand.url}${p.url}`,
        name: p.name,
      })),
    },
    content,
  });
}

function factRow(label, value) {
  if (!value) return '';
  return `<div class="facts__row"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
}

/* Transfermarkt hands us dates in two shapes: "29.07.2025" and "Jul 1, 2023".
 * Anything else is left alone rather than guessed at. */
function parseLooseDate(value) {
  if (!value) return null;
  const dotted = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (dotted) return new Date(Date.UTC(+dotted[3], +dotted[2] - 1, +dotted[1]));
  const parsed = new Date(value.replace(/\(\d+\)/, '').trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

function ageFrom(player) {
  const dob = parseLooseDate(player.birthDate || player.birth);
  if (!dob) return null;
  const age = Math.floor((Date.now() - dob.getTime()) / YEAR_MS);
  return age > 0 && age < 60 ? age : null;
}

/** A stat tile only appears when the underlying value is real. */
function vital({ label, value, suffix = '', count = null }) {
  if (value === null || value === undefined || value === '') return '';
  const countAttr = count === null ? '' : ` data-count="${attr(String(count))}"`;
  return `<li class="vital">
    <span class="vital__value"${countAttr}>${esc(String(value))}${suffix ? `<i>${esc(suffix)}</i>` : ''}</span>
    <span class="vital__label">${esc(label)}</span>
  </li>`;
}

function vitals(player) {
  const age = ageFrom(player);
  const heightM = /([\d,.]+)\s*m/.exec(player.height || '');
  const items = [
    vital({ label: 'Age', value: age, count: age }),
    vital({
      label: 'Height',
      value: heightM ? heightM[1].replace(',', '.') : '',
      suffix: heightM ? 'm' : '',
    }),
    vital({ label: 'Caps', value: player.caps, count: Number(player.caps) || null }),
    vital({ label: 'Int. goals', value: player.goals, count: Number(player.goals) || null }),
  ].filter(Boolean);
  if (!items.length) return '';
  return `<ul class="vitals" data-reveal>${items.join('')}</ul>`;
}

/* Hexagonal attribute radar. Drawn only for players with a published EA FC
 * card in content/site.json — the six axes are that card's real values, so
 * the rest of the roster simply gets the profile blocks instead. */
const RADAR_AXES = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];

function radar(rating) {
  if (!rating?.stats) return '';
  /* The viewBox carries its own margin so the vertex labels sit inside it —
   * letting them overflow made the figure's height unpredictable. */
  const size = 320;
  const c = size / 2;
  const rMax = 92;
  const point = (i, r) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return [c + Math.cos(angle) * r, c + Math.sin(angle) * r];
  };
  const ring = (r) => RADAR_AXES.map((_, i) => point(i, r).map((n) => n.toFixed(1)).join(',')).join(' ');
  const values = RADAR_AXES.map((k) => Math.max(0, Math.min(99, Number(rating.stats[k]) || 0)));
  const shape = values.map((v, i) => point(i, (v / 99) * rMax).map((n) => n.toFixed(1)).join(',')).join(' ');

  const grid = [0.25, 0.5, 0.75, 1]
    .map((f) => `<polygon class="radar__ring" points="${ring(rMax * f)}"></polygon>`)
    .join('');
  const spokes = RADAR_AXES.map((_, i) => {
    const [x, y] = point(i, rMax);
    return `<line class="radar__spoke" x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"></line>`;
  }).join('');
  const labels = RADAR_AXES.map((k, i) => {
    const [x, y] = point(i, rMax + 26);
    return `<text class="radar__label" x="${x.toFixed(1)}" y="${y.toFixed(1)}">
      <tspan class="radar__key" x="${x.toFixed(1)}" dy="-.1em">${esc(k)}</tspan>
      <tspan class="radar__num" x="${x.toFixed(1)}" dy="1.15em">${esc(String(values[i]))}</tspan>
    </text>`;
  }).join('');

  return `<figure class="radar" data-radar data-reveal>
  <figcaption class="radar__head">
    <span class="radar__overall"><strong data-count="${attr(String(rating.overall))}">${esc(String(rating.overall))}</strong><span>Overall</span></span>
    <span class="radar__tags">
      ${rating.position ? `<span class="radar__tag">${esc(rating.position)}</span>` : ''}
      ${rating.card ? `<span class="radar__tag radar__tag--card">${esc(rating.card)}</span>` : ''}
    </span>
  </figcaption>
  <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="EA FC attribute ratings: ${attr(RADAR_AXES.map((k, i) => `${k} ${values[i]}`).join(', '))}">
    <g class="radar__grid">${grid}${spokes}</g>
    <polygon class="radar__shape" data-radar-shape points="${shape}"></polygon>
    <g class="radar__labels">${labels}</g>
  </svg>
  <p class="radar__note">Published EA FC card rating</p>
</figure>`;
}

/* Contract bar: how much of joined → expires has already run. Both dates come
 * straight from the profile, so the bar is omitted unless both parse. */
function contract(player) {
  const from = parseLooseDate(player.joined);
  const to = parseLooseDate(player.contractExpires);
  const rows = [
    player.club ? `<div class="deal__row"><dt>Club</dt><dd>${esc(player.club)}</dd></div>` : '',
    player.joined ? `<div class="deal__row"><dt>Joined</dt><dd>${esc(player.joined)}</dd></div>` : '',
    player.contractExpires ? `<div class="deal__row"><dt>Contract until</dt><dd>${esc(player.contractExpires)}</dd></div>` : '',
    player.outfitter ? `<div class="deal__row"><dt>Outfitter</dt><dd>${esc(player.outfitter)}</dd></div>` : '',
  ]
    .filter(Boolean)
    .join('');
  if (!rows) return '';

  let bar = '';
  if (from && to && to > from) {
    const pct = Math.max(0, Math.min(100, ((Date.now() - from) / (to - from)) * 100));
    const expired = Date.now() > to.getTime();
    bar = `<div class="deal__bar${expired ? ' is-expired' : ''}">
      <div class="deal__track"><span class="deal__fill" data-bar style="--pct:${pct.toFixed(1)}%"></span></div>
      <div class="deal__scale"><span>${esc(player.joined)}</span><span>${esc(player.contractExpires)}</span></div>
      <p class="deal__state">${expired ? 'Term complete — contact the agency for current status' : `${Math.round(100 - pct)}% of the term still to run`}</p>
    </div>`;
  }

  return `<div class="deal" data-reveal>
    <h3 class="deal__title">Club &amp; contract</h3>
    <dl class="deal__rows">${rows}</dl>
    ${bar}
  </div>`;
}

function dossier(player, ratings) {
  const rating = ratings?.[player.slug];
  const blocks = [vitals(player), radar(rating), contract(player)].filter(Boolean);
  if (!blocks.length) return '';
  return `
<section class="section section--tight dossier">
  <div class="shell">
    ${sectionHead({ kicker: 'Dossier', title: 'Performance profile' })}
    <div class="dossier__grid${rating ? ' dossier__grid--radar' : ''}">${blocks.join('')}</div>
  </div>
</section>`;
}

export function renderPlayer({ site, players, player }) {
  const idx = players.findIndex((p) => p.slug === player.slug);
  const next = players[(idx + 1) % players.length];
  const prev = players[(idx - 1 + players.length) % players.length];
  const others = players.filter((p) => p.slug !== player.slug && p.position.group === player.position.group).slice(0, 4);
  const related = (others.length ? others : players.filter((p) => p.slug !== player.slug)).slice(0, 4);

  const summary = [player.position.detail, player.club, player.citizenship.join(' / ')].filter(Boolean).join(' · ');

  const content = `
<section class="player-hero" data-player-hero>
  <div class="shell player-hero__inner">
    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="/">Home</a>${ICONS.arrow}<a href="/player/">Players</a>${ICONS.arrow}<span>${esc(player.name)}</span>
    </nav>
    <div class="player-hero__grid">
      <div class="player-hero__copy">
        <p class="player-hero__badge" data-reveal>${esc(player.position.group)}</p>
        <h1 class="player-hero__name" data-split-chars>${esc(player.name)}</h1>
        <p class="player-hero__summary" data-reveal>${esc(summary)}</p>
        <ul class="player-hero__quick" data-reveal>
          ${player.club ? `<li><span>Club</span><strong>${esc(player.club)}</strong></li>` : ''}
          ${player.position.detail ? `<li><span>Role</span><strong>${esc(player.position.detail)}</strong></li>` : ''}
          ${player.foot ? `<li><span>Foot</span><strong>${esc(player.foot)}</strong></li>` : ''}
          ${player.height ? `<li><span>Height</span><strong>${esc(player.height)}</strong></li>` : ''}
        </ul>
      </div>
      <figure class="player-hero__media" data-player-media>
        <img src="${attr(player.image)}" alt="${attr(player.name)}" width="529" height="760" fetchpriority="high" decoding="async">
        <figcaption class="player-hero__figcap">${esc(player.citizenship.join(' · '))}</figcaption>
      </figure>
    </div>
  </div>
  <span class="player-hero__watermark" aria-hidden="true">${esc(player.lastName || player.name)}</span>
</section>
${dossier(player, site.ratings)}

<section class="section section--tight">
  <div class="shell player-detail">
    <div class="player-detail__facts">
      ${sectionHead({ kicker: 'Profile', title: 'Player data' })}
      <dl class="facts" data-reveal>
        ${/* The scraped string carries the age as at capture ("(31)"); the
            dossier tile computes it live, so the stale figure is dropped
            rather than contradicting it. */ ''}
        ${factRow('Date of birth', (player.birth || '').replace(/\s*\(\d+\)\s*$/, ''))}
        ${factRow('Place of birth', player.placeOfBirth)}
        ${factRow('Citizenship', player.citizenship.join(' · '))}
        ${factRow('Height', player.height)}
        ${factRow('Position', player.position.raw || player.position.detail)}
        ${factRow('Foot', player.foot)}
        ${factRow('Current international', player.internationalTeam)}
        ${player.caps ? factRow('Caps / Goals', `${player.caps} / ${player.goals}`) : ''}
        ${factRow('Current club', player.club)}
        ${factRow('Joined', player.joined)}
        ${factRow('Contract expires', player.contractExpires)}
        ${factRow('Contract option', player.contractOption)}
        ${factRow('Outfitter', player.outfitter)}
      </dl>
      ${player.note ? `<p class="player-detail__note" data-reveal>${esc(player.note)}</p>` : ''}
      ${
        player.links.length
          ? `<div class="player-detail__links" data-reveal>
        <h3>External profile</h3>
        <ul>${player.links.map((l) => `<li><a href="${attr(l.href)}" target="_blank" rel="noopener nofollow">${esc(l.label)}${ICONS.arrow}</a></li>`).join('')}</ul>
      </div>`
          : ''
      }
    </div>
    <aside class="player-detail__aside">
      <div class="panel" data-reveal>
        <h3 class="panel__title">Represented by Arvand Sport</h3>
        <p>${esc(site.about.paragraphs[1].replace(/<[^>]+>/g, ''))}</p>
        <a class="btn btn--solid" href="/registration/" data-magnetic><span>Work with us</span>${ICONS.arrow}</a>
      </div>
      <nav class="pager" aria-label="Player navigation">
        <a class="pager__link pager__link--prev" href="${attr(prev.url)}"><span>Previous</span><strong>${esc(prev.name)}</strong></a>
        <a class="pager__link pager__link--next" href="${attr(next.url)}"><span>Next</span><strong>${esc(next.name)}</strong></a>
      </nav>
    </aside>
  </div>
</section>

<section class="section">
  <div class="shell">
    ${sectionHead({ kicker: 'More from the roster', title: 'Other players' })}
    <div class="roster__grid roster__grid--compact">${related.map((p, i) => playerCard(p, i)).join('')}</div>
  </div>
</section>`;

  const description = `${player.name} — ${summary}. Represented by ${site.brand.shortName}.`;

  return layout({
    site,
    namespace: 'player',
    current: '/player/',
    title: `${player.name} – ${site.brand.name}`,
    description,
    canonicalPath: player.url,
    image: player.image,
    bodyClass: 'page-player',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: player.name,
      url: `${site.brand.url}${player.url}`,
      image: `${site.brand.url}${player.image}`,
      jobTitle: player.position.detail || 'Footballer',
      nationality: player.citizenship.map((c) => ({ '@type': 'Country', name: c })),
      height: player.height || undefined,
      birthPlace: player.placeOfBirth || undefined,
      affiliation: player.club ? { '@type': 'SportsTeam', name: player.club } : undefined,
      dateModified: isoDate(player.modified),
      description,
    },
    content,
  });
}

export { formatDate };
