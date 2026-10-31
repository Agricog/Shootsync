/**
 * How long ShootSync keeps each kind of record, as the privacy notice states it. Must match
 * server/retention.ts, which enforces it (tests/retention.test.ts compares them).
 */
export const RETENTION = {
  paymentsYearsAfterTaxYear: 6,
  guestContactDays: 30,
  bankDetailsDaysAfterLastPayment: 90,
  leaverMonths: 12,
  syndicateDaysAfterPlanEnds: 90,
  /** Days before that deletion the captain is emailed a warning. Largest first. */
  deletionWarningDays: [30, 7, 1],
  sessionDays: 8,
} as const

/** "30, 7 and 1 day": when a captain is warned by email before their records are deleted. */
export function deletionWarningText(days: readonly number[] = RETENTION.deletionWarningDays): string {
  const last = days[days.length - 1]
  const list = days.length > 1 ? `${days.slice(0, -1).join(', ')} and ${last}` : String(last)
  return `${list} ${last === 1 ? 'day' : 'days'}`
}
