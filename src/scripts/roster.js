/**
 * Player roster filtering: position chips, nationality select and free text.
 * Cards animate between states with a FLIP-style transform so nothing jumps.
 */
import { $, $$, gsap, canAnimate } from './env.js';

export function initRoster(root = document) {
  const filters = $('[data-filters]', root);
  const grid = $('[data-roster]', root);
  if (!filters || !grid) return;

  const cards = $$('[data-player]', grid);
  const status = $('[data-filter-status]', filters);
  const empty = $('[data-roster-empty]', root);
  const chips = $$('[data-filter-position]', filters);
  const select = $('[data-filter-nationality]', filters);
  const search = $('[data-filter-search]', filters);

  const state = { position: 'all', nationality: 'all', query: '' };

  const matches = (card) => {
    if (state.position !== 'all' && card.dataset.position !== state.position) return false;
    if (state.nationality !== 'all' && !card.dataset.nationality.split('|').includes(state.nationality)) return false;
    if (state.query) {
      const haystack = `${card.dataset.name} ${card.dataset.club} ${card.dataset.position}`.toLowerCase();
      if (!haystack.includes(state.query)) return false;
    }
    return true;
  };

  const apply = () => {
    const before = cards.map((c) => c.getBoundingClientRect());
    let shown = 0;

    cards.forEach((card) => {
      const ok = matches(card);
      card.hidden = !ok;
      if (ok) shown += 1;
    });

    if (empty) empty.hidden = shown !== 0;
    if (status) {
      status.textContent = shown === cards.length
        ? `Showing all ${cards.length} players`
        : `Showing ${shown} of ${cards.length} players`;
    }

    if (!canAnimate()) return;

    /* FLIP: measure after the layout settles, then play the delta back. */
    cards.forEach((card, i) => {
      if (card.hidden) return;
      const after = card.getBoundingClientRect();
      const first = before[i];
      const dx = first.left - after.left;
      const dy = first.top - after.top;
      if (first.width === 0) {
        gsap.fromTo(card, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'power3.out' });
      } else if (dx || dy) {
        gsap.fromTo(card, { x: dx, y: dy }, { x: 0, y: 0, duration: 0.55, ease: 'power3.out' });
      }
    });
  };

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.toggle('is-active', c === chip));
      state.position = chip.dataset.filterPosition;
      apply();
    });
  });

  select?.addEventListener('change', () => {
    state.nationality = select.value;
    apply();
  });

  let timer;
  search?.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.query = search.value.trim().toLowerCase();
      apply();
    }, 140);
  });

  apply();
}

/** The news index reuses the same idea with a single text field. */
export function initNewsSearch(root = document) {
  const input = $('[data-news-search]', root);
  const list = $('[data-news-list]', root);
  if (!input || !list) return;
  const cards = $$('[data-article]', list);
  const empty = $('[data-news-empty]', root);

  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = input.value.trim().toLowerCase();
      let shown = 0;
      cards.forEach((card) => {
        const ok = !q || card.dataset.title.includes(q);
        card.hidden = !ok;
        if (ok) shown += 1;
      });
      if (empty) empty.hidden = shown !== 0;
      if (canAnimate()) {
        gsap.fromTo(
          cards.filter((c) => !c.hidden),
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: 0.03 },
        );
      }
    }, 140);
  });
}
