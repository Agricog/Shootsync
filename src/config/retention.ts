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
  sessionDays: 8,
} as const
