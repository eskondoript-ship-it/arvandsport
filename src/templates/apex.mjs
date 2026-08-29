/**
 * The homepage's opening story: two chapters over one held stage.
 *
 *   01  ARVAND / SPORT, with the ball turning in the gap between them
 *   02  the shell opens along its seams and Taremi arrives with his figures
 *
 * The reference is an editorial studio hero — near-black ground, one huge thin
 * serif line, an object occluding its middle, a single coloured core, small
 * uppercase labels pinned to the corners.
 *
 * The stage is held by `position: sticky`, not by a scroll library. Two hundred
 * viewport-heights of section, one screen of sticky stage inside it: the
 * browser does the holding, it cannot desynchronise from the scroll, and it
 * still works with JavaScript off. What JS adds is the scrub — which chapter is
 * lit, and how far the ball has opened.
 *
 * Every word of both chapters is here, in HTML, rendered by the site's own
 * templates and styled by its stylesheet. None of it lives inside the WebGL
 * bundle. So it is in the page for search engines, for anyone whose browser
 * never gets that bundle, and for the phones that are deliberately not sent it
 * — and there is no second copy of the copy to drift out of step.
 *
 * The figures are the agency's own, from content/players.json.
 */
import { esc, attr, ICONS } from './layout.mjs';

/* The ball is the client's own model. On a wide screen with a working WebGL2
 * context it is the real mesh — 32 panels recovered from the supplied OBJ by
 * tools/obj-to-glb.py, drawn by the React Three Fiber island in
 * experience/hero/. Everywhere else it is a 30-frame rotation sprite rendered
 * from the same mesh by tools/render-ball.py, which costs one
 * background-position write per frame and stays on the compositor. See the
 * note in src/scripts/apex.js for who gets which, and why.
 */

export function apex(site, players = [], { taremiModel = false } = {}) {
  const [lead, tail] = ['ARVAND', 'SPORT'];
  const featured = players.find((p) => p.slug === (site.strike?.playerSlug || 'mehdi-taremi'));

  return `<section class="apex" id="home" data-apex aria-labelledby="apex-title">
  <div class="apex__pin" data-apex-pin>

    <div class="apex__chapter apex__chapter--brand" data-apex-chapter="0">
      <p class="apex__eyebrow" data-apex-fade>FIFA-licensed football &amp; match agency</p>

      <h1 class="apex__title" id="apex-title">
        <span class="u-sr-only">${esc(site.brand.name)} — ${esc(site.brand.tagline)}</span>
        <span class="apex__display" aria-hidden="true">
          <span class="apex__word apex__word--lead" data-apex-word>${esc(lead)}</span>
          <span class="apex__word apex__word--tail" data-apex-word>${esc(tail)}</span>
        </span>
      </h1>

      <p class="apex__label apex__label--right" data-apex-fade>Twenty-five years<br>at the top level</p>
      <p class="apex__label apex__label--left" data-apex-fade>${esc(site.stats?.[3]?.value || '230')}+ players<br>${esc(site.stats?.[1]?.value || '46')} countries</p>

      <div class="apex__actions" data-apex-fade>
        <a class="btn btn--solid btn--lg" href="/player/" data-magnetic><span>Our players</span>${ICONS.arrow}</a>
        <a class="btn btn--ghost btn--lg" href="/registration/" data-magnetic><span>Register</span></a>
      </div>

      <a class="apex__scroll" href="#about" data-apex-fade aria-label="Scroll to content">
        <span class="apex__scroll-line"></span><span>Scroll</span>
      </a>
    </div>

    <div class="apex__object" data-apex-object aria-hidden="true">
      <span class="apex__core"></span>
      <span class="apex__ball" data-apex-ball></span>
      <!-- Empty until apex.js decides this visitor gets the WebGL ball and the
           island mounts into it. The sprite above stays in the markup and keeps
           rendering until it does, and stays for good if it never does. -->
      <div class="apex__webgl" data-apex-webgl${taremiModel ? ' data-apex-figure="taremi.glb"' : ''}></div>
    </div>

    ${featured ? playerChapter(site, featured) : ''}
  </div>
</section>`;
}

/**
 * Chapter two. The portrait here is shown only when the WebGL figure is not —
 * on a phone, or wherever the bundle did not load — so the chapter is never a
 * column of text beside an empty space.
 */
function playerChapter(site, player) {
  const image = site.strike?.image || player.image;
  const facts = [
    ['Caps', player.caps, 'Iran senior national team'],
    ['Goals', player.goals, 'for Iran'],
    ['Height', player.height, ''],
    ['Foot', player.foot, 'preferred'],
  ].filter(([, value]) => value);

  return `<div class="apex__chapter apex__chapter--player" data-apex-chapter="1">
      <figure class="apex__portrait" data-apex-portrait>
        <img src="${attr(image)}" alt="${attr(player.name)}" width="529" height="760" loading="lazy" decoding="async">
      </figure>

      <div class="apex__player">
        <p class="apex__eyebrow apex__eyebrow--inline">${esc(site.strike?.kicker || 'Client spotlight')}</p>
        <h2 class="apex__player-name">${esc(player.name)}</h2>
        <p class="apex__player-role">${esc([player.position?.detail, player.club].filter(Boolean).join(' · '))}</p>

        <dl class="apex__facts">
          ${facts
            .map(
              ([label, value, note]) => `<div>
            <dt>${esc(label)}</dt>
            <dd>${esc(value)}</dd>
            ${note ? `<p>${esc(note)}</p>` : ''}
          </div>`,
            )
            .join('')}
        </dl>

        <a class="btn btn--ghost" href="${attr(player.url)}" data-magnetic><span>Full profile</span>${ICONS.arrow}</a>
      </div>
    </div>`;
}
