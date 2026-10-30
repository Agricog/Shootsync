/**
 * Dates as ShootSync shows them - one way, everywhere.
 *
 * Shoot days and season dates are stored as midnight UTC on the day, so they are always
 * shown in UTC: shown in the browser's own time zone, a day could slip to the evening before.
 * Moments (when something was paid, when an entry was written) are shown in UK time.
 *
 *   formatLongDate    "14 November 2026"              season dates, the guest's page, headings
 *   formatShootDate   "Saturday 14 November 2026"     a shoot day where there is room: the day of the week matters on a shoot
 *   formatShortDate   "Sat 14 Nov 2026"               lists and tables
 *   formatDayMonth    "14 Nov"                        tight spaces, where the year is obvious
 *   formatDateTime    "14 Nov 2026, 09:15"            a moment, in UK time
 */

type DateInput = string | Date

const asDate = (date: DateInput) => (typeof date === 'string' ? new Date(date) : date)

/**
 * "Saturday 14 November 2026": the parts joined with spaces, so every browser and the server
 * agree (some put a comma after the weekday, some don't).
 */
function withWeekday(date: DateInput, weekday: 'long' | 'short', month: 'long' | 'short'): string {
  const parts = new Intl.DateTimeFormat('en-GB', { weekday, day: 'numeric', month, year: 'numeric', timeZone: 'UTC' }).formatToParts(asDate(date))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('weekday')} ${get('day')} ${get('month')} ${get('year')}`
}

/** "14 November 2026" */
export function formatLongDate(date: DateInput): string {
  return asDate(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** "Saturday 14 November 2026" */
export function formatShootDate(date: DateInput): string {
  return withWeekday(date, 'long', 'long')
}

/** "Sat 14 Nov 2026" */
export function formatShortDate(date: DateInput): string {
  return withWeekday(date, 'short', 'short')
}

/** "14 Nov" */
export function formatDayMonth(date: DateInput): string {
  return asDate(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** "14 Nov 2026, 09:15", in UK time: for a moment rather than a day. */
export function formatDateTime(date: DateInput): string {
  return asDate(date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
}

/** "08:30" from "08:30" or "08:30:00". */
export function formatTime(time: string): string {
  if (time.includes(':')) return time.slice(0, 5)
  return time
}

/** "what3words: ///filled.count.soap", and the address that opens it. */
export function what3wordsLink(words: string): string {
  return `https://what3words.com/${encodeURIComponent(words.replace(/^\/+/, ''))}`
}
