import { layout, ICONS } from './layout.mjs';

export function renderNotFound({ site }) {
  const content = `
<section class="page-hero page-hero--404">
  <div class="shell">
    <p class="page-hero__kicker" data-reveal>404</p>
    <h1 class="page-hero__title" data-split>This page is off the pitch</h1>
    <p class="page-hero__intro" data-reveal>The page you were looking for has moved or never existed.</p>
    <div class="hero__actions" data-reveal>
      <a class="btn btn--solid btn--lg" href="/" data-magnetic><span>Back home</span>${ICONS.arrow}</a>
      <a class="btn btn--ghost btn--lg" href="/player/" data-magnetic><span>Our players</span></a>
    </div>
  </div>
  <div class="page-hero__glow" aria-hidden="true"></div>
</section>`;

  return layout({
    site,
    namespace: 'notfound',
    current: '/',
    title: `Page not found – ${site.brand.name}`,
    description: 'The page you were looking for has moved or never existed.',
    canonicalPath: '/404.html',
    bodyClass: 'page-404',
    content,
  });
}
