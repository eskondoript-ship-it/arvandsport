/**
 * The client spotlight, and the field of cards it opens into.
 *
 * Two things in one sticky stage, because they are two halves of one move. It
 * arrives as a panel -- one player, his record, his card held up at the right.
 * Scroll on and the card turns and falls back into a field of the rest of the
 * roster, scattered in depth, and the panel gives way to it. The point being
 * made is the one the agency makes: here is the client you have heard of, and
 * here are the others.
 *
 * Every figure comes out of content/players.json. Age is computed from the
 * date of birth rather than written down anywhere -- a number typed into a
 * content file is wrong within the year, and this is a real person's age.
 *
 * The stage is `position: sticky`, like the hero's. Three viewport-heights of
 * section, one screen of stage inside it, so the browser does the holding: it
 * cannot desynchronise from the scroll and it still holds with JavaScript off.
 * src/scripts/spotlight.js adds the scrub on top and nothing else -- the
 * markup here is the finished frame, cards already in their places, so the
 * no-JS and reduced-motion renderings are a composed still rather than a pile
 * of cards at the origin.
 */
import { esc, attr, ICONS } from './layout.mjs';
import { picture, PORTRAIT_WIDTHS } from './partials.mjs';

/**
 * Where each card sits once the field has opened, as a fraction of the stage.
 *
 * Written down rather than generated. A random scatter re-rolls on every build
 * and puts two cards on top of each other about a third of the time; these are
 * placed to leave the middle clear for the one card that stays there, and to
 * read as depth rather than as a grid that has been jostled.
 */
const SLOTS = [
  { x: -0.36, y: -0.24, z: -420, r: -13 },
  { x: 0.34, y: -0.28, z: -520, r: 11 },
  { x: -0.44, y: 0.2, z: -300, r: 9 },
  { x: 0.42, y: 0.16, z: -360, r: -8 },
  { x: -0.22, y: 0.34, z: -640, r: 14 },
  { x: 0.2, y: -0.38, z: -700, r: -12 },
  { x: -0.5, y: -0.04, z: -820, r: 7 },
  { x: 0.48, y: -0.02, z: -880, r: -6 },
  { x: -0.12, y: -0.42, z: -980, r: 10 },
  { x: 0.1, y: 0.42, z: -1040, r: -9 },
];

/** The player's age today, from the date of birth and nothing else. */
function ageFrom(birthDate, today = new Date()) {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  let age = today.getUTCFullYear() - born.getUTCFullYear();
  const month = today.getUTCMonth() - born.getUTCMonth();
  if (month < 0 || (month === 0 && today.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

/** The values the panel is allowed to state, each one read off the record. */
function facts(player) {
  return {
    age: ageFrom(player.birthDate),
    // Transfermarkt writes heights with a comma; everything else on the site
    // reads as English, so this is the one place it is normalised.
    height: player.height ? player.height.replace(',', '.') : null,
    caps: player.caps,
    goals: player.goals,
    club: player.club,
    previousClub: player.previousClub,
  };
}

function fieldCard(player, slot, index) {
  return `<article class="spot-card" data-spot-card
    style="--x:${slot.x};--y:${slot.y};--z:${slot.z}px;--r:${slot.r}deg;--i:${index}">
    <a class="spot-card__link" href="${attr(player.url)}" tabindex="-1">
      ${picture(player.image, {
        widths: PORTRAIT_WIDTHS,
        sizes: '(max-width: 640px) 40vw, 220px',
        alt: player.name,
        width: 529,
        height: 760,
      })}
      <span class="spot-card__name">${esc(player.lastName)}</span>
    </a>
  </article>`;
}

export function spotlight(site, players = []) {
  const config = site.spotlight;
  if (!config) return '';
  const lead = players.find((p) => p.slug === config.playerSlug);
  if (!lead) return '';

  const values = facts(lead);
  const rows = (config.rows || [])
    .map((key) => [config.labels?.[key] || key, values[key]])
    .filter(([, value]) => value !== null && value !== undefined && value !== '');

  /* The rest of the roster, in the order they are listed, one per slot. More
     players than slots is fine -- the field takes as many as it has room for
     and the section links to all of them anyway. */
  const others = players.filter((p) => p.slug !== lead.slug).slice(0, SLOTS.length);

  return `<section class="spot" id="spotlight" data-spotlight aria-labelledby="spot-title">
  <div class="spot__pin" data-spotlight-pin>
    <span class="spot__wash" aria-hidden="true"></span>

    <div class="spot__stage" data-spotlight-stage>
      ${others.map((p, i) => fieldCard(p, SLOTS[i], i)).join('\n      ')}

      <article class="spot-card spot-card--lead" data-spotlight-lead>
        <a class="spot-card__link" href="${attr(lead.url)}">
          ${picture(lead.image, {
            widths: PORTRAIT_WIDTHS,
            sizes: '(max-width: 640px) 62vw, 340px',
            alt: lead.name,
            width: 529,
            height: 760,
          })}
          <span class="spot-card__name">${esc(lead.lastName)}</span>
        </a>
      </article>
    </div>

    <div class="spot__panel" data-spotlight-panel>
      <p class="spot__kicker">${esc(config.lead || '')}</p>
      <h2 class="spot__title" id="spot-title">
        <span class="spot__title-soft">${esc(config.kicker)}</span>
        ${esc(config.title)}
      </h2>
      <dl class="spot__facts">
        ${rows
          .map(
            ([label, value], i) => `<div class="spot__fact" style="--i:${i}">
          <dt>${esc(label)}</dt><dd>${esc(String(value))}</dd>
        </div>`,
          )
          .join('\n        ')}
      </dl>
    </div>

    <div class="spot__outro" data-spotlight-outro aria-hidden="true">
      <p class="spot__outro-line">${esc(config.fieldCaption || '')}</p>
      <a class="btn btn--line" href="/player/"><span>All players</span>${ICONS.arrow}</a>
    </div>
  </div>
</section>`;
}
