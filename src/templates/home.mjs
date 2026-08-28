import { layout, esc, attr, splitWords, ICONS } from './layout.mjs';
import { sectionHead, playerCard, articleCard, personCard, statBlock, BALL_SVG, KICKER_SVG } from './partials.mjs';

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
  <div class="ticker" aria-hidden="true">
    <div class="ticker__track">${Array(2).fill(
      site.formerClients.items.concat(site.coaches.items).map((c) => `<span>${esc(c.name)}</span>`).join(''),
    ).join('')}</div>
  </div>
</section>`;
}

function about(site) {
  return `<section class="about section section--paper" id="about">
  <div class="shell about__grid">
    <div class="about__copy">
      ${sectionHead({ kicker: site.about.eyebrow, title: 'Twenty-five years at the top level of football', n: '01' })}
      ${site.about.paragraphs.map((p) => `<p class="about__para" data-split-lines>${p}</p>`).join('')}
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
  ${sectionHead({ kicker: groupIndex === 0 ? 'What we do' : '', title: group.title, intro: esc(group.intro), n: groupIndex === 0 ? '02' : '03' })}
  <div class="services__grid" data-deal>
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
    ${sectionHead({ kicker: 'Our roster', title: site.playersSection.title, intro: esc(site.playersSection.intro), n: '04' })}
    <div class="roster__grid">${players.map((p, i) => playerCard(p, i)).join('')}</div>
    <div class="roster__more" data-reveal>
      <a class="btn btn--line" href="/player/" data-magnetic><span>All players</span>${ICONS.arrow}</a>
    </div>
  </div>
</section>`;
}


/**
 * The scroll-scrubbed strike sequence.
 *
 * Everything here is real: the cutout is the site's own image of Mehdi Taremi,
 * and the payoff numbers are his caps and goals as published on his profile.
 * The kick is choreography — a run-up, a plant, a ball leaving the boot — not
 * a doctored photograph.
 *
 * The markup is authored as the finished frame: player planted, ball at the
 * net, copy visible. JS sets the start states and scrubs from there, so the
 * no-JS and reduced-motion renderings are a composed still.
 */
function strike(site, players) {
  const config = site.strike;
  const player = players.find((p) => p.slug === config.playerSlug);
  if (!player) return '';

  const speedLines = Array.from({ length: 7 }, (_, i) => `<span style="--i:${i}"></span>`).join('');
  /* Net mesh, drawn as two crossing line sets. */
  const mesh = [
    ...Array.from({ length: 13 }, (_, i) => `<line x1="${i * 20}" y1="0" x2="${i * 20}" y2="160" />`),
    ...Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${i * 20}" x2="240" y2="${i * 20}" />`),
  ].join('');

  return `<section class="strike" data-strike aria-labelledby="strike-title">
  <div class="strike__pin" data-strike-pin>
    <svg class="strike__pitch" data-strike-pitch viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <line data-draw x1="0" y1="470" x2="1200" y2="470" />
      <line data-draw x1="120" y1="300" x2="120" y2="600" />
      <path data-draw d="M780 600 L780 360 L1140 360 L1140 600" />
      <path data-draw d="M900 600 L900 460 L1140 460 L1140 600" />
      <circle data-draw cx="420" cy="470" r="90" />
    </svg>

    <div class="strike__speed" data-strike-speed aria-hidden="true">${speedLines}</div>

    <div class="strike__figure" data-strike-player>${KICKER_SVG}</div>

    <span class="strike__flash" data-strike-flash aria-hidden="true"></span>
    <div class="strike__ball" data-strike-ball aria-hidden="true">
      <span class="strike__tail" data-strike-tail></span>
      <span class="strike__ball-core" data-strike-spin>${BALL_SVG}</span>
    </div>

    <div class="strike__net-box" data-strike-netbox aria-hidden="true">
      <svg class="strike__net" data-strike-net viewBox="0 0 240 160">
        <g class="strike__mesh">${mesh}</g>
        <rect class="strike__frame" x="1" y="1" width="238" height="158" />
      </svg>
    </div>
    <span class="strike__shock" data-strike-shock aria-hidden="true"></span>

    <div class="strike__copy" data-strike-copy>
      <figure class="strike__portrait">
        <img src="${attr(config.image)}" alt="${attr(player.name)}" width="529" height="760" loading="lazy" decoding="async">
      </figure>
      <p class="strike__kicker">${esc(config.kicker)}</p>
      <h2 class="strike__title" id="strike-title" data-strike-title>${esc(player.name)}</h2>
      <p class="strike__sub">${esc([player.position.detail, player.club].filter(Boolean).join(' · '))}</p>
      <dl class="strike__stats" data-strike-stats>
        <div><dt>Caps</dt><dd><span data-scrub-counter="${attr(player.caps)}">${esc(player.caps)}</span></dd></div>
        <div><dt>Goals</dt><dd><span data-scrub-counter="${attr(player.goals)}">${esc(player.goals)}</span></dd></div>
      </dl>
      <a class="btn btn--solid" href="${attr(player.url)}" data-magnetic><span>Full profile</span>${ICONS.arrow}</a>
      ${
        config.video
          ? `<button class="embed" type="button"
              data-embed
              data-embed-provider="${attr(config.video.provider)}"
              data-embed-id="${attr(config.video.id)}"
              data-embed-title="${attr(`${player.name} — ${config.video.label}`)}">
        <img src="${attr(config.image)}" alt="" width="529" height="760" loading="lazy" decoding="async">
        <span class="embed__play" aria-hidden="true"></span>
        <span class="embed__label">${esc(config.video.label)}</span>
      </button>`
          : ''
      }
    </div>

    <p class="strike__hint" aria-hidden="true">${esc(config.caption)}</p>
  </div>
</section>`;
}

function clients(site) {
  return `<section class="clients section" id="clients">
  <div class="shell">
    ${sectionHead({ kicker: 'Track record', title: site.formerClients.title, n: '05' })}
    <div class="rail" data-rail>
      <div class="rail__track" data-rail-track>
        ${site.formerClients.items.map((c, i) => personCard(c, i)).join('')}
      </div>
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

function contact(site) {
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
      strike(site, players),
      clients(site),
      team(site),
      latestNews(site, news),
      partners(site),
      contact(site),
    ].join('\n'),
  });
}
