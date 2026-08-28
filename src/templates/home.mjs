import { layout, esc, attr, splitWords, ICONS } from './layout.mjs';
import { sectionHead, playerCard, articleCard, personCard, statBlock } from './partials.mjs';

function hero(site) {
  return `<section class="hero" id="home" data-hero>
  <div class="hero__bg" data-hero-bg>
    <img src="${site.hero.background}" alt="" width="1920" height="1080" fetchpriority="high" decoding="async">
  </div>
  <div class="hero__smoke" data-hero-smoke style="background-image:url('${site.hero.smoke}')" aria-hidden="true"></div>
  <div class="hero__veil" aria-hidden="true"></div>
  <div class="shell hero__inner">
    <p class="hero__eyebrow" data-hero-eyebrow>FIFA-licensed football &amp; match agency</p>
    <h1 class="hero__title" data-hero-title>${splitWords(site.hero.title, { letters: true })}</h1>
    <p class="hero__tagline" data-hero-tagline>${splitWords(site.hero.tagline)}</p>
    <div class="hero__actions" data-hero-actions>
      <a class="btn btn--solid btn--lg" href="/player/" data-magnetic><span>Our players</span>${ICONS.arrow}</a>
      <a class="btn btn--ghost btn--lg" href="/registration/" data-magnetic><span>Register</span></a>
    </div>
  </div>
  <a class="hero__scroll" href="#about" data-hero-scroll aria-label="Scroll to content">
    <span class="hero__scroll-line"></span><span>Scroll</span>
  </a>
</section>`;
}

function about(site) {
  return `<section class="about section" id="about">
  <div class="shell about__grid">
    <div class="about__copy">
      ${sectionHead({ kicker: site.about.eyebrow, title: 'Twenty-five years at the top level of football' })}
      ${site.about.paragraphs.map((p) => `<p class="about__para" data-reveal>${p}</p>`).join('')}
      <a class="btn btn--line" href="/#services" data-reveal data-magnetic><span>What we do</span>${ICONS.arrow}</a>
    </div>
    <div class="about__stats" data-stats>
      ${site.stats.map((s, i) => statBlock(s, i)).join('')}
    </div>
  </div>
  <img class="about__rule" src="/assets/img/ui/line-w.png" alt="" aria-hidden="true">
</section>`;
}

function serviceGroup(group, groupIndex) {
  return `<div class="services__group" id="${attr(group.id)}">
  ${sectionHead({ kicker: groupIndex === 0 ? 'What we do' : '', title: group.title, intro: esc(group.intro) })}
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

function services(site) {
  return `<section class="services section" id="services">
  <div class="shell">
    ${site.serviceGroups.map(serviceGroup).join('')}
  </div>
</section>`;
}

function roster(site, players) {
  return `<section class="roster section" id="players">
  <div class="shell">
    ${sectionHead({ kicker: 'Our roster', title: site.playersSection.title, intro: esc(site.playersSection.intro) })}
    <div class="roster__grid">${players.map((p, i) => playerCard(p, i)).join('')}</div>
    <div class="roster__more" data-reveal>
      <a class="btn btn--line" href="/player/" data-magnetic><span>All players</span>${ICONS.arrow}</a>
    </div>
  </div>
</section>`;
}

function clients(site) {
  return `<section class="clients section" id="clients">
  <div class="shell">
    ${sectionHead({ kicker: 'Track record', title: site.formerClients.title })}
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

function team(site) {
  const t = site.team;
  return `<section class="team section" id="team">
  <div class="shell">
    ${sectionHead({ kicker: 'Who we are', title: t.title, intro: esc(t.intro) })}
    <div class="team__lead" data-reveal>
      <figure class="team__lead-media">
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
    ${sectionHead({ kicker: 'Newsroom', title: site.pages.homeNews.title })}
    <div class="latest__grid">
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
  <div class="shell">${sectionHead({ kicker: 'Network', title: site.partners.title, align: 'center' })}</div>
  <div class="marquee" data-marquee>
    <ul class="marquee__track">${row}</ul>
    <ul class="marquee__track" aria-hidden="true">${row}</ul>
  </div>
</section>`;
}

function contact(site) {
  return `<section class="contact section" id="contacts">
  <div class="shell">
    ${sectionHead({ kicker: 'Say hello', title: site.contact.title })}
    <div class="contact__grid">
      <div class="contact__map" data-reveal>
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

export function renderHome({ site, players, news }) {
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
      hero(site),
      about(site),
      services(site),
      roster(site, players),
      clients(site),
      team(site),
      latestNews(site, news),
      partners(site),
      contact(site),
    ].join('\n'),
  });
}
