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
    <h1 class="page-hero__title" data-split>${esc(site.pages.players.title)}</h1>
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
        <h1 class="player-hero__name" data-split>${esc(player.name)}</h1>
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

<section class="section section--tight">
  <div class="shell player-detail">
    <div class="player-detail__facts">
      ${sectionHead({ kicker: 'Profile', title: 'Player data' })}
      <dl class="facts" data-reveal>
        ${factRow('Date of birth / Age', player.birth)}
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
