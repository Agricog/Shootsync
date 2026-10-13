/**
 * Facts about the law and good practice that the syndicate and game book guides state
 * (Autaimate Build Standard §05.7). Pages read these; nothing is typed into a page, and
 * tests/shootingLaw.test.ts pins each one to the words of its source.
 *
 * Sources, all opened 13 October 2026:
 *  - GOV.UK "Shotgun and firearm certificates": "You need a firearm or shotgun certificate issued
 *    by the police to possess, buy or acquire a firearm or shotgun"; "A certificate usually lasts
 *    5 years from the date it was issued or renewed." Fees: "from your local police force" (so the
 *    pages state no fee).
 *  - The Regulatory Reform (Game) Order 2007 (SI 2007/2007): "removes the requirement to hold a game
 *    licence in order to take or kill game", and the local authority and excise licences to deal in
 *    game; "comes into force on 1st August 2007"; "This Order extends to England and Wales only."
 *  - The Code of Good Shooting Practice (GWCT PDF, no edition date shown): "Shoot managers must
 *    ensure suitable public liability insurance is in place" and "should always brief the Guns at
 *    the start of the day" covering "health and safety, expected quarry and the application of this
 *    Code" (section 5); "All shot game must be regarded as food" (section 4); "Accurate records
 *    should be kept of pest and predator control carried out" (section 8). Overseen by a steering
 *    committee of ten organisations, BASC, the CLA, the Countryside Alliance and GWCT among them.
 *  - GWCT National Gamebag Census, "Join" page: shoots are asked for "the annual bag records from
 *    your shoot"; no participation fee; records kept "strictly confidential"; owners of historical
 *    records kept in game books are invited to get in touch.
 *
 * None of these has a published change date. REVIEW_BY is a year from verification, the same
 * annual check as the guides' "reviewed" dates (tests/site.test.ts).
 */

export interface LawSource {
  label: string
  url: string
}

export const SHOOTING_LAW = {
  lastVerified: '2026-10-13',
  reviewBy: '2027-10-13',
  shotgunCertificate: {
    issuedBy: 'the police',
    usualYears: 5,
  },
  gameLicence: {
    /** Game licences, and licences to deal in game, ended on this day in England and Wales. */
    abolishedOn: '2007-08-01',
    extent: 'England and Wales',
  },
  code: {
    name: 'Code of Good Shooting Practice',
    steeringBodies: 10,
  },
  sources: {
    certificates: { label: 'GOV.UK: Shotgun and firearm certificates', url: 'https://www.gov.uk/shotgun-and-firearm-certificates' },
    gameOrder: { label: 'legislation.gov.uk: The Regulatory Reform (Game) Order 2007', url: 'https://www.legislation.gov.uk/uksi/2007/2007/made' },
    code: { label: 'GWCT: The Code of Good Shooting Practice', url: 'https://gwct.org.uk/game/advice/code-of-good-shooting-practice/' },
    codePdf: { label: 'The Code of Good Shooting Practice (PDF, GWCT)', url: 'https://www.gwct.org.uk/media/768987/CodeGoodSHootingPractice.pdf' },
    gamebagCensus: { label: 'GWCT: Join the National Gamebag Census', url: 'https://gwct.org.uk/research/long-term-monitoring/national-gamebag-census/join/' },
  } satisfies Record<string, LawSource>,
} as const
