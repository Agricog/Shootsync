/**
 * Date Helper Utilities - ShootSync
 * Date formatting and manipulation
 */

/**
 * Format date for display (e.g., "Sat 18 Jan")
 */
export function formatShortDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/**
 * Format date for display (e.g., "18 January 2026")
 */
export function formatLongDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Format date for API (YYYY-MM-DD)
 */
export function formatApiDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Format time for display (e.g., "08:30")
 */
export function formatTime(time: string): string {
  if (time.includes(':')) return time.slice(0, 5)
  return time
}

/**
 * Check if date is today
 */
export function isToday(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  return d.toDateString() === today.toDateString()
}

/**
 * Check if date is in the past
 */
export function isPast(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d < today
}

/**
 * Check if date is in the future
 */
export function isFuture(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return d > today
}

/**
 * Get days between two dates
 */
export function daysBetween(date1: string | Date, date2: string | Date): number {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2
  const diffTime = Math.abs(d2.getTime() - d1.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Get days until a date
 */
export function daysUntil(date: string | Date): number {
  const d = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffTime = d.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Get relative time description
 */
export function getRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`

  return formatShortDate(d)
}

/**
 * Get UK shooting season dates for a given year
 * Pheasant/Partridge: 1 Oct - 1 Feb
 */
export function getShootingSeason(year: number): { start: Date; end: Date } {
  return {
    start: new Date(year, 9, 1), // 1 October
    end: new Date(year + 1, 1, 1), // 1 February
  }
}

/**
 * Check if a date is within the shooting season
 */
export function isInShootingSeason(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getMonth() >= 9 ? d.getFullYear() : d.getFullYear() - 1
  const season = getShootingSeason(year)
  return d >= season.start && d <= season.end
}
