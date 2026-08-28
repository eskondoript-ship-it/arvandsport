/** The HTML shell every page shares: head, chrome, transition overlay, footer. */

export const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const attr = (s = '') => esc(s).replace(/'/g, '&#39;');

/** Wrap each word (and each letter of a heading) so GSAP can stagger them. */
export function splitWords(text, { letters = false } = {}) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const inner = letters
        ? [...word].map((ch) => `<span class="ch">${esc(ch)}</span>`).join('')
        : esc(word);
      return `<span class="word"><span class="word__inner">${inner}</span></span>`;
    })
    .join(' ');
}

export const ICONS = {
  whatsapp:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.48 1.34 5L2 22l5.2-1.36a9.9 9.9 0 0 0 4.84 1.24h.01c5.49 0 9.95-4.46 9.95-9.96C22 6.46 17.54 2 12.04 2Zm0 18.14h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.1.81.83-3.02-.2-.31a8.17 8.17 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.17 8.17 0 0 1 2.41 5.82c0 4.54-3.7 8.21-8.24 8.21Zm4.52-6.15c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.71-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.41.09-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.23.24-.86.84-.86 2.05s.88 2.38 1 2.54c.13.17 1.74 2.65 4.2 3.72.59.25 1.05.4 1.4.52.59.19 1.13.16 1.55.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z"/></svg>',
  instagram:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.8 3.8 0 0 1-1.38-.9 3.8 3.8 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 2.13c-3.14 0-3.5.01-4.74.07-1.14.05-1.76.24-2.18.4-.55.21-.94.47-1.35.88-.41.41-.67.8-.88 1.35-.16.42-.35 1.04-.4 2.18-.06 1.24-.07 1.6-.07 4.74s.01 3.5.07 4.74c.05 1.14.24 1.76.4 2.18.21.55.47.94.88 1.35.41.41.8.67 1.35.88.42.16 1.04.35 2.18.4 1.24.06 1.6.07 4.74.07s3.5-.01 4.74-.07c1.14-.05 1.76-.24 2.18-.4.55-.21.94-.47 1.35-.88.41-.41.67-.8.88-1.35.16-.42.35-1.04.4-2.18.06-1.24.07-1.6.07-4.74s-.01-3.5-.07-4.74c-.05-1.14-.24-1.76-.4-2.18a3.6 3.6 0 0 0-.88-1.35 3.6 3.6 0 0 0-1.35-.88c-.42-.16-1.04-.35-2.18-.4-1.24-.06-1.6-.07-4.74-.07Zm0 3.62a6.09 6.09 0 1 1 0 12.18 6.09 6.09 0 0 1 0-12.18Zm0 10.04a3.95 3.95 0 1 0 0-7.9 3.95 3.95 0 0 0 0 7.9Zm7.75-10.28a1.42 1.42 0 1 1-2.85 0 1.42 1.42 0 0 1 2.85 0Z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm9 7.2 7.4-4.7H4.6L12 12.2Zm0 2.36L4 9.5V17h16V9.5l-8 5.06Z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6.6 10.8a15.6 15.6 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.4 21 3 13.6 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.44.57 3.57a1 1 0 0 1-.25 1L6.6 10.8Z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a7 7 0 0 1 7 7c0 5.06-6.3 12.4-6.57 12.71a.57.57 0 0 1-.86 0C11.3 21.4 5 14.06 5 9a7 7 0 0 1 7-7Zm0 9.5A2.5 2.5 0 1 0 12 6.5a2.5 2.5 0 0 0 0 5Z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M13.2 4.6 20.6 12l-7.4 7.4-1.4-1.42 5-4.98H3.4v-2h13.4l-5-4.98 1.4-1.42Z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M10.5 3a7.5 7.5 0 0 1 5.92 12.13l4.72 4.73-1.28 1.28-4.73-4.72A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/></svg>',
};

function head({ site, title, description, canonicalPath, image, jsonLd, bodyClass }) {
  const origin = site.brand.url;
  const canonical = `${origin}${canonicalPath}`;
  const ogImage = `${origin}${image || site.brand.mark}`;
  return `<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${attr(canonical)}">
<meta name="theme-color" content="${site.brand.colors.secondary}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${attr(site.brand.name)}">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${attr(canonical)}">
<meta property="og:image" content="${attr(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/img/brand/mark-150.png" sizes="32x32">
<link rel="icon" href="/assets/img/brand/mark-300.png" sizes="192x192">
<link rel="apple-touch-icon" href="/assets/img/brand/mark-300.png">
<link rel="preload" href="/assets/fonts/roboto-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/main.css">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
<script>document.documentElement.classList.replace('no-js','js');</script>
</head>
<body class="${attr(bodyClass || '')}" data-barba="wrapper">`;
}

const CTA = { href: '/registration/', label: 'Registration' };

function header(site, current) {
  const isActive = (href) => (href === current || (href !== '/' && current.startsWith(href)) ? ' is-current' : '');
  /* Registration owns the header CTA, so it is dropped from the link row to
   * stop the label appearing twice side by side. The mobile menu has no CTA,
   * so it still lists every nav entry. */
  const links = site.nav
    .filter((item) => item.href !== CTA.href)
    .map(
      (item) =>
        `<li class="nav__item"><a class="nav__link${isActive(item.href)}" href="${attr(item.href)}"><span data-scramble>${esc(item.label)}</span></a></li>`,
    )
    .join('');
  return `
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header" data-header>
  <div class="site-header__inner shell">
    <a class="brand" href="/" aria-label="${attr(site.brand.name)} — home">
      <img class="brand__logo" src="${site.brand.logo}" alt="${attr(site.brand.name)}" width="1024" height="187">
    </a>
    <nav class="nav" aria-label="Primary">
      <ul class="nav__list">${links}</ul>
    </nav>
    <a class="btn btn--solid btn--sm site-header__cta${isActive(CTA.href)}" href="${attr(CTA.href)}"><span>${esc(CTA.label)}</span>${ICONS.arrow}</a>
    <button class="burger" type="button" data-menu-toggle aria-expanded="false" aria-controls="mobile-menu">
      <span class="burger__box"><span class="burger__bar"></span><span class="burger__bar"></span><span class="burger__bar"></span></span>
      <span class="u-sr-only">Menu</span>
    </button>
  </div>
  <div class="site-header__progress" data-scroll-progress></div>
</header>
<div class="mobile-menu" id="mobile-menu" data-mobile-menu hidden>
  <nav aria-label="Mobile">
    <ul class="mobile-menu__list">
      ${site.nav
        .map(
          (item, i) =>
            `<li class="mobile-menu__item" style="--i:${i}"><a href="${attr(item.href)}"><span class="mobile-menu__num">0${i + 1}</span>${esc(item.label)}</a></li>`,
        )
        .join('')}
    </ul>
  </nav>
  <div class="mobile-menu__foot">
    ${site.contact.social.map((s) => `<a href="${attr(s.href)}" target="_blank" rel="noopener">${ICONS[s.icon] || ''}<span class="u-sr-only">${esc(s.label)}</span></a>`).join('')}
  </div>
</div>`;
}

function footer(site) {
  const year = new Date().getFullYear();
  return `
<footer class="site-footer" id="footer">
  <div class="shell site-footer__grid">
    <div class="site-footer__brand">
      <img src="${site.brand.logoFooter}" alt="${attr(site.brand.name)}" width="300" height="55" loading="lazy">
      <p>${esc(site.footer.blurb)}</p>
      <form class="subscribe" data-subscribe novalidate>
        <label class="u-sr-only" for="subscribe-email">${esc(site.footer.subscribePlaceholder)}</label>
        <input id="subscribe-email" type="email" name="email" placeholder="${attr(site.footer.subscribePlaceholder)}" required autocomplete="email">
        <button class="btn btn--solid" type="submit"><span>${esc(site.footer.subscribeLabel)}</span></button>
        <p class="form__status" data-status role="status" aria-live="polite"></p>
      </form>
    </div>
    <nav class="site-footer__links" aria-label="Footer">
      <h2 class="site-footer__title">Explore</h2>
      <ul>${site.footer.links.map((l) => `<li><a href="${attr(l.href)}">${esc(l.label)}</a></li>`).join('')}</ul>
    </nav>
    <div class="site-footer__contact">
      <h2 class="site-footer__title">Get in touch</h2>
      <ul>
        ${site.contact.emails.map((e) => `<li><a href="mailto:${attr(e)}">${ICONS.mail}${esc(e)}</a></li>`).join('')}
        ${site.contact.offices
          .filter((o) => o.phone)
          .map((o) => `<li><a href="tel:${attr(o.phone.replace(/\s/g, ''))}">${ICONS.phone}${esc(o.phone)}<em>${esc(o.country)}</em></a></li>`)
          .join('')}
      </ul>
      <div class="site-footer__social">
        ${site.contact.social.map((s) => `<a href="${attr(s.href)}" target="_blank" rel="noopener" aria-label="${attr(s.label)}">${ICONS[s.icon] || ''}</a>`).join('')}
      </div>
    </div>
  </div>
  <div class="shell site-footer__legal">
    <p>${esc(site.footer.copyright.replace('2022-2023', `2022-${year}`))}</p>
    <p>Designed by <a href="${attr(site.footer.credit.href)}" target="_blank" rel="noopener">${esc(site.footer.credit.label)}</a></p>
  </div>
</footer>`;
}

/**
 * @param {object} o
 * @param {string} o.namespace  page identity, used by the transition runner
 * @param {string} o.content    the <main> markup
 */
export function layout(o) {
  const { site, namespace, content, current = '/' } = o;
  return `${head(o)}
<div class="page-transition" data-transition aria-hidden="true">
  <span class="page-transition__panel"></span>
  <img class="page-transition__mark" src="${site.brand.mark}" alt="" width="120" height="120">
</div>
<div class="grain" aria-hidden="true"></div>
${header(site, current)}
<div data-barba="container" data-barba-namespace="${attr(namespace)}">
  <main id="main" class="main">${content}</main>
  ${footer(site)}
</div>
<script src="/vendor/gsap/gsap.min.js" defer></script>
<script src="/vendor/gsap/ScrollTrigger.min.js" defer></script>
<script src="/vendor/gsap/ScrollToPlugin.min.js" defer></script>
<script type="module" src="/assets/js/main.js"></script>
</body>
</html>
`;
}
