/**
 * The opening set piece: a faceted sphere held between the two halves of a
 * display line, assembled by scroll.
 *
 * The reference for this is an editorial studio hero — near-black ground, one
 * huge thin serif line, a dark chrome object occluding its middle, a single
 * coloured core, and small uppercase labels pinned to the corners. The object
 * there is a WebGL creature; this is a football, and it is plain SVG so it
 * costs a few kilobytes rather than a 3D runtime — which matters, because the
 * page it opens has to load in seconds on a phone.
 *
 * The copy is the agency's own: the display line is their tagline, and the
 * corner labels are drawn from site.json rather than written for the layout.
 */
import { esc, attr, ICONS } from './layout.mjs';

/* The ball is the client's own FBX model, rendered to a rotation sprite by
 * tools/render-ball.py (geometry read by tools/fbx-extract.py, source kept in
 * assets-src/). Sprite rather than WebGL: the model is 8,192 vertices and
 * 14,760 faces, and a 3D runtime plus the mesh would have cost more than the
 * whole page currently weighs. Scrubbing frames costs one background-position
 * write and stays on the compositor.
 */

export function apex(site) {
  const [lead, tail] = ['ARVAND', 'SPORT'];

  return `<section class="apex" id="home" data-apex aria-labelledby="apex-title">
  <div class="apex__pin" data-apex-pin>
    <p class="apex__eyebrow" data-apex-fade>FIFA-licensed football &amp; match agency</p>

    <h1 class="apex__title" id="apex-title">
      <span class="u-sr-only">${esc(site.brand.name)} — ${esc(site.brand.tagline)}</span>
      <span class="apex__display" aria-hidden="true">
        <span class="apex__word apex__word--lead" data-apex-word>${esc(lead)}</span>
        <span class="apex__word apex__word--tail" data-apex-word>${esc(tail)}</span>
      </span>
    </h1>

    <div class="apex__object" data-apex-object aria-hidden="true">
      <span class="apex__core"></span>
      <span class="apex__ball" data-apex-ball></span>
    </div>

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
</section>`;
}
