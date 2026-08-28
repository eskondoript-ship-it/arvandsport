import { esc, attr, ICONS } from './layout.mjs';
import { sectionHead } from './partials.mjs';

/** "14 minutes ago" — rendered at build time, refreshed client-side. */
function ago(iso, now = Date.now()) {
  if (!iso) return '';
  const seconds = Math.max(0, Math.round((now - new Date(iso).valueOf()) / 1000));
  const steps = [
    [60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'],
  ];
  let value = seconds;
  let unit = 'second';
  for (const [size, name] of steps) {
    if (value < size) { unit = name; break; }
    value = Math.floor(value / size);
    unit = name;
  }
  if (unit === 'second') return 'just now';
  return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
}

/**
 * The live wire: aggregated football headlines, Iran and worldwide.
 *
 * Each row is a headline, its source and a link out. Nothing is republished —
 * the summary is the feed's own one-liner, trimmed, and every click leaves for
 * the publisher.
 */
export function wire(feed) {
  const items = feed?.items || [];
  if (!items.length) {
    /* Renders before the first scheduled fetch has run. */
    return `<section class="wire section" id="wire">
  <div class="shell">
    ${sectionHead({ kicker: 'Live wire', title: 'Football news' })}
    <p class="wire__empty">The wire is warming up — headlines appear after the next scheduled fetch.</p>
  </div>
</section>`;
  }

  const counts = {
    all: items.length,
    iran: items.filter((i) => i.region === 'iran').length,
    world: items.filter((i) => i.region === 'world').length,
  };

  const row = (item, i) => `<li class="wire__item" style="--i:${i}"
  data-wire-item data-region="${attr(item.region)}"
  data-title="${attr(item.title.toLowerCase())}">
  <a href="${attr(item.link)}" target="_blank" rel="noopener nofollow">
    <span class="wire__meta">
      <span class="wire__source">${esc(item.source)}</span>
      ${item.date ? `<time datetime="${attr(item.date)}" data-ago="${attr(item.date)}">${esc(ago(item.date))}</time>` : ''}
      ${item.region === 'iran' ? '<span class="wire__tag">Iran</span>' : ''}
    </span>
    <span class="wire__title">${esc(item.title)}</span>
    ${item.summary ? `<span class="wire__summary">${esc(item.summary)}</span>` : ''}
    <span class="wire__go">${ICONS.arrow}</span>
  </a>
</li>`;

  return `<section class="wire section" id="wire">
  <div class="shell">
    ${sectionHead({
      kicker: 'Live wire',
      title: 'Football news',
      intro: 'Headlines from Iran and around the world, refreshed automatically. Every story links to its publisher.',
    })}

    <div class="wire__bar" data-wire>
      <div class="filters__chips" role="group" aria-label="Filter headlines by region">
        <button class="chip is-active" type="button" data-wire-region="all">All<span class="chip__count">${counts.all}</span></button>
        <button class="chip" type="button" data-wire-region="iran">Iran<span class="chip__count">${counts.iran}</span></button>
        <button class="chip" type="button" data-wire-region="world">World<span class="chip__count">${counts.world}</span></button>
      </div>
      ${feed.updated ? `<p class="wire__updated">Updated <time datetime="${attr(feed.updated)}" data-ago="${attr(feed.updated)}">${esc(ago(feed.updated))}</time></p>` : ''}
    </div>

    <ul class="wire__list">${items.map(row).join('')}</ul>
    <p class="roster__empty" data-wire-empty hidden>No headlines in that region right now.</p>
  </div>
</section>`;
}
