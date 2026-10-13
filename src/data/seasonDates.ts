/**
 * UK game shooting seasons (Autaimate Build Standard §05.7).
 *
 * Every season date the season guide shows comes from here; the weekday notes for the
 * current season are worked out from these dates by src/utils/seasonDates.ts. Nothing is
 * typed into the page, and tests/seasonDates.test.ts fails if a date is.
 *
 * Sources, all opened 13 October 2026:
 *  - GWCT "Shooting season dates for gamebirds and waterfowl": the full table below, for all
 *    three jurisdictions. It agrees with the primary sources on every pheasant, partridge and
 *    grouse date checked.
 *  - Game Act 1831, s.3 (legislation.gov.uk): pheasant may not be killed "between the first day
 *    of February and the first day of October"; partridge "between the first day of February and
 *    the first day of September"; red grouse between 10 December and 12 August; black game between
 *    10 December and 20 August, except Somerset, Devon and the New Forest (to 1 September); and no
 *    game on "a Sunday or Christmas Day". Extent marker "U.K.", with s.3 repealed for Scotland and
 *    for Northern Ireland in 2011 (textual note F1), so it still governs England and Wales.
 *    Bound direction: "between" the two dates, so both dates themselves are open: the pheasant
 *    season is 1 October to 1 February INCLUSIVE.
 *  - PSNI "Advice on wildlife and game protection" (February 2026): Northern Ireland pheasant
 *    01 October to 31 January, grey and red partridge 01 September to 31 January; "It is an offence
 *    to kill any wild bird or game on Sundays or during the period commencing one hour after sunset
 *    ... and ending one hour before sunrise".
 *
 * These dates are set in law and rarely change. REVIEW_BY is 1 July each year: the summer check
 * before the grouse season opens on 12 August, when the season label moves on and the next
 * season's weekday notes are wanted. tests/seasonDates.test.ts fails from that day until it is done.
 */

export interface SeasonSource {
  label: string
  url: string
}

/** A month and day, "MM-DD". */
export type MonthDay = `${number}-${number}`

/** An open season, both days included. Null where the species may not be shot there. */
export interface OpenSeason {
  opens: MonthDay
  closes: MonthDay
}

export type Region = 'englandWales' | 'scotland' | 'northernIreland'

export interface SpeciesSeason {
  id: string
  species: string
  seasons: Record<Region, OpenSeason | null>
  /** A local exception, shown under the table. */
  note?: string
}

const season = (opens: MonthDay, closes: MonthDay): OpenSeason => ({ opens, closes })

export const SEASON_RULES = {
  /** The season the guide is written for. Moves on at the summer review. */
  current: { label: '2026/27', startYear: 2026 },
  lastVerified: '2026-10-13',
  reviewBy: '2027-07-01',
  regions: {
    englandWales: 'England and Wales',
    scotland: 'Scotland',
    northernIreland: 'Northern Ireland',
  } satisfies Record<Region, string>,
  species: [
    { id: 'pheasant', species: 'Pheasant', seasons: { englandWales: season('10-01', '02-01'), scotland: season('10-01', '02-01'), northernIreland: season('10-01', '01-31') } },
    { id: 'partridge', species: 'Grey and red-legged partridge', seasons: { englandWales: season('09-01', '02-01'), scotland: season('09-01', '02-01'), northernIreland: season('09-01', '01-31') } },
    { id: 'red-grouse', species: 'Red grouse', seasons: { englandWales: season('08-12', '12-10'), scotland: season('08-12', '12-10'), northernIreland: season('08-12', '11-30') } },
    {
      id: 'black-grouse',
      species: 'Black grouse',
      seasons: { englandWales: season('08-20', '12-10'), scotland: season('08-20', '12-10'), northernIreland: null },
      note: 'In Somerset, Devon and the New Forest, black grouse open on 1 September.',
    },
    { id: 'ptarmigan', species: 'Ptarmigan', seasons: { englandWales: null, scotland: season('08-12', '12-10'), northernIreland: null } },
    { id: 'woodcock', species: 'Woodcock', seasons: { englandWales: season('10-01', '01-31'), scotland: season('09-01', '01-31'), northernIreland: season('10-01', '01-31') } },
    { id: 'snipe', species: 'Common snipe', seasons: { englandWales: season('08-12', '01-31'), scotland: season('08-12', '01-31'), northernIreland: season('09-01', '01-31') } },
    { id: 'duck-inland', species: 'Duck and geese, inland', seasons: { englandWales: season('09-01', '01-31'), scotland: season('09-01', '01-31'), northernIreland: season('09-01', '01-31') } },
    { id: 'duck-foreshore', species: 'Duck and geese, below high water mark', seasons: { englandWales: season('09-01', '02-20'), scotland: season('09-01', '02-20'), northernIreland: season('09-01', '01-31') } },
  ] satisfies SpeciesSeason[],
  /**
   * Where game may not be shot on a Sunday (and Christmas Day), in law. Scotland is left out on
   * purpose: its Sunday rule is species by species under the Wildlife and Countryside Act 1981, and
   * the page says so rather than working out a last day for Scotland that depends on it.
   */
  noGameOnSunday: ['englandWales', 'northernIreland'] satisfies Region[],
  noGameOnChristmasDay: ['englandWales'] satisfies Region[],
  sources: [
    { label: 'GWCT: Shooting season dates for gamebirds and waterfowl', url: 'https://gwct.org.uk/game/advice/shooting-season-dates/' },
    { label: 'legislation.gov.uk: Game Act 1831, section 3', url: 'https://www.legislation.gov.uk/ukpga/Will4/1-2/32/section/3' },
    { label: 'PSNI: Advice on wildlife and game protection (February 2026)', url: 'https://www.psni.police.uk/sites/default/files/2026-02/Advice%20on%20Widlife%20and%20Game%20Protection.pdf' },
    { label: 'legislation.gov.uk: Wildlife and Countryside Act 1981, section 2', url: 'https://www.legislation.gov.uk/ukpga/1981/69/section/2' },
  ] satisfies SeasonSource[],
} as const
