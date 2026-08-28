import { layout, esc, attr } from './layout.mjs';
import { articleCard } from './partials.mjs';

/** Author, category and date archives — the URLs WordPress already publishes. */
export function renderArchive({ site, heading, kicker, posts, canonicalPath }) {
  const content = `
<section class="page-hero page-hero--archive">
  <div class="shell">
    <p class="page-hero__kicker" data-reveal>${esc(kicker)}</p>
    <h1 class="page-hero__title" data-split>${esc(heading)}</h1>
    <p class="page-hero__intro" data-reveal>${posts.length} ${posts.length === 1 ? 'entry' : 'entries'}</p>
  </div>
  <div class="page-hero__glow" aria-hidden="true"></div>
</section>
<section class="section section--tight">
  <div class="shell">
    <div class="latest__grid latest__grid--thirds">${posts.map((p, i) => articleCard(p, i)).join('')}</div>
  </div>
</section>`;

  return layout({
    site,
    namespace: 'archive',
    current: canonicalPath,
    title: `${heading} – ${site.brand.name}`,
    description: `${kicker}: ${heading} — ${site.brand.shortName}.`,
    canonicalPath,
    bodyClass: 'page-archive',
    content,
  });
}
