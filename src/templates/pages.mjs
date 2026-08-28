/**
 * Standalone pages carved out of what used to be one long homepage.
 *
 * Each reuses the section it was built from rather than restating it, so the
 * content stays in one place and the homepage teaser and the full page cannot
 * drift apart. Section ids are preserved, so old /#services style links still
 * land on the right block once they reach the page.
 */
import { layout, esc, attr, ICONS } from './layout.mjs';
import { sectionHead } from './partials.mjs';
import { about, serviceGroup, clients, team, contact } from './home.mjs';

function pageHero({ kicker, title, intro }) {
  return `<section class="page-hero">
  <div class="shell">
    ${kicker ? `<p class="page-hero__kicker" data-reveal>${esc(kicker)}</p>` : ''}
    <h1 class="page-hero__title" data-split-chars>${esc(title)}</h1>
    ${intro ? `<p class="page-hero__intro" data-reveal>${esc(intro)}</p>` : ''}
  </div>
  <div class="page-hero__glow" aria-hidden="true"></div>
</section>`;
}

/* A shared tail so no page ends on a dead stop. */
function nextStep({ label, href, second }) {
  return `<section class="section section--tight closing">
  <div class="shell closing__inner">
    <h2 class="closing__title">${esc(label)}</h2>
    <div class="closing__actions">
      <a class="btn btn--solid" href="${attr(href)}" data-magnetic><span>${esc(second)}</span>${ICONS.arrow}</a>
      <a class="btn btn--ghost" href="/registration/" data-magnetic><span>Register</span></a>
    </div>
  </div>
</section>`;
}

export function renderServices({ site }) {
  const content = `
${pageHero({ kicker: 'What we do', title: site.pages?.services?.title || 'Services' })}
<section class="services section section--tight" id="services">
  <div class="shell">
    ${site.serviceGroups.map((group, i) => serviceGroup(group, i, '01')).join('')}
  </div>
</section>
${nextStep({ label: 'Ready to talk?', href: '/contact/', second: 'Contact us' })}`;

  return layout({
    site,
    namespace: 'services',
    current: '/services/',
    title: `Services – ${site.brand.name}`,
    description: site.serviceGroups[0].intro,
    canonicalPath: '/services/',
    bodyClass: 'page-services',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Services',
      itemListElement: site.serviceGroups
        .flatMap((g) => g.items)
        .map((item, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: { '@type': 'Service', name: item.title, description: item.body },
        })),
    },
    content,
  });
}

export function renderAbout({ site }) {
  const content = `
${about(site)}
${team(site)}
${clients(site)}
${nextStep({ label: 'Work with us', href: '/contact/', second: 'Contact us' })}`;

  return layout({
    site,
    namespace: 'about',
    current: '/about/',
    title: `About – ${site.brand.name}`,
    description: site.about.paragraphs[0].replace(/<[^>]+>/g, ''),
    canonicalPath: '/about/',
    bodyClass: 'page-about',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: `About ${site.brand.name}`,
      url: `${site.brand.url}/about/`,
    },
    content,
  });
}

export function renderContact({ site }) {
  const content = `
${contact(site)}`;

  return layout({
    site,
    namespace: 'contact',
    current: '/contact/',
    title: `Contact – ${site.brand.name}`,
    description: `Reach ${site.brand.shortName} — offices, phone numbers and email.`,
    canonicalPath: '/contact/',
    bodyClass: 'page-contact',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      name: `Contact ${site.brand.name}`,
      url: `${site.brand.url}/contact/`,
    },
    content,
  });
}

export { sectionHead };
