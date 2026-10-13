/**
 * Guides - the list every guide page, the /guides hub and the tests read from.
 *
 * Rules for every guide (checked by tests/site.test.ts and scripts/check-built-site.mjs):
 *   - every fact that can go out of date is cited in `sources`, primary sources first
 *   - `reviewed` is the date the facts were last checked against those sources
 *   - a guide never describes a ShootSync feature that isn't built
 * When a guide's facts change (a new minimum wage in April, a law change), update the
 * guide and its `reviewed` date in the same commit.
 */

export interface Source {
  label: string
  url: string
}

export interface Guide {
  path: string
  /** Shown on the hub card and in the breadcrumb. */
  shortTitle: string
  /** One or two sentences for the hub card. */
  summary: string
  /** ISO date the facts were last checked. */
  reviewed: string
}

export const GUIDES = [
  {
    path: '/guides/paying-beaters-and-pickers-up',
    shortTitle: 'Paying beaters and pickers-up',
    summary:
      'The minimum wage, HMRC’s casual beaters rules, the records to keep, and what a fair day rate works out at in 2026.',
    reviewed: '2026-10-13',
  },
  {
    path: '/guides/peg-draw-explained',
    shortTitle: 'The peg draw explained',
    summary:
      'How a peg draw works, why guns move up after each drive, and how to keep the pegs fair across a whole season.',
    reviewed: '2026-10-13',
  },
  {
    path: '/guides/guest-guns',
    shortTitle: 'Guest guns: the law and the etiquette',
    summary:
      'When a guest can borrow a shotgun without a certificate, what to tell them before the day, day fees and waivers.',
    reviewed: '2026-10-13',
  },
  {
    path: '/guides/shooting-season-dates',
    shortTitle: 'UK shooting season dates',
    summary:
      'Open seasons for pheasant, partridge, grouse, woodcock, snipe and duck in England, Wales, Scotland and Northern Ireland.',
    reviewed: '2026-10-13',
  },
  {
    path: '/guides/tipping-the-keeper',
    shortTitle: 'Tipping the keeper',
    summary:
      'How much to tip the gamekeeper by the size of the bag, when and how to hand it over, and who tips on a syndicate day.',
    reviewed: '2026-10-13',
  },
] as const satisfies readonly Guide[]

export type GuidePath = (typeof GUIDES)[number]['path']

export const guideByPath = (path: GuidePath): Guide => {
  const guide = GUIDES.find((g) => g.path === path)
  if (!guide) throw new Error(`No guide at ${path}`)
  return guide
}

/** "2026-10-13" -> "13 October 2026" (fixed, so the server and browser render the same text). */
export function formatReviewed(iso: string): string {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const [year, month, day] = iso.split('-').map(Number)
  return `${day} ${MONTHS[month - 1]} ${year}`
}
