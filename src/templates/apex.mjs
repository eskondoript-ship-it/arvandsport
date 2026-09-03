/**
 * The homepage's opening: the match-ball study, told over three chapters.
 *
 *   01  the ball turns, the camera closes in
 *   02  the strike — the shell opens along its seams and crosses to wireframe
 *   03  the camera comes round to the owner and the agency's figures
 *
 * This is the same scene as the page at /experience/, not a version of it. The
 * WebGL half is literally that app's own components, bundled by
 * experience/scripts/build-hero.mjs; the choreography is one shared function of
 * scroll progress; the chapter copy is one block in content/site.json that both
 * read. The only things that differ are where the assets sit and who reads the
 * scroll, and both of those are arguments rather than second copies.
 *
 * What is here rather than in the bundle is everything made of words: the
 * chapters, the readouts, the stat cards. They are real HTML from the site's
 * own templates, so they are in the page for search engines, for anyone the
 * bundle never reaches, and for the phones deliberately not sent it.
 *
 * The stage is held by `position: sticky`, not by a scroll library. Four
 * viewport-heights of section, one screen of stage inside it: the browser does
 * the holding, so it cannot desynchronise from the scroll and it still holds
 * with JavaScript off. JS adds the scrub on top.
 *
 * Every figure is the agency's own, from content/players.json.
 */
import { esc, attr, ICONS } from './layout.mjs';

/* The ball is the FIFA Trionda, the client's own supplied model. On a wide
 * screen with a working WebGL2 context it is the real mesh: its four panels are
 * recovered from the geometry by tools/glb-panels.py, which is what lets the
 * scene open it along its actual seams rather than along invented ones.
 * Everywhere else it is a 30-frame rotation sprite, which costs one
 * background-position write per frame and stays on the compositor. The sprite
 * is rendered from that same file by tools/render-sprite.mjs -- it used to be a
 * render of a different ball, so the page opened on one ball and swapped it for
 * another in front of the visitor. See the note in src/scripts/apex.js for who
 * gets which, and why.
 */

const CROSSHAIR = `<svg class="apex__crosshair" viewBox="0 0 40 40" aria-hidden="true" fill="none">
  <circle cx="20" cy="20" r="11.5" stroke="currentColor" stroke-width=".75" opacity=".5" />
  <circle cx="20" cy="20" r="1.6" fill="currentColor" />
  <path d="M20 0v9M20 31v9M0 20h9M31 20h9" stroke="currentColor" stroke-width=".75" opacity=".7" />
</svg>`;

export function apex(site, _players = [], { taremiModel = false } = {}) {
  const [lead, tail] = ['ARVAND', 'SPORT'];
  const chapters = site.story?.chapters || [];

  return `<section class="apex" id="home" data-apex aria-labelledby="apex-title">
  <div class="apex__pin" data-apex-pin>
    <span class="apex__aurora" aria-hidden="true"></span>

    ${blueprint(site)}

    <!-- Empty until apex.js decides this visitor gets the WebGL scene and the
         island mounts into it. It fills the whole stage rather than sitting in
         the sprite's box: the scene is a full-frame composition -- grid floor,
         vignette, a camera that pulls back a long way -- and boxed into a
         430px square it renders a ball the size of a coin. -->
    <div class="apex__webgl" data-apex-webgl></div>

    <div class="apex__object" data-apex-object aria-hidden="true">
      <span class="apex__core"></span>
      <span class="apex__ball" data-apex-ball></span>
    </div>

    <div class="apex__chapter apex__chapter--brand" data-apex-chapter="0">
      <h1 class="apex__title" id="apex-title">
        <span class="u-sr-only">${esc(site.brand.name)} — ${esc(site.brand.tagline)}</span>
        <span class="apex__display" aria-hidden="true">
          <span class="apex__word apex__word--lead" data-apex-word>${esc(lead)}</span>
          <span class="apex__word apex__word--tail" data-apex-word>${esc(tail)}</span>
        </span>
      </h1>

      <div class="apex__actions" data-apex-fade>
        <a class="btn btn--solid btn--lg" href="/player/" data-magnetic><span>Our players</span>${ICONS.arrow}</a>
        <a class="btn btn--ghost btn--lg" href="/registration/" data-magnetic><span>Register</span></a>
      </div>
    </div>

    ${chapters.map((chapter, i) => storyChapter(chapter, i)).join('\n')}
  </div>
</section>`;
}

/**
 * The instrument frame: hairline rules, crosshairs, the chapter rail and the
 * live readouts. Static markup — apex.js writes the numbers straight into the
 * two spans below rather than re-rendering anything, because they change every
 * frame of a scrub and everything around them does not.
 */
function blueprint(site) {
  return `<div class="apex__hud" aria-hidden="true">
      <span class="apex__rule apex__rule--top"></span>
      <span class="apex__rule apex__rule--bottom"></span>
      <span class="apex__rule apex__rule--left"></span>
      <span class="apex__rule apex__rule--right"></span>
      ${CROSSHAIR.replace('apex__crosshair', 'apex__crosshair apex__crosshair--tl')}
      ${CROSSHAIR.replace('apex__crosshair', 'apex__crosshair apex__crosshair--br')}

      <p class="apex__stamp apex__stamp--left">${esc(site.brand.shortName)} · football &amp; match agency</p>
      <p class="apex__stamp apex__stamp--right">FIFA licensed</p>

      <div class="apex__rail">
        <div class="apex__rail-index">
          ${(site.story?.chapters || [])
            .map((c, i) => `<span data-apex-rail="${i}">${esc(c.index)}</span>`)
            .join('')}
        </div>
        <div class="apex__rail-track"><span data-apex-bar></span></div>
        <p class="apex__rail-count"><span data-apex-count>000</span><span> / 100</span></p>
      </div>

      <p class="apex__readout"><span data-apex-readout>X 0.0  Y 0.0°</span></p>
      ${statColumn(site)}
    </div>`;
}

/**
 * The agency's own figures, down the right. Chapter three only.
 *
 * These are the four numbers in content/site.json's stats block -- the same
 * ones the About section counts up -- rather than a set written for this
 * layout. The licences beneath them are what the agency actually holds, and
 * they are the reason the numbers are worth anything.
 */
function statColumn(site) {
  const stats = (site.stats || []).map((stat) => [
    stat.label,
    `${stat.value}${stat.suffix || ''}`,
  ]);

  const licences = [
    ['FIFA', 'Football agent', 'Licensed to represent players'],
    ['FIFA', 'Match agent', 'Licensed to arrange fixtures'],
  ];

  return `<div class="apex__stats" data-apex-stats>
        <p class="apex__stats-name">${esc(site.brand.shortName)} — ${esc(site.brand.tagline)}</p>
        ${stats
          .map(
            ([label, value], i) => `<div class="apex__stat" style="--i:${i}">
          <p class="apex__stat-label">${esc(label)}</p>
          <p class="apex__stat-value">${esc(value)}</p>
        </div>`,
          )
          .join('')}
        <div class="apex__career">
          ${licences
            .map(
              ([year, club, detail]) => `<div>
            <p class="apex__career-year">${esc(year)}</p>
            <p class="apex__career-club">${esc(club)}</p>
            <p class="apex__career-detail">${esc(detail)}</p>
          </div>`,
            )
            .join('')}
        </div>
      </div>`;
}

/** One chapter of copy. The brand line above is chapter zero's companion. */
function storyChapter(chapter, index) {
  const [first, ...rest] = chapter.title.split('\n');
  return `<div class="apex__chapter apex__chapter--story" data-apex-chapter="${index + 1}">
      <div class="apex__copy">
        <p class="apex__kicker">${esc(chapter.index)} — ${esc(chapter.kicker)}</p>
        <h2 class="apex__headline">${esc(first)}${rest.map((line) => `<br>${esc(line)}`).join('')}</h2>
        <p class="apex__body">${esc(chapter.body)}</p>
        ${
          index === 2
            ? `<a class="btn btn--ghost" href="/about/" data-magnetic><span>About the agency</span>${ICONS.arrow}</a>`
            : ''
        }
      </div>
    </div>`;
}
