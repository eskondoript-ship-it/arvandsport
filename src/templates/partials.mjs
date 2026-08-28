import { esc, attr, ICONS } from './layout.mjs';

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export const isoDate = (iso) => iso.split('T')[0];

/** Two-line section title with an animated rule, used across every page. */
export function sectionHead({ kicker = '', title, intro = '', align = 'left', id = '' }) {
  return `<header class="section-head section-head--${align}"${id ? ` id="${attr(id)}"` : ''} data-reveal>
  ${kicker ? `<p class="section-head__kicker"><span class="section-head__dot"></span>${esc(kicker)}</p>` : ''}
  <h2 class="section-head__title" data-split>${esc(title)}</h2>
  ${intro ? `<p class="section-head__intro">${intro}</p>` : ''}
</header>`;
}

export function playerCard(player, index = 0) {
  const meta = [player.position.detail, player.club].filter(Boolean);
  return `<article class="player-card" style="--i:${index}"
  data-player
  data-position="${attr(player.position.group)}"
  data-nationality="${attr(player.citizenship.join('|'))}"
  data-name="${attr(player.name.toLowerCase())}"
  data-club="${attr((player.club || '').toLowerCase())}">
  <a class="player-card__link" href="${attr(player.url)}">
    <span class="player-card__media">
      <img src="${attr(player.image)}" alt="${attr(player.name)}" width="529" height="760" loading="lazy" decoding="async">
      <span class="player-card__glow" aria-hidden="true"></span>
    </span>
    <span class="player-card__badge">${esc(player.position.group)}</span>
    <span class="player-card__body">
      <span class="player-card__name"><em>${esc(player.firstName)}</em><strong>${esc(player.lastName)}</strong></span>
      ${meta.length ? `<span class="player-card__meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</span>` : ''}
      <span class="player-card__cta">Profile ${ICONS.arrow}</span>
    </span>
  </a>
</article>`;
}

export function articleCard(article, index = 0, { featured = false } = {}) {
  return `<article class="news-card${featured ? ' news-card--featured' : ''}" style="--i:${index}" data-article
  data-title="${attr(article.title.toLowerCase())}">
  <a class="news-card__link" href="${attr(article.url)}">
    <span class="news-card__media">
      <img src="${attr(article.image)}" alt="" width="800" height="535" loading="lazy" decoding="async">
    </span>
    <span class="news-card__body">
      <span class="news-card__meta">
        <time datetime="${attr(isoDate(article.date))}">${formatDate(article.date)}</time>
        ${article.readingMinutes ? `<span class="news-card__dot"></span><span>${article.readingMinutes} min read</span>` : ''}
      </span>
      <h3 class="news-card__title">${esc(article.title)}</h3>
      ${article.excerpt ? `<span class="news-card__excerpt">${esc(article.excerpt)}</span>` : ''}
      <span class="news-card__cta">Read ${ICONS.arrow}</span>
    </span>
  </a>
</article>`;
}

export function personCard(person, index = 0, { role = '' } = {}) {
  return `<figure class="person" style="--i:${index}" data-reveal>
  <span class="person__media"><img src="${attr(person.image)}" alt="${attr(person.name)}" width="418" height="600" loading="lazy" decoding="async"></span>
  <figcaption class="person__caption">
    <span class="person__name">${esc(person.name)}</span>
    ${role || person.role ? `<span class="person__role">${esc(role || person.role)}</span>` : ''}
  </figcaption>
</figure>`;
}

export function statBlock(stat, index = 0) {
  return `<div class="stat" style="--i:${index}" data-reveal>
  <span class="stat__value"><span data-counter="${stat.value}">0</span>${stat.suffix ? `<em>${esc(stat.suffix)}</em>` : ''}</span>
  <span class="stat__label">${esc(stat.label)}</span>
</div>`;
}

/** A football, drawn rather than downloaded — the live site has no ball asset. */
export const BALL_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
  <circle cx="50" cy="50" r="48" fill="#fff"/>
  <circle cx="50" cy="50" r="48" fill="none" stroke="#0b1523" stroke-width="2"/>
  <path fill="#0b1523" d="M50 22l14 10-5.5 16.5h-17L36 32z"/>
  <path fill="#0b1523" d="M24.5 41l6 4.5-2.5 7.5-7.5.5-2-8zM75.5 41l-6 4.5 2.5 7.5 7.5.5 2-8z"/>
  <path fill="#0b1523" d="M38 66l12 8 12-8-4.5-9h-15z"/>
  <path fill="#0b1523" d="M28 72l7-1 3 8-6 3zM72 72l-7-1-3 8 6 3z"/>
</svg>`;
