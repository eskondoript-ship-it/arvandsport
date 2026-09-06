import { layout, esc, attr, splitWords, ICONS } from './layout.mjs';
import { sectionHead, playerCard, articleCard, personCard, statBlock } from './partials.mjs';
import { apex } from './apex.mjs';
import { spotlight } from './spotlight.mjs';


export function about(site) {
  return `<section class="about section section--paper" id="about">
  <div class="shell about__grid">
    <div class="about__copy">
      ${sectionHead({ kicker: site.about.eyebrow, title: 'Twenty-five years at the top level of football', n: '01' })}
      ${site.about.paragraphs.map((p) => `<p class="about__para" data-split-lines>${p}</p>`).join('')}
      <a class="btn btn--line" href="/services/" data-reveal data-magnetic><span>What we do</span>${ICONS.arrow}</a>
    </div>
    <div class="about__stats" data-stats>
      ${site.stats.map((s, i) => statBlock(s, i)).join('')}
    </div>
  </div>
  <img class="about__rule" src="/assets/img/ui/line-w.png" alt="" aria-hidden="true">
</section>`;
}

export function serviceGroup(group, groupIndex, firstIndex = '02') {
  return `<div class="services__group" id="${attr(group.id)}">
  ${sectionHead({ kicker: groupIndex === 0 ? 'What we do' : '', title: group.title, intro: esc(group.intro), n: groupIndex === 0 ? firstIndex : '' })}
  <div class="services__grid">
    ${group.items
      .map(
        (item, i) => `<article class="service" style="--i:${i}" data-reveal data-tilt>
      <span class="service__icon"><img src="${attr(item.icon)}" alt="" width="96" height="96" loading="lazy" decoding="async"></span>
      <h3 class="service__title">${esc(item.title)}</h3>
      <p class="service__body">${esc(item.body)}</p>
      <span class="service__index">${String(i + 1).padStart(2, '0')}</span>
    </article>`,
      )
      .join('')}
  </div>
</div>`;
}

/* The homepage carries a short teaser rather than all twelve services; the
 * full set lives at /services/. Four is one clean row at every breakpoint. */
function servicesTeaser(site) {
  const items = site.serviceGroups.flatMap((g) => g.items).slice(0, 4);
  return `<section class="services section" id="services">
  <div class="shell">
    ${sectionHead({ kicker: 'What we do', title: 'Services', intro: esc(site.serviceGroups[0].intro), n: '02' })}
    <div class="services__grid">
      ${items
        .map(
          (item, i) => `<article class="service" style="--i:${i}" data-reveal data-tilt>
        <span class="service__icon"><img src="${attr(item.icon)}" alt="" width="96" height="96" loading="lazy" decoding="async"></span>
        <h3 class="service__title">${esc(item.title)}</h3>
        <p class="service__body">${esc(item.body)}</p>
        <span class="service__index">${String(i + 1).padStart(2, '0')}</span>
      </article>`,
        )
        .join('')}
    </div>
    <div class="roster__more" data-reveal>
      <a class="btn btn--line" href="/services/" data-magnetic><span>All services</span>${ICONS.arrow}</a>
    </div>
  </div>
</section>`;
}

export function services(site) {
  return `<section class="services section" id="services">
  <div class="shell">
    ${site.serviceGroups.map(serviceGroup).join('')}
  </div>
</section>`;
}

/**
 * The roster, as a carousel that never reaches an end.
 *
 * The track carries the players twice and slides by exactly half its width, so
 * the moment it would show the join it is back where it started -- there is no
 * jump to hide because the frame at 100% and the frame at 0% are the same
 * picture. It is a CSS animation on a transform, which means it runs on the
 * compositor and keeps running while the main thread is busy; a JS loop here
 * would stutter every time something else on the page did.
 *
 * The second copy is aria-hidden. It is the same eleven players said twice, and
 * a screen reader should hear the roster once.
 */
function roster(site, players) {
  /* Gallery cards are 348px at their widest, so the browser needs to be told
     to fetch the 529 rather than the 265 it would pick from the grid's hint. */
  const lap = players
    .map((p, i) => playerCard(p, i, { sizes: '(max-width: 640px) 62vw, (max-width: 1024px) 34vw, 348px' }))
    .join('');
  const speed = Math.max(28, players.length * 4.5);

  return `<section class="roster roster--gallery section" id="players">
  <div class="shell">
    ${sectionHead({ kicker: 'Our clients', title: site.playersSection.title, intro: esc(site.playersSection.intro), n: '04' })}
  </div>

  <div class="carousel" data-carousel style="--carousel-speed:${speed}s">
    <div class="carousel__track" data-carousel-track>
      <div class="carousel__lap">${lap}</div>
      <div class="carousel__lap" aria-hidden="true">${lap}</div>
    </div>
  </div>

  <div class="shell">
    <div class="roster__more" data-reveal>
      <a class="btn btn--line" href="/player/" data-magnetic><span>All players</span>${ICONS.arrow}</a>
    </div>
  </div>
</section>`;
}



export function clients(site) {
  return `<section class="clients section" id="clients">
  <div class="shell">
    ${sectionHead({ kicker: 'Track record', title: site.formerClients.title, n: '05' })}
    <div class="clients__grid">
      ${site.formerClients.items.map((c, i) => personCard(c, i)).join('')}
    </div>
    ${sectionHead({ kicker: 'Arvand Talent', title: site.coaches.title })}
    <div class="clients__grid clients__grid--coaches">
      ${site.coaches.items.map((c, i) => personCard(c, i)).join('')}
    </div>
  </div>
</section>`;
}

export function team(site) {
  const t = site.team;
  return `<section class="team section" id="team">
  <div class="shell">
    ${sectionHead({ kicker: 'Who we are', title: t.title, intro: esc(t.intro), n: '06' })}
    <div class="team__lead" data-reveal>
      <figure class="team__lead-media" data-clip>
        <img src="${attr(t.lead.image)}" alt="${attr(t.lead.name)}" width="1024" height="1024" loading="lazy" decoding="async">
      </figure>
      <div class="team__lead-copy">
        <h3 class="team__lead-name">${esc(t.lead.name)}</h3>
        <p class="team__lead-role">${esc(t.lead.role)}</p>
        ${t.lead.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
      </div>
    </div>
    <div class="team__talent" data-reveal>
      <img src="${attr(t.talent.image)}" alt="${attr(t.talent.name)}" width="320" height="320" loading="lazy" decoding="async">
      <p>${t.talent.body}</p>
    </div>
    <div class="team__members">
      ${t.members.map((m, i) => personCard(m, i)).join('')}
    </div>
  </div>
</section>`;
}

function latestNews(site, news) {
  const [lead, ...rest] = news.slice(0, 6);
  return `<section class="latest section" id="news">
  <div class="shell">
    ${sectionHead({ kicker: 'Newsroom', title: site.pages.homeNews.title, n: '07' })}
    <div class="latest__grid" data-skew>
      ${articleCard(lead, 0, { featured: true })}
      ${rest.map((a, i) => articleCard(a, i + 1)).join('')}
    </div>
    <div class="latest__more" data-reveal>
      <a class="btn btn--line" href="/news/" data-magnetic><span>${esc(site.pages.homeNews.moreLabel)}</span>${ICONS.arrow}</a>
    </div>
  </div>
</section>`;
}

function partners(site) {
  const row = site.partners.items
    .map((p) => `<li class="marquee__item"><img src="${attr(p.image)}" alt="${attr(p.name)}" loading="lazy" decoding="async"></li>`)
    .join('');
  return `<section class="partners section" id="partners">
  <div class="shell">${sectionHead({ kicker: 'Network', title: site.partners.title, align: 'center', n: '08' })}</div>
  <div class="marquee" data-marquee>
    <ul class="marquee__track">${row}</ul>
    <ul class="marquee__track" aria-hidden="true">${row}</ul>
  </div>
</section>`;
}

export function contact(site) {
  return `<section class="contact section" id="contacts">
  <div class="shell">
    ${sectionHead({ kicker: 'Say hello', title: site.contact.title, n: '09' })}
    <div class="contact__grid">
      <div class="contact__map" data-reveal data-clip>
        <img src="${attr(site.contact.map)}" alt="Arvand Sport offices around the world" width="1200" height="620" loading="lazy" decoding="async">
      </div>
      <ul class="contact__offices">
        ${site.contact.offices
          .map(
            (o, i) => `<li class="office" style="--i:${i}" data-reveal>
          <h3 class="office__country">${esc(o.country)}</h3>
          ${o.phone ? `<a class="office__row" href="tel:${attr(o.phone.replace(/\s/g, ''))}">${ICONS.phone}<span>${esc(o.phone)}</span></a>` : ''}
          ${o.email ? `<a class="office__row" href="mailto:${attr(o.email)}">${ICONS.mail}<span>${esc(o.email)}</span></a>` : ''}
          ${o.address ? `<p class="office__row office__row--static">${ICONS.pin}<span>${esc(o.address)}</span></p>` : ''}
        </li>`,
          )
          .join('')}
      </ul>
    </div>
    <div class="contact__cta" data-reveal>
      ${site.contact.emails.map((e) => `<a class="btn btn--ghost" href="mailto:${attr(e)}" data-magnetic><span>${esc(e)}</span></a>`).join('')}
      <a class="btn btn--solid" href="/registration/" data-magnetic><span>Player / Coach Registration</span>${ICONS.arrow}</a>
    </div>
  </div>
</section>`;
}

/* Contact moved to its own page, so the homepage ends on an invitation
 * rather than a form. */
function closing(site) {
  return `<section class="section closing">
  <div class="shell closing__inner">
    <p class="closing__kicker" data-reveal>${esc(site.brand.tagline)}</p>
    <h2 class="closing__title" data-split>Work with Arvand Sport</h2>
    <div class="closing__actions" data-reveal>
      <a class="btn btn--solid btn--lg" href="/registration/" data-magnetic><span>Player &amp; coach registration</span>${ICONS.arrow}</a>
      <a class="btn btn--ghost btn--lg" href="/contact/" data-magnetic><span>Contact us</span></a>
    </div>
  </div>
</section>`;
}

export function renderHome({ site, players, news, taremiModel = false }) {
  const description = `${site.brand.shortName} — ${site.about.paragraphs[0].replace(/<[^>]+>/g, '').slice(0, 150)}`;
  return layout({
    site,
    namespace: 'home',
    current: '/',
    title: `${site.brand.name} – ${site.brand.tagline}`,
    description,
    canonicalPath: '/',
    image: site.hero.background,
    bodyClass: 'page-home',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SportsOrganization',
      name: site.brand.name,
      url: site.brand.url,
      slogan: site.brand.tagline,
      logo: `${site.brand.url}${site.brand.logo}`,
      email: site.contact.emails[0],
      sameAs: site.contact.social.map((s) => s.href),
      address: site.contact.offices
        .filter((o) => o.address && o.address !== 'Soon...')
        .map((o) => ({ '@type': 'PostalAddress', addressCountry: o.country, streetAddress: o.address })),
    },
    content: [
      apex(site, players, { taremiModel }),
      spotlight(site, players),
      about(site),
      servicesTeaser(site),
      roster(site, players),
      latestNews(site, news),
      partners(site),
      closing(site),
    ].join('\n'),
  });
}
