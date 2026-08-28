import { layout, esc, attr, ICONS } from './layout.mjs';
import { sectionHead, articleCard, formatDate, isoDate } from './partials.mjs';

export function renderNewsIndex({ site, news }) {
  const [lead, ...rest] = news;
  const content = `
<section class="page-hero page-hero--news">
  <div class="shell">
    <p class="page-hero__kicker" data-reveal>${esc(site.pages.news.subtitle)}</p>
    <h1 class="page-hero__title" data-split>${esc(site.pages.news.title)}</h1>
    <label class="field field--search field--hero" data-reveal>
      <span class="u-sr-only">${esc(site.pages.news.searchPlaceholder)}</span>
      ${ICONS.search}
      <input type="search" data-news-search placeholder="${attr(site.pages.news.searchPlaceholder)}" autocomplete="off">
    </label>
  </div>
  <div class="page-hero__glow" aria-hidden="true"></div>
</section>
<section class="section section--tight">
  <div class="shell">
    <div class="latest__grid" data-news-list>
      ${articleCard(lead, 0, { featured: true })}
      ${rest.map((a, i) => articleCard(a, i + 1)).join('')}
    </div>
    <p class="roster__empty" data-news-empty hidden>No articles match that search.</p>
  </div>
</section>`;

  return layout({
    site,
    namespace: 'news',
    current: '/news/',
    title: `News – ${site.brand.name}`,
    description: site.pages.news.subtitle,
    canonicalPath: '/news/',
    image: lead.image,
    bodyClass: 'page-news',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: site.pages.news.title,
      url: `${site.brand.url}/news/`,
      blogPost: news.map((a) => ({
        '@type': 'BlogPosting',
        headline: a.title,
        url: `${site.brand.url}${a.url}`,
        datePublished: isoDate(a.date),
      })),
    },
    content,
  });
}

export function renderArticle({ site, news, article }) {
  const idx = news.findIndex((a) => a.slug === article.slug);
  const next = news[(idx + 1) % news.length];
  const prev = news[(idx - 1 + news.length) % news.length];
  const related = news.filter((a) => a.slug !== article.slug).slice(0, 3);
  const shareUrl = `${site.brand.url}${article.url}`;

  const content = `
<article class="article">
  <header class="article__hero" data-article-hero>
    <div class="article__hero-media" data-article-media>
      <img src="${attr(article.image)}" alt="" width="800" height="535" fetchpriority="high" decoding="async">
    </div>
    <div class="shell article__hero-inner">
      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="/">Home</a>${ICONS.arrow}<a href="/news/">News</a>${ICONS.arrow}<span>${esc(article.title)}</span>
      </nav>
      <h1 class="article__title" data-split>${esc(article.title)}</h1>
      <p class="article__meta" data-reveal>
        <a href="/author/${attr(article.authorSlug)}/">${esc(article.author)}</a>
        <span class="news-card__dot"></span>
        <time datetime="${attr(isoDate(article.date))}">${formatDate(article.date)}</time>
        <span class="news-card__dot"></span>
        <span>${article.readingMinutes} min read</span>
      </p>
    </div>
  </header>

  <div class="shell article__layout">
    <div class="article__body prose" data-article-body>
      ${article.body}
    </div>
    <aside class="article__aside">
      <div class="panel panel--sticky" data-reveal>
        <h2 class="panel__title">Share here:</h2>
        <ul class="share">
          <li><a href="https://wa.me/?text=${encodeURIComponent(`${article.title} ${shareUrl}`)}" target="_blank" rel="noopener">WhatsApp</a></li>
          <li><a href="https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(article.title)}" target="_blank" rel="noopener">Telegram</a></li>
          <li><a href="mailto:?subject=${encodeURIComponent(article.title)}&body=${encodeURIComponent(shareUrl)}">Email</a></li>
          <li><button type="button" data-copy-link data-url="${attr(shareUrl)}">Copy link</button></li>
        </ul>
        <p class="panel__note">${esc(site.pages.news.subtitle)}</p>
      </div>
    </aside>
  </div>

  <nav class="shell pager pager--wide" aria-label="Article navigation">
    <a class="pager__link pager__link--prev" href="${attr(prev.url)}"><span>Previous</span><strong>${esc(prev.title)}</strong></a>
    <a class="pager__link pager__link--next" href="${attr(next.url)}"><span>Next</span><strong>${esc(next.title)}</strong></a>
  </nav>

  <section class="section">
    <div class="shell">
      ${sectionHead({ kicker: 'Keep reading', title: 'Related News' })}
      <div class="latest__grid latest__grid--thirds">${related.map((a, i) => articleCard(a, i)).join('')}</div>
    </div>
  </section>
</article>`;

  return layout({
    site,
    namespace: 'article',
    current: '/news/',
    title: `${article.title} – ${site.brand.name}`,
    description: article.excerpt,
    canonicalPath: article.url,
    image: article.image,
    bodyClass: 'page-article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: article.title,
      url: shareUrl,
      image: `${site.brand.url}${article.image}`,
      datePublished: isoDate(article.date),
      dateModified: isoDate(article.modified),
      author: { '@type': 'Person', name: article.author, url: `${site.brand.url}/author/${article.authorSlug}/` },
      publisher: {
        '@type': 'Organization',
        name: site.brand.name,
        logo: { '@type': 'ImageObject', url: `${site.brand.url}${site.brand.logo}` },
      },
      description: article.excerpt,
    },
    content,
  });
}
