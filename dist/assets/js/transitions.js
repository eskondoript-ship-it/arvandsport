/**
 * Client-side page transitions.
 *
 * Internal navigations are intercepted, the next document is fetched, and its
 * container is swapped in behind a wipe. Every guard below falls back to a
 * normal browser navigation, so the site works identically with JS disabled,
 * with reduced motion, and for crawlers — the URLs and markup are the same
 * static files either way.
 */
import { $, gsap, canAnimate } from './env.js';

const CONTAINER = '[data-barba="container"]';

let onSwap = () => {};
let navigating = false;

const sameOrigin = (url) => url.origin === location.origin;

function isInternalNav(link, event) {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (link.target && link.target !== '_self') return false;
  if (link.hasAttribute('download') || link.getAttribute('rel')?.includes('external')) return false;
  const url = new URL(link.href, location.href);
  if (!sameOrigin(url)) return false;
  if (url.pathname === location.pathname && url.hash) return false;
  if (/\.(pdf|zip|jpe?g|png|webp|svg|xml|txt)$/i.test(url.pathname)) return false;
  return true;
}

function wipeIn(overlay) {
  return gsap
    .timeline()
    .set(overlay, { className: 'page-transition is-active' })
    .fromTo(overlay.querySelector('.page-transition__panel'), { scaleY: 0, transformOrigin: 'bottom' }, { scaleY: 1, duration: 0.55, ease: 'power4.inOut' })
    .fromTo(overlay.querySelector('.page-transition__mark'), { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' }, '-=0.2');
}

function wipeOut(overlay) {
  return gsap
    .timeline({ onComplete: () => overlay.classList.remove('is-active') })
    .to(overlay.querySelector('.page-transition__mark'), { opacity: 0, duration: 0.25, ease: 'power2.in' })
    .to(overlay.querySelector('.page-transition__panel'), { scaleY: 0, transformOrigin: 'top', duration: 0.6, ease: 'power4.inOut' }, '-=0.1');
}

async function fetchPage(url) {
  const res = await fetch(url, { headers: { 'X-Requested-With': 'fetch' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  return new DOMParser().parseFromString(html, 'text/html');
}

async function go(href, { push = true } = {}) {
  if (navigating) return;
  navigating = true;
  const overlay = $('[data-transition]');
  const animate = canAnimate() && overlay;

  try {
    const enter = animate ? wipeIn(overlay) : null;
    const [doc] = await Promise.all([fetchPage(href), enter ? enter.then() : Promise.resolve()]);

    const nextContainer = doc.querySelector(CONTAINER);
    const current = $(CONTAINER);
    if (!nextContainer || !current) throw new Error('missing container');

    document.title = doc.title;
    document.body.className = doc.body.className;
    const nextCanonical = doc.querySelector('link[rel=canonical]')?.href;
    const canonical = document.querySelector('link[rel=canonical]');
    if (canonical && nextCanonical) canonical.href = nextCanonical;
    const nextDesc = doc.querySelector('meta[name=description]')?.content;
    const desc = document.querySelector('meta[name=description]');
    if (desc && nextDesc) desc.content = nextDesc;

    current.replaceWith(nextContainer);
    if (push) history.pushState({}, '', href);

    const url = new URL(href, location.href);

    onSwap(nextContainer, url.pathname, doc);

    /* After onSwap, not before it. onSwap re-runs the motion system, which
     * ends in ScrollTrigger.refresh() — and refresh restores the scroll
     * position it recorded before the swap. Resetting first was undone by
     * that, so following a player card from half-way down the roster landed
     * you the same distance down the new page, below the profile entirely.
     * A second pass on the next frame covers the pinned sections, whose
     * spacers only settle once refresh has finished measuring. */
    const land = () => {
      if (url.hash) document.getElementById(url.hash.slice(1))?.scrollIntoView();
      else window.scrollTo(0, 0);
    };
    land();
    requestAnimationFrame(land);

    if (animate) await wipeOut(overlay).then();
  } catch {
    /* Anything unexpected: hand the navigation back to the browser. */
    location.href = href;
    return;
  } finally {
    navigating = false;
  }
}

/**
 * @param {(container: Element, pathname: string, doc: Document) => void} handler
 *   Called after each swap so page modules can re-initialise.
 */
export function initTransitions(handler) {
  onSwap = handler;
  if (!window.history?.pushState || !window.DOMParser) return;

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || !isInternalNav(link, event)) return;
    event.preventDefault();
    const href = new URL(link.href, location.href).href;
    if (href === location.href) return;
    go(href);
  });

  window.addEventListener('popstate', () => go(location.href, { push: false }));

  /* Warm the cache for links the pointer is heading towards. */
  const prefetched = new Set();
  document.addEventListener('pointerover', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (!sameOrigin(url) || prefetched.has(url.href) || url.pathname === location.pathname) return;
    prefetched.add(url.href);
    const el = document.createElement('link');
    el.rel = 'prefetch';
    el.href = url.href;
    document.head.appendChild(el);
  });
}
