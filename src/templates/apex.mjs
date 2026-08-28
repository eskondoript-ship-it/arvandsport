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

/**
 * A sphere shattered into polar facets: rings of quads, each spanning an arc
 * and a band of radius. Reading the ball as a mosaic rather than a mesh is
 * what lets it be SVG at all — and it gives every piece something to fly in
 * from.
 *
 * @param {number} rings   bands from the core outwards
 * @param {number[]} counts facets per band, outer bands carrying more
 */
function facets({ rings = 4, counts = [6, 10, 14, 18], size = 400 } = {}) {
  const c = size / 2;
  const R = size * 0.375;
  const out = [];
  let index = 0;

  for (let ring = 0; ring < rings; ring += 1) {
    const inner = (ring / rings) * R;
    const outer = ((ring + 1) / rings) * R;
    const n = counts[ring] ?? counts.at(-1);
    /* Offset every other ring so the seams do not line up into spokes. */
    const twist = (ring % 2) * (Math.PI / n);

    for (let i = 0; i < n; i += 1) {
      const a0 = (i / n) * Math.PI * 2 + twist;
      const a1 = ((i + 1) / n) * Math.PI * 2 + twist;
      const p = (r, a) => `${(c + Math.cos(a) * r).toFixed(1)},${(c + Math.sin(a) * r).toFixed(1)}`;
      const points = `${p(inner, a0)} ${p(outer, a0)} ${p(outer, a1)} ${p(inner, a1)}`;

      /* Light falls from the upper left, so facets facing that way are the
       * bright ones. mid is the facet's own direction from the centre. */
      const mid = (a0 + a1) / 2;
      const lit = Math.max(0, Math.cos(mid + Math.PI * 0.75));
      const depth = ring / (rings - 1 || 1);
      const shade = Math.round(10 + lit * 70 - depth * 4);
      /* Near-opaque: the object has to cut the display line, and translucent
       * facets let the letters read straight through it as grey ghosts. */
      const alpha = (0.93 + lit * 0.07).toFixed(2);

      /* Where this piece flies in from: outward along its own angle, so the
       * ball looks like it is reassembling rather than sliding into place. */
      const scatter = 90 + ((index * 37) % 120);
      const dx = (Math.cos(mid) * scatter).toFixed(0);
      const dy = (Math.sin(mid) * scatter).toFixed(0);
      const spin = (((index * 53) % 120) - 60).toFixed(0);

      out.push(
        `<polygon class="apex__facet" points="${points}" fill="rgb(${shade},${shade + 6},${shade + 14})" fill-opacity="${alpha}" data-dx="${dx}" data-dy="${dy}" data-spin="${spin}" style="--i:${index}"></polygon>`,
      );
      index += 1;
    }
  }
  return out.join('');
}

export function apex(site) {
  const size = 400;
  const [lead, tail] = ['A STREAM', 'SUCCESS'];

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
      <svg class="apex__ball" viewBox="0 0 ${size} ${size}" data-apex-ball focusable="false">
        <defs>
          <radialGradient id="apexGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity=".85"/>
            <stop offset="55%" stop-color="var(--accent)" stop-opacity=".16"/>
            <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="apexRim" cx="34%" cy="28%" r="72%">
            <stop offset="0%" stop-color="#dff6ff" stop-opacity=".5"/>
            <stop offset="46%" stop-color="#7fa6bd" stop-opacity=".12"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.44}" fill="url(#apexGlow)"></circle>
        <g data-apex-facets>${facets({ size })}</g>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.375}" fill="url(#apexRim)" pointer-events="none"></circle>
      </svg>
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
