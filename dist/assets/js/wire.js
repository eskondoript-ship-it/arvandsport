/**
 * Live wire behaviour: region filtering and self-refreshing timestamps.
 *
 * The headlines themselves are baked in at build time by the scheduled fetch,
 * so the list works with JS off. This only adds the filter and keeps the
 * "14 minutes ago" labels honest as the page sits open.
 */
import { $, $$, gsap, canAnimate } from './env.js';

function ago(iso, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).valueOf()) / 1000));
  if (seconds < 60) return 'just now';
  const steps = [[60, 'minute'], [60, 'hour'], [24, 'day'], [7, 'week']];
  let value = seconds;
  let unit = 'second';
  for (const [size, name] of steps) {
    value = Math.floor(value / size);
    unit = name;
    if (value < (name === 'minute' ? 60 : name === 'hour' ? 24 : name === 'day' ? 7 : Infinity)) break;
  }
  return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
}

function refreshStamps(root) {
  for (const el of $$('[data-ago]', root)) el.textContent = ago(el.dataset.ago);
}

export function initWire(root = document) {
  const bar = $('[data-wire]', root);
  refreshStamps(root);

  /* Keep relative times accurate on a page left open. */
  if (!window.__wireClock) {
    window.__wireClock = setInterval(() => refreshStamps(document), 60000);
  }

  if (!bar) return;
  const chips = $$('[data-wire-region]', bar);
  const items = $$('[data-wire-item]', root);
  const empty = $('[data-wire-empty]', root);

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      const region = chip.dataset.wireRegion;
      chips.forEach((c) => c.classList.toggle('is-active', c === chip));

      let shown = 0;
      for (const item of items) {
        const ok = region === 'all' || item.dataset.region === region;
        item.hidden = !ok;
        if (ok) shown += 1;
      }
      if (empty) empty.hidden = shown !== 0;

      if (canAnimate()) {
        gsap.fromTo(
          items.filter((i) => !i.hidden),
          { opacity: 0, x: -10 },
          { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out', stagger: 0.02 },
        );
      }
    });
  }
}
