/** Sticky header state, scroll progress bar and the mobile drawer. */
import { $, $$, gsap, canAnimate } from './env.js';
import { scrollToTarget } from './smooth.js';

/* Held at module scope so a page swap can put the header back on screen: the
 * bar is outside the swapped container, so it survives the transition with
 * whatever state it had when the visitor clicked the link. */
let resetHeaderState = () => {};

export function initHeader() {
  const header = $('[data-header]');
  const progress = $('[data-scroll-progress]');
  const toggle = $('[data-menu-toggle]');
  const menu = $('[data-mobile-menu]');
  if (!header) return;

  let last = window.scrollY;
  let ticking = false;

  /* Direction has to beat a few pixels before the bar reacts. Comparing
   * y > last alone let sub-pixel jitter and momentum settle flip it. */
  const DIRECTION_THRESHOLD = 6;

  /* Jumping to an in-page anchor scrolls downward, which would otherwise hide
   * the bar the moment the visitor asked to go somewhere. Navigation holds it
   * open, and the hold is released once scrolling has actually settled — a
   * fixed timer was not enough, since a smooth jump outlasts it. */
  /* An anchor jump is not one smooth run: the click is followed by a pause of
   * roughly half a second with no scrolling at all, then a single large jump.
   * An idle timer alone expired in that gap, so the hold is a deadline that
   * survives the pause, and each scroll during it pushes the deadline out so
   * the tail of the jump stays covered too. */
  const HOLD_AFTER_NAV = 1500;
  const HOLD_WHILE_MOVING = 300;
  let holdUntil = 0;
  const holdOpenNow = () => performance.now() < holdUntil;

  const update = () => {
    const y = window.scrollY;
    header.classList.toggle('is-stuck', y > 12);

    /* Hide on the way down, come back on the way up — but never while the
     * drawer is open, never in the first viewport, and never mid-jump. */
    const delta = y - last;
    if (holdOpenNow()) {
      header.classList.remove('is-hidden');
      last = y;
      holdUntil = Math.max(holdUntil, performance.now() + HOLD_WHILE_MOVING);
    } else if (Math.abs(delta) > DIRECTION_THRESHOLD) {
      const hide = y > 320 && delta > 0 && !menu?.classList.contains('is-open');
      header.classList.toggle('is-hidden', hide);
      last = y;
    } else if (y <= 320) {
      header.classList.remove('is-hidden');
      last = y;
    }

    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
    }
    ticking = false;
  };

  resetHeaderState = () => {
    holdUntil = performance.now() + HOLD_AFTER_NAV;
    header.classList.remove('is-hidden');
    last = window.scrollY;
    header.classList.toggle('is-stuck', window.scrollY > 12);
  };

  /* Same-page anchors never swap the container, so syncChrome does not run:
   * without this, the nav links scrolled the page down and took the bar with
   * them. Covers both the click and a back/forward hash change. */
  window.addEventListener('hashchange', resetHeaderState);
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.pathname === location.pathname && url.hash) resetHeaderState();
  });

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();

  if (!toggle || !menu) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('is-locked', open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
    } else {
      menu.classList.remove('is-open');
      const done = () => { menu.hidden = true; };
      if (canAnimate()) setTimeout(done, 700);
      else done();
    }
  };

  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') setOpen(false);
  });

  /* Same-page anchors: smooth-scroll past the fixed header. */
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href*="#"]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    const target = document.getElementById(url.hash.slice(1));
    if (!target) return;
    e.preventDefault();
    history.pushState(null, '', url.hash);
    /* Lenis owns the scroll position when it is running; a GSAP scrollTo would
     * set scrollTop underneath it and be pulled straight back. */
    if (scrollToTarget(target, header.offsetHeight + 12)) {
      /* handled */
    } else if (canAnimate() && window.ScrollToPlugin) {
      gsap.to(window, { duration: 1, ease: 'power3.inOut', scrollTo: { y: target, offsetY: header.offsetHeight + 12 } });
    } else {
      target.scrollIntoView();
    }
  });
}

const CHROME_LINKS = '.site-header a[href], .mobile-menu a[href]';

/**
 * Re-point the chrome after a client-side swap.
 *
 * Links are emitted relative to the page they live on, but the header and
 * mobile menu sit outside the swapped container, so their hrefs still describe
 * the *previous* page's depth. The freshly fetched document already has them
 * at the right depth — copy them across. The markup is identical on every
 * page, so a positional copy is safe, and the length check makes it a no-op if
 * that ever stops being true.
 */
export function syncChrome(doc, pathname) {
  const live = $$(CHROME_LINKS);
  const next = [...doc.querySelectorAll(CHROME_LINKS)];
  if (live.length === next.length) {
    live.forEach((link, i) => link.setAttribute('href', next[i].getAttribute('href')));
  }
  syncNav(pathname);
  /* A swap lands at the top of the new page without firing a scroll event, so
   * a header that was hidden when the link was clicked would stay hidden. */
  resetHeaderState();
}

/** Keep the nav's current-page marker in sync after a client-side swap. */
export function syncNav(pathname) {
  for (const link of $$('.nav__link')) {
    const path = new URL(link.href, location.href).pathname;
    link.classList.toggle('is-current', path === pathname || (path !== '/' && pathname.startsWith(path)));
  }
}
