/**
 * Beater pay calculator engine - ShootSync (public tool at /tools/beater-pay-calculator).
 *
 * Pure: takes the form's raw text and "today", never reads the clock (Standard §05.7),
 * so every date edge is testable. Money is whole pence throughout, like the rest of ShootSync.
 *
 * The minimum wage test is GOV.UK's own: divide the pay for the period by the hours worked,
 * and check the average is "not less than" the rate. Done here in whole numbers
 * (pay x 60 >= rate x minutes), so no rounding can tip a borderline day either way.
 */

import { CASUAL_BEATERS, MINIMUM_WAGE, type WageBandId } from '../data/payRules.js'

export type AgeChoice = WageBandId | 'belowSchoolAge'

/** What the form holds, exactly as typed. */
export interface CalculatorInput {
  meet: string
  finish: string
  breakMinutes: string
  age: string
  dayRate: string
  shootDays: string
  beatersPerDay: string
}

export type CalculatorField = keyof CalculatorInput

export interface FieldError {
  field: CalculatorField
  message: string
}

export interface CalculatorResult {
  minutesWorked: number
  /** Null once the rates have lapsed (from MINIMUM_WAGE.reviewBy): show the review notice, not a figure. */
  wage: null | {
    age: AgeChoice
    /** Null below school leaving age: no minimum wage entitlement. */
    bandLabel: string | null
    hourlyPence: number | null
    minimumDayPence: number | null
  }
  /** Null when no day rate was entered. */
  dayRate: null | {
    pence: number
    /** The day rate divided by the hours, rounded down to the penny so it is never overstated. */
    averageHourlyPence: number
    /** Null when there is no minimum to compare with (rates lapsed, or below school leaving age). */
    meetsMinimum: boolean | null
    shortfallPerDayPence: number
  }
  /** Null when no number of shoot days was entered. */
  season: null | {
    shootDays: number
    /** As entered; 1 when left blank, and the page then says "per beater". */
    beatersPerDay: number
    beatersEntered: boolean
    billPence: number | null
    minimumBillPence: number | null
    shortfallPence: number | null
    /** Null once HMRC's rule is past its review date. */
    paye: null | {
      limit: number
      /**
       * True when a beater at every shoot day is expected to work more than the limit. HMRC's test is
       * what is expected, so such a beater is outside the daily-casual rule from their first day.
       */
      overLimit: boolean
    }
  }
}

export interface CalculatorOutcome {
  errors: FieldError[]
  result: CalculatorResult | null
}

export const DEFAULT_INPUT: CalculatorInput = {
  meet: '08:30',
  finish: '15:30',
  breakMinutes: '60',
  age: 'age21Plus',
  dayRate: '',
  shootDays: '',
  beatersPerDay: '',
}

export const AGE_CHOICES: ReadonlyArray<{ id: AgeChoice; label: string }> = [
  ...MINIMUM_WAGE.bands.map((band) => ({ id: band.id, label: band.label })),
  { id: 'belowSchoolAge', label: 'Below school leaving age' },
]

/** Limits on what the form accepts. Generous: they only stop a typing slip. */
export const LIMITS = {
  maxBreakMinutes: 600,
  maxDayRatePence: 1_000_00,
  maxShootDays: 200,
  maxBeatersPerDay: 200,
} as const

export const MESSAGES = {
  meet: 'Enter the meet time, like 08:30.',
  finish: 'Enter the finish time, like 15:30.',
  finishBeforeMeet: 'The finish time must be after the meet time.',
  breakMinutes: `Enter the unpaid break in whole minutes, from 0 to ${LIMITS.maxBreakMinutes}.`,
  breakTooLong: 'The unpaid break must be shorter than the time from meet to finish.',
  age: 'Choose the beater’s age band.',
  dayRate: `Enter the day rate in pounds, or pounds and pence, up to £${(LIMITS.maxDayRatePence / 100).toLocaleString('en-GB')}.`,
  shootDays: `Enter the number of shoot days as a whole number, from 1 to ${LIMITS.maxShootDays}.`,
  beatersPerDay: `Enter the number of beaters as a whole number, from 1 to ${LIMITS.maxBeatersPerDay}.`,
} as const

/** "HH:MM" (24-hour) to minutes after midnight. Null if it is not a real time. */
export function parseClock(text: string): number | null {
  const match = /^\s*([01]?\d|2[0-3]):([0-5]\d)\s*$/.exec(text)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

/**
 * "60", "£62.50", "62.5", "1,000" to pence. Null if it is not an amount of money.
 * A comma is read only as a thousands separator: "62,50" is refused rather than read as £6,250.
 */
export function parsePounds(text: string): number | null {
  const match = /^\s*£?\s*(\d{1,3}(?:,\d{3})+|\d{1,7})(?:\.(\d{1,2}))?\s*$/.exec(text)
  if (!match) return null
  return Number(match[1].replace(/,/g, '')) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

/** A whole number from min to max inclusive. Null otherwise. */
export function parseWhole(text: string, min: number, max: number): number | null {
  if (!/^\s*\d{1,6}\s*$/.test(text)) return null
  const value = Number(text)
  return value >= min && value <= max ? value : null
}

/** The least that meets the hourly rate for this many minutes: rounded up to the penny. */
export function minimumForMinutes(minutes: number, hourlyPence: number): number {
  return Math.ceil((minutes * hourlyPence) / 60)
}

/** Today's date in the UK, "YYYY-MM-DD". The rates change at midnight UK time, not UTC. */
export function londonDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

const inWindow = (today: string, from: string, until: string) => today >= from && today < until

/** The minimum wage rates, or null when today is outside the period they apply to. */
export function ratesInForce(today: string): typeof MINIMUM_WAGE | null {
  return inWindow(today, MINIMUM_WAGE.appliesFrom, MINIMUM_WAGE.reviewBy) ? MINIMUM_WAGE : null
}

/** HMRC's casual beater rules, or null once they are due for review. */
export function casualRulesInForce(today: string): typeof CASUAL_BEATERS | null {
  return today < CASUAL_BEATERS.reviewBy ? CASUAL_BEATERS : null
}

export function isAgeChoice(value: string): value is AgeChoice {
  return AGE_CHOICES.some((choice) => choice.id === value)
}

export function calculate(input: CalculatorInput, today: string): CalculatorOutcome {
  const errors: FieldError[] = []
  const fail = (field: CalculatorField, message: string) => errors.push({ field, message })

  const meet = parseClock(input.meet)
  const finish = parseClock(input.finish)
  if (meet === null) fail('meet', MESSAGES.meet)
  if (finish === null) fail('finish', MESSAGES.finish)
  else if (meet !== null && finish <= meet) fail('finish', MESSAGES.finishBeforeMeet)

  const breakMinutes = input.breakMinutes.trim() === '' ? 0 : parseWhole(input.breakMinutes, 0, LIMITS.maxBreakMinutes)
  if (breakMinutes === null) fail('breakMinutes', MESSAGES.breakMinutes)
  else if (meet !== null && finish !== null && finish > meet && breakMinutes >= finish - meet) fail('breakMinutes', MESSAGES.breakTooLong)

  if (!isAgeChoice(input.age)) fail('age', MESSAGES.age)

  let dayRatePence: number | null = null
  if (input.dayRate.trim() !== '') {
    dayRatePence = parsePounds(input.dayRate)
    if (dayRatePence === null || dayRatePence < 1 || dayRatePence > LIMITS.maxDayRatePence) {
      fail('dayRate', MESSAGES.dayRate)
      dayRatePence = null
    }
  }

  let shootDays: number | null = null
  if (input.shootDays.trim() !== '') {
    shootDays = parseWhole(input.shootDays, 1, LIMITS.maxShootDays)
    if (shootDays === null) fail('shootDays', MESSAGES.shootDays)
  }

  let beatersPerDay: number | null = null
  if (input.beatersPerDay.trim() !== '') {
    beatersPerDay = parseWhole(input.beatersPerDay, 1, LIMITS.maxBeatersPerDay)
    if (beatersPerDay === null) fail('beatersPerDay', MESSAGES.beatersPerDay)
  }

  if (errors.length > 0 || meet === null || finish === null || breakMinutes === null || !isAgeChoice(input.age)) {
    return { errors, result: null }
  }

  const age = input.age
  const minutesWorked = finish - meet - breakMinutes
  const rates = ratesInForce(today)
  const band = rates?.bands.find((b) => b.id === age) ?? null

  const wage: CalculatorResult['wage'] = rates
    ? {
        age,
        bandLabel: band?.label ?? null,
        hourlyPence: band?.hourlyPence ?? null,
        minimumDayPence: band ? minimumForMinutes(minutesWorked, band.hourlyPence) : null,
      }
    : null

  const minimumDay = wage?.minimumDayPence ?? null

  const dayRate: CalculatorResult['dayRate'] =
    dayRatePence === null
      ? null
      : {
          pence: dayRatePence,
          averageHourlyPence: Math.floor((dayRatePence * 60) / minutesWorked),
          meetsMinimum: band && wage ? dayRatePence * 60 >= band.hourlyPence * minutesWorked : null,
          shortfallPerDayPence: minimumDay === null ? 0 : Math.max(0, minimumDay - dayRatePence),
        }

  let season: CalculatorResult['season'] = null
  if (shootDays !== null) {
    const beaters = beatersPerDay ?? 1
    const beaterDays = shootDays * beaters
    const casual = casualRulesInForce(today)
    season = {
      shootDays,
      beatersPerDay: beaters,
      beatersEntered: beatersPerDay !== null,
      billPence: dayRatePence === null ? null : dayRatePence * beaterDays,
      minimumBillPence: minimumDay === null ? null : minimumDay * beaterDays,
      shortfallPence: dayRate === null || minimumDay === null ? null : dayRate.shortfallPerDayPence * beaterDays,
      paye: casual ? { limit: casual.dayLimit, overLimit: shootDays > casual.dayLimit } : null,
    }
  }

  return { errors: [], result: { minutesWorked, wage, dayRate, season } }
}

const poundsFormat = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 7626 -> "£76.26". */
export function formatPence(pence: number): string {
  return poundsFormat.format(pence / 100)
}

/** 360 -> "6 hours", 375 -> "6 hours 15 minutes", 61 -> "1 hour 1 minute". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
  if (hours === 0) return part(rest, 'minute')
  return rest === 0 ? part(hours, 'hour') : `${part(hours, 'hour')} ${part(rest, 'minute')}`
}

/** "2027-04-01" -> "1 April 2027". Formatted in UTC so the server and the browser agree. */
export function formatRuleDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`))
}

/** The last day a rule applies: the day before its review date. */
export function lastDayBefore(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}
