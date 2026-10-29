/**
 * Date Helper Utilities - ShootSync
 *
 * Shoot days are stored as midnight UTC on the day, so they are always shown in UTC:
 * shown in the browser's own time zone, a day could slip to the evening before.
 */

/** "18 January 2026" */
export function formatLongDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "08:30" from "08:30" or "08:30:00". */
export function formatTime(time: string): string {
  if (time.includes(':')) return time.slice(0, 5)
  return time
}
