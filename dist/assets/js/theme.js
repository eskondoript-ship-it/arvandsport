/**
 * Light / dark switching.
 *
 * Three states, matching the stylesheet: no stored choice means the system
 * preference decides, and an explicit choice is stored and wins in both
 * directions. The stored value is applied before first paint by the inline
 * boot script in the head — this module only owns the control.
 */
import { $, $$ } from './env.js';

const KEY = 'theme';
const root = document.documentElement;

/* localStorage throws in some privacy modes; the site works without it, the
 * choice just does not survive the visit. */
const read = () => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
};
const write = (v) => {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* ignore */
  }
};

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

/** What is actually on screen right now, chosen or inherited. */
const active = () => root.dataset.theme || (systemDark.matches ? 'dark' : 'light');

function sync() {
  const next = active() === 'dark' ? 'light' : 'dark';
  for (const btn of $$('[data-theme-toggle]')) {
    btn.setAttribute('aria-pressed', String(active() === 'light'));
    const label = $('[data-theme-label]', btn);
    if (label) label.textContent = `Switch to ${next} theme`;
  }
}

export function initTheme() {
  const stored = read();
  if (stored) root.dataset.theme = stored;
  sync();

  /* Follow the system while the visitor has expressed no preference. */
  systemDark.addEventListener('change', () => {
    if (!read()) sync();
  });

  for (const btn of $$('[data-theme-toggle]')) {
    if (btn.dataset.bound) continue;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const next = active() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      write(next);
      sync();
    });
  }
}
