import { layout, esc, attr, ICONS } from './layout.mjs';

/** Fields mirror the live Elementor Pro form exactly, names included. */
export function renderRegistration({ site }) {
  const wp = site.wordpress;
  const f = wp.registrationForm;
  const content = `
<section class="page-hero page-hero--register">
  <div class="shell">
    <p class="page-hero__kicker" data-reveal>${esc(site.pages.registration.kicker)}</p>
    <h1 class="page-hero__title" data-split-chars>${esc(site.pages.registration.title)}</h1>
    <p class="page-hero__intro" data-reveal>${esc(site.pages.registration.intro)}</p>
  </div>
  <div class="page-hero__glow" aria-hidden="true"></div>
</section>

<section class="section section--tight">
  <div class="shell register">
    <form class="form" data-wp-form
      data-endpoint="${attr(wp.ajaxUrl)}"
      data-action="${attr(wp.action)}"
      data-post-id="${attr(f.postId)}"
      data-form-id="${attr(f.formId)}"
      data-referer-title="${attr(f.refererTitle)}"
      data-queried-id="${attr(f.queriedId)}"
      data-recaptcha="${attr(wp.recaptchaSiteKey)}"
      novalidate>
      <div class="form__grid">
        <label class="field" style="--i:0">
          <span class="field__label">Name</span>
          <input type="text" name="${attr(f.fields.name)}" required autocomplete="name" placeholder="Name">
          <span class="field__error" data-error></span>
        </label>
        <label class="field" style="--i:1">
          <span class="field__label">Nationality</span>
          <input type="text" name="${attr(f.fields.nationality)}" autocomplete="country-name" placeholder="Nationality">
          <span class="field__error" data-error></span>
        </label>
        <fieldset class="field field--radio" style="--i:2">
          <legend class="field__label">Position</legend>
          <div class="radios">
            ${f.positionOptions
              .map(
                (opt, i) => `<label class="radio">
              <input type="radio" name="${attr(f.fields.position)}" value="${attr(opt)}" ${i === 0 ? 'required' : ''}>
              <span class="radio__dot" aria-hidden="true"></span>
              <span class="radio__label">${esc(opt.trim())}</span>
            </label>`,
              )
              .join('')}
          </div>
          <span class="field__error" data-error></span>
        </fieldset>
        <label class="field" style="--i:3">
          <span class="field__label">Email</span>
          <input type="email" name="${attr(f.fields.email)}" required autocomplete="email" placeholder="Email">
          <span class="field__error" data-error></span>
        </label>
        <label class="field" style="--i:4">
          <span class="field__label">Phone number</span>
          <input type="tel" name="${attr(f.fields.phone)}" required autocomplete="tel"
            pattern="[0-9()#&amp;+*\\-=. ]+" title="Only numbers and phone characters (#, -, *, etc) are accepted."
            placeholder="Phone number">
          <span class="field__error" data-error></span>
        </label>
        <label class="field field--full" style="--i:5">
          <span class="field__label">Message</span>
          <textarea name="${attr(f.fields.message)}" rows="6" required placeholder="Message"></textarea>
          <span class="field__error" data-error></span>
        </label>
        <div class="field field--honeypot" aria-hidden="true">
          <input type="text" name="${attr(f.fields.honeypot)}" tabindex="-1" autocomplete="off">
        </div>
      </div>
      <div class="form__foot">
        <button class="btn btn--solid btn--lg" type="submit" data-magnetic>
          <span>${esc(site.pages.registration.submitLabel)}</span>${ICONS.arrow}
        </button>
        <p class="form__status" data-status role="status" aria-live="polite"></p>
      </div>
      <p class="form__legal">Protected by reCAPTCHA. Your message is delivered to the Arvand Sport office inbox.</p>
    </form>

    <aside class="register__aside">
      <div class="panel" data-reveal>
        <h2 class="panel__title">Prefer to write directly?</h2>
        <ul class="panel__list">
          ${site.contact.emails.map((e) => `<li><a href="mailto:${attr(e)}">${ICONS.mail}${esc(e)}</a></li>`).join('')}
          ${site.contact.offices
            .filter((o) => o.phone)
            .map((o) => `<li><a href="tel:${attr(o.phone.replace(/\s/g, ''))}">${ICONS.phone}${esc(o.phone)} <em>${esc(o.country)}</em></a></li>`)
            .join('')}
        </ul>
      </div>
      <div class="panel panel--muted" data-reveal>
        <h2 class="panel__title">What happens next</h2>
        <p>${esc(site.pages.registration.kicker)}</p>
      </div>
    </aside>
  </div>
</section>`;

  return layout({
    site,
    namespace: 'registration',
    current: '/registration/',
    title: `Registration – ${site.brand.name}`,
    description: site.pages.registration.intro,
    canonicalPath: '/registration/',
    bodyClass: 'page-registration',
    content,
  });
}
