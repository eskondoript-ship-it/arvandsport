/** Sticky header state, scroll progress bar and the mobile drawer. */
import { $, $$, gsap, canAnimate } from './env.js';

export function initHeader() {
  const header = $('[data-header]');
  const progress = $('[data-scroll-progress]');
  const toggle = $('[data-menu-toggle]');
  const menu = $('[data-mobile-menu]');
  if (!header) return;

  let last = window.scrollY;
  let ticking = false;

  const update = () => {
    const y = window.scrollY;
    header.classList.toggle('is-stuck', y > 12);
    /* Hide on the way down, reveal on the way up — but never while the
     * drawer is open, and never in the first viewport. */
    const hide = y > 320 && y > last && !menu?.classList.contains('is-open');
    header.classList.toggle('is-hidden', hide);
    last = y;

    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
    }
    ticking = false;
  };

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
    if (canAnimate() && window.ScrollToPlugin) {
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
}

/** Keep the nav's current-page marker in sync after a client-side swap. */
export function syncNav(pathname) {
  for (const link of $$('.nav__link')) {
    const path = new URL(link.href, location.href).pathname;
    link.classList.toggle('is-current', path === pathname || (path !== '/' && pathname.startsWith(path)));
  }
}
