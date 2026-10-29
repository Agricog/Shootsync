/**
 * Money on screen - ShootSync
 *
 * Every amount the API sends is in pence. Plan prices live in src/config/plans.ts,
 * which is the single source of truth for what ShootSync charges.
 */

/** 4000 -> "£40.00" */
export const formatCurrency = (amountInPence: number, includeSymbol: boolean = true): string => {
  const formatted = (amountInPence / 100).toFixed(2)
  return includeSymbol ? `£${formatted}` : formatted
}
