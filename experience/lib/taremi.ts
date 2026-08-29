/**
 * Mehdi Taremi, as the site already knows him.
 *
 * Every figure here is copied from the repository's own content files, which
 * carry their sources: content/players.json (scraped from the agency's live
 * post, itself sourced from Transfermarkt profile 307058) and
 * content/club-updates.json (the current club, with the URL it was read from
 * and the date it was checked).
 *
 * Nothing on this page is estimated, rounded up, or filled in to make a panel
 * look complete. That is a standing rule for this repo -- these are real
 * people and the agency's own clients -- and it is why there are no
 * season-by-season goal tallies here: content/careers.json is deliberately
 * empty until real rows are sourced, so the scene shows the career as moves,
 * which are published, rather than as per-season stats, which are not.
 */

export type Stat = {
  /** Short uppercase key, drawn on the HUD. */
  label: string;
  value: string;
  /** The qualifier under the number, so no figure is shown without its scope. */
  note: string;
};

export type CareerMove = {
  year: string;
  club: string;
  detail: string;
};

export const TAREMI = {
  name: 'Mehdi Taremi',
  position: 'Centre-Forward',
  club: 'Olympiacos',
  clubSince: 'August 2025',
  nationality: 'Iran',
  birthPlace: 'Bushehr, Iran',
  birthDate: '18 July 1992',
  height: '1.85 m',
  foot: 'Right',
  portrait: '/players/mehdi-taremi.webp',
  profile: 'https://www.transfermarkt.com/mehdi-taremi/profil/spieler/307058',
} as const;

/** The four figures the HUD counts up. All from content/players.json. */
export const STATS: Stat[] = [
  { label: 'Caps', value: '79', note: 'Iran senior national team' },
  { label: 'Goals', value: '43', note: 'for Iran' },
  { label: 'Height', value: '1.85', note: 'metres' },
  { label: 'Foot', value: 'Right', note: 'preferred' },
];

/**
 * Moves only -- each one published and dated. Porto and the 2020 move come
 * from content/players.json; the two later moves from the note in
 * content/club-updates.json, checked 2026-08-28.
 */
export const CAREER: CareerMove[] = [
  { year: '2020', club: 'FC Porto', detail: 'Joined 31 August 2020' },
  { year: '2024', club: 'Inter Milan', detail: 'Free transfer' },
  { year: '2025', club: 'Olympiacos', detail: 'Joined August 2025' },
];

/** The three scroll chapters. The HUD and the 3D timeline share this list. */
export const CHAPTERS = [
  {
    index: '01',
    kicker: 'The ball',
    title: 'Match-grade,\nthirty-two panels',
    body:
      'Twelve pentagons, twenty hexagons, one welded shell. The model turning ' +
      'here is the agency’s own, read straight from the supplied mesh rather ' +
      'than rebuilt from a primitive.',
  },
  {
    index: '02',
    kicker: 'The strike',
    title: 'Contact,\nand everything opens',
    body:
      'A right-footed centre-forward puts his laces through it. At the moment ' +
      'of contact the shell comes apart along its seams and the panels carry ' +
      'their own construction outward.',
  },
  {
    index: '03',
    kicker: 'The player',
    title: 'Mehdi Taremi,\nOlympiacos',
    body:
      'Seventy-nine caps for Iran and forty-three goals in them. Porto in ' +
      '2020, Inter on a free in 2024, Olympiacos since August 2025.',
  },
] as const;
