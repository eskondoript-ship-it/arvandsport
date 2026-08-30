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
 * Where each card stands once the row has fanned out.
 *
 * A fan, not a scatter. The reference stands its cards up in a shared
 * perspective and turns them steeply away from the middle -- the one in front
 * nearly square to you, its neighbours edge-on enough to show their thickness
 * -- with the display line running behind them. A random cloud of cards reads
 * as debris; this reads as a row of things being held up.
 *
 * Generated rather than typed, because a fan is a rule and not a set of
 * opinions: alternate sides, each rank further out, further back and turned
 * harder than the last. `rz` is a degree or two of roll so the row is not
 * mechanical.
 */
const SLOTS = Array.from({ length: 4 }, (_, i) => {
  const side = i % 2 ? 1 : -1;
  const rank = Math.floor(i / 2) + 1;
  return {
    /* Two ranks a side, and the outer one at 0.385 of the stage from the
       middle. Further out than that and a card's own width carries it off the
       frame -- a first pass fanned ten and rendered four of them entirely off
       screen. Fewer also reads better: the reference holds up three cards, not
       a hand of them, and every player here is visible rather than half
       behind his neighbour. The rest of the roster is a link away. */
    x: side * (0.155 + rank * 0.115),
    y: (rank % 2 ? -1 : 1) * 0.03 * rank,
    z: -170 * rank,
    r: -side * (28 + rank * 8),
    rz: side * (1.8 + rank * 1.1),
  };
});

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
    style="--x:${slot.x};--y:${slot.y};--z:${slot.z}px;--r:${slot.r}deg;--rz:${slot.rz}deg;--i:${index}">
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

    <!-- The display line the fan stands in front of. Aria-hidden and duplicated
         from the heading below on purpose: it is scenery, and a screen reader
         should hear the player's name once. -->
    <p class="spot__word" aria-hidden="true">${esc(lead.lastName)}</p>

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
