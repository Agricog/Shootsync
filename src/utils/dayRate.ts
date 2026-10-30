/**
 * Day rates in the app - ShootSync
 *
 * The API holds every day rate in pence (dayRatePence, defaultBeaterRatePence). The captain types
 * pounds, or pounds and pence: "40", "42.50", "£42.50". These helpers go between the two, and say
 * how far a day rate stretches against the minimum wage, from the rules in src/data/payRules.ts
 * (no figure is typed here: tests/typedFigures.test.ts).
 */

import { formatDuration, formatPence, parsePounds, ratesInForce } from './beaterPayCalculator.js'

/** The most a day rate can be, in pence: £1,000 (the server refuses more, server/beaterPay.ts). */
export const MAX_DAY_RATE_PENCE = 100_000

export const DAY_RATE_MESSAGE = 'Enter the day rate in pounds, or pounds and pence, from £0 to £1,000.'

/** "42.50" -> 4250. Null if it isn't an amount from £0 to £1,000. */
export function parseDayRate(text: string): number | null {
  const pence = parsePounds(text)
  return pence === null || pence > MAX_DAY_RATE_PENCE ? null : pence
}

/** 4250 -> "42.50"; 4000 -> "40". What a form field shows for a saved rate. */
export function dayRateField(pence: number): string {
  return pence % 100 === 0 ? String(pence / 100) : (pence / 100).toFixed(2)
}

/** 4250 -> "£42.50". */
export const formatDayRate = formatPence

/**
 * How many hours and minutes a day rate covers at the minimum wage for someone 21 or over, as
 * a sentence the captain can set against the day they ask of their beaters. Null when the rates
 * on file are due for review (the public calculator says the same), or the rate is nothing.
 */
export function minimumWageNote(dayRatePence: number, today: string): string | null {
  const rates = ratesInForce(today)
  if (!rates || dayRatePence <= 0) return null
  const band = rates.bands.find((b: { id: string }) => b.id === 'age21Plus')
  if (!band) return null
  // Whole minutes the rate pays for at the hourly floor, rounded down: the floor must be met, not nearly met.
  const minutes = Math.floor((dayRatePence * 60) / band.hourlyPence)
  return `${formatPence(dayRatePence)} covers ${formatDuration(minutes)} at the ${formatPence(band.hourlyPence)} an hour minimum wage for 21 and over (${rates.periodLabel} rates). A longer day needs a higher rate.`
}
