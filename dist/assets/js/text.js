/**
 * Text splitting utilities.
 *
 * GSAP's own SplitText is a Club plugin, so these are hand-rolled: they wrap
 * characters, words or measured lines in spans that an overflow-hidden parent
 * can mask. Each splitter is idempotent — re-splitting an already-split node
 * returns the existing pieces rather than shredding the markup twice.
 */

const WORD = 'word';
const INNER = 'word__inner';

/** Wrap every word in `.word > .word__inner`. Returns the inner spans. */
export function splitWords(el) {
  if (el.dataset.splitDone) return [...el.querySelectorAll(`.${INNER}`)];
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  const inners = words.map((word, i) => {
    const outer = document.createElement('span');
    outer.className = WORD;
    const inner = document.createElement('span');
    inner.className = INNER;
    inner.textContent = word;
    outer.appendChild(inner);
    el.appendChild(outer);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    return inner;
  });
  el.dataset.splitDone = 'words';
  return inners;
}

/** Wrap every character in `.ch`, inside per-word masks. Returns the `.ch`s. */
export function splitChars(el) {
  if (el.dataset.splitDone) return [...el.querySelectorAll('.ch')];
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  const chars = [];
  words.forEach((word, i) => {
    const outer = document.createElement('span');
    outer.className = WORD;
    const inner = document.createElement('span');
    inner.className = INNER;
    for (const character of word) {
      const span = document.createElement('span');
      span.className = 'ch';
      span.textContent = character;
      inner.appendChild(span);
      chars.push(span);
    }
    outer.appendChild(inner);
    el.appendChild(outer);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
  });
  el.dataset.splitDone = 'chars';
  return chars;
}

/**
 * Group words into visual lines by measuring where they wrap, then wrap each
 * line in `.line > .line__inner` so it can rise out of a mask.
 *
 * Lines depend on the element's width, so this is re-runnable: pass
 * `{ force: true }` after a resize to regroup against the new layout.
 */
export function splitLines(el, { force = false } = {}) {
  if (el.dataset.splitDone === 'lines' && !force) return [...el.querySelectorAll('.line__inner')];

  if (el.dataset.originalHtml === undefined) el.dataset.originalHtml = el.innerHTML;
  else el.innerHTML = el.dataset.originalHtml;

  const words = splitWords(el);
  const rows = new Map();
  for (const inner of words) {
    const top = Math.round(inner.parentElement.offsetTop);
    if (!rows.has(top)) rows.set(top, []);
    rows.get(top).push(inner.parentElement);
  }

  const fragment = document.createDocumentFragment();
  const inners = [];
  for (const row of rows.values()) {
    const line = document.createElement('span');
    line.className = 'line';
    const inner = document.createElement('span');
    inner.className = 'line__inner';
    row.forEach((wordEl, i) => {
      inner.appendChild(wordEl);
      if (i < row.length - 1) inner.appendChild(document.createTextNode(' '));
    });
    line.appendChild(inner);
    fragment.appendChild(line);
    inners.push(inner);
  }
  el.innerHTML = '';
  el.appendChild(fragment);
  el.dataset.splitDone = 'lines';
  return inners;
}

/** Restore an element to the markup it had before it was split. */
export function unsplit(el) {
  if (el.dataset.originalHtml === undefined) return;
  el.innerHTML = el.dataset.originalHtml;
  delete el.dataset.splitDone;
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Scramble an element's text and settle it back, one character at a time.
 * Returns a cancel function so a second hover can interrupt the first.
 */
export function scramble(el, { duration = 420 } = {}) {
  const target = el.dataset.scrambleText || (el.dataset.scrambleText = el.textContent);
  const start = performance.now();
  let frame = 0;

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const settled = Math.floor(progress * target.length);
    el.textContent = target
      .split('')
      .map((character, i) => {
        if (i < settled || character === ' ') return character;
        return GLYPHS[(Math.random() * GLYPHS.length) | 0];
      })
      .join('');
    if (progress < 1) frame = requestAnimationFrame(tick);
    else el.textContent = target;
  };
  frame = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(frame);
    el.textContent = target;
  };
}
