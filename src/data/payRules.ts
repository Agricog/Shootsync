/**
 * Pay rules for beaters (Autaimate Build Standard §05.7).
 *
 * Every regulatory figure the beater pay guide and the beater pay calculator show
 * comes from this file. No page types one in: tests/typedFigures.test.ts fails if it does.
 *
 * Each rule carries the primary source it was read from, the day it was last checked
 * against that source (LAST_VERIFIED), and the day it may stop being true (REVIEW_BY).
 * From REVIEW_BY onwards, pages stop presenting the figures as current and show a
 * review notice instead (see ratesInForce in src/utils/beaterPayCalculator.ts).
 *
 * To update in April: open each source, change the figures, appliesFrom, reviewBy and
 * lastVerified together, then re-check the worked examples in tests/payRules.test.ts
 * against the source. Never take a figure from a summary, a blog or a payroll site.
 */

export interface RuleSource {
  label: string
  url: string
}

export type WageBandId = 'age21Plus' | 'age18to20' | 'under18' | 'apprentice'

export interface WageBand {
  id: WageBandId
  /** The band as GOV.UK names it. */
  label: string
  /** Pence per hour. */
  hourlyPence: number
}

/**
 * National Minimum Wage and National Living Wage.
 * Primary source, opened 13 October 2026: The National Minimum Wage (Amendment) Regulations 2026
 * (SI 2026/357), in force 1 April 2026. Regulation 2(2) sets the national living wage in reg. 4 of the
 * 2015 Regulations to £12.71; reg. 2(3)(a)-(c) set reg. 4A(1)(b) (18 to 20) to £10.85, (c) (under 18)
 * to £8.00 and (d) (apprentices) to £8.00. GOV.UK's rates page, opened the same day, agrees.
 * Its own words: the rates change on "1 April every year". So these figures are reviewed by
 * 1 April 2027, the day next year's rates take effect.
 * Bound direction: each rate is a floor ("minimum"). A worker must be paid at least this per hour
 * worked, averaged over the pay reference period (Calculating the minimum wage, step 5: "not less than").
 * Apprentice rate (same page): under 19, or 19 and over in the first year of the apprenticeship.
 * Below school leaving age there is no entitlement: "You must be at least: school leaving age".
 */
export const MINIMUM_WAGE = {
  /** First day these rates applied. */
  appliesFrom: '2026-04-01',
  /** The day these rates stop applying: the next 1 April. Pages show a review notice from this day. */
  reviewBy: '2027-04-01',
  lastVerified: '2026-10-13',
  /** How a page names the period, e.g. "from April 2026". */
  periodLabel: 'April 2026',
  bands: [
    { id: 'age21Plus', label: '21 and over (National Living Wage)', hourlyPence: 1271 },
    { id: 'age18to20', label: '18 to 20', hourlyPence: 1085 },
    { id: 'under18', label: 'Under 18 (above school leaving age)', hourlyPence: 800 },
    { id: 'apprentice', label: 'Apprentice (under 19, or in the first year)', hourlyPence: 800 },
  ] satisfies WageBand[],
  sources: [
    { label: 'GOV.UK: National Minimum Wage and National Living Wage rates', url: 'https://www.gov.uk/national-minimum-wage-rates' },
    { label: 'The National Minimum Wage (Amendment) Regulations 2026 (SI 2026/357)', url: 'https://www.legislation.gov.uk/uksi/2026/357/made' },
    {
      label: 'GOV.UK: Calculating the minimum wage (pay reference periods, what counts as pay)',
      url: 'https://www.gov.uk/guidance/calculating-the-minimum-wage/calculating-the-minimum-wage',
    },
    {
      label: 'GOV.UK: Working hours for which the minimum wage must be paid',
      url: 'https://www.gov.uk/guidance/calculating-the-minimum-wage/working-hours-for-which-the-minimum-wage-must-be-paid',
    },
  ] satisfies RuleSource[],
} as const

/**
 * HMRC's rules for casual beaters.
 * Source, opened 13 October 2026: GOV.UK "Paying harvest casuals and casual beaters" (last changed by
 * HMRC on 18 May 2015). Its words: no tax deduction for daily casuals where the work "is not expected
 * to exceed 14 days in total in any tax year"; past that "you must operate PAYE".
 * Bound direction: 14 days is allowed; the 15th day is over the limit ("exceed"). The test is what is
 * EXPECTED, so a beater expected from the start to work more than 14 days is never inside it: pages say
 * "works, or is expected to work, more than", never "from day 15".
 * National Insurance: "For casual beaters, any NICs ... must be calculated as normal", whatever the count.
 * The page gives no date it may change, so it is reviewed with each tax year: REVIEW_BY is the first
 * day of the next tax year (6 April 2027), when a captain starts counting again.
 */
export const CASUAL_BEATERS = {
  dayLimit: 14,
  /** Engagements of this many weeks or less may need no tax deducted (with the other conditions). */
  shortEngagementWeeks: 2,
  /** Records are kept this many years after the end of the current tax year, where there is no payroll. */
  recordYears: 3,
  reviewBy: '2027-04-06',
  lastVerified: '2026-10-13',
  sources: [
    { label: 'GOV.UK: Paying harvest casuals and casual beaters (HMRC)', url: 'https://www.gov.uk/paying-harvest-casuals-and-casual-beaters' },
  ] satisfies RuleSource[],
} as const
