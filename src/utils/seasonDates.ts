/**
 * Season dates engine - works out the dates and weekdays the season guide shows from
 * src/data/seasonDates.ts. Pure: the season is passed in, the clock is never read (§05.7).
 * All dates are calendar dates, handled in UTC so a server and a browser agree.
 */

import { SEASON_RULES, type MonthDay, type OpenSeason, type Region } from '../data/seasonDates.js'

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const parts = (monthDay: MonthDay) => {
  const [month, day] = monthDay.split('-').map(Number)
  return { month, day }
}

/** "10-01" -> "1 Oct", for the table. */
export function formatMonthDay(monthDay: MonthDay): string {
  const { month, day } = parts(monthDay)
  return `${day} ${MONTHS_SHORT[month - 1]}`
}

/** "10-01" -> "1 October", for sentences. */
export function formatMonthDayLong(monthDay: MonthDay): string {
  const { month, day } = parts(monthDay)
  return `${day} ${MONTHS_LONG[month - 1]}`
}

/** "1 Oct – 1 Feb", or the words for no open season. */
export function formatSeason(open: OpenSeason | null): string {
  return open ? `${formatMonthDay(open.opens)} – ${formatMonthDay(open.closes)}` : 'No open season'
}

const utc = (year: number, monthDay: MonthDay) => {
  const { month, day } = parts(monthDay)
  return new Date(Date.UTC(year, month - 1, day))
}

/**
 * The real dates of an open season starting in `startYear`'s autumn. Seasons open between
 * August and October; one that closes in an earlier month than it opens closes the next year.
 */
export function seasonDates(open: OpenSeason, startYear: number): { opens: Date; closes: Date } {
  const opens = utc(startYear, open.opens)
  const closesThisYear = parts(open.closes).month >= parts(open.opens).month
  return { opens, closes: utc(closesThisYear ? startYear : startYear + 1, open.closes) }
}

export function weekday(date: Date): string {
  return WEEKDAYS[date.getUTCDay()]
}

/** "Thursday 1 October 2026". */
export function formatLongDate(date: Date): string {
  return `${weekday(date)} ${date.getUTCDate()} ${MONTHS_LONG[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

const banned = (region: Region, list: readonly Region[]) => list.includes(region)

/**
 * The last day game may lawfully be shot in a season: the closing date, or the Saturday before
 * it where the season closes on a Sunday and the region bans shooting game on Sundays.
 * Null for Scotland, where the Sunday rule is species by species (see the rules file).
 */
export function lastShootingDay(open: OpenSeason, startYear: number, region: Region): Date | null {
  if (!banned(region, SEASON_RULES.noGameOnSunday)) return null
  const { closes } = seasonDates(open, startYear)
  if (closes.getUTCDay() !== 0) return closes
  return new Date(Date.UTC(closes.getUTCFullYear(), closes.getUTCMonth(), closes.getUTCDate() - 1))
}

/** Christmas Day in the season starting in `startYear`. */
export function christmasDay(startYear: number): Date {
  return new Date(Date.UTC(startYear, 11, 25))
}

export function speciesById(id: string) {
  const found = SEASON_RULES.species.find((s) => s.id === id)
  if (!found) throw new Error(`No season for ${id}`)
  return found
}
