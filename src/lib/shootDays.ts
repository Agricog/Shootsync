/**
 * Shoot days on the calendar - ShootSync
 *
 * A shoot day's date is stored as midnight UTC on the day ("2026-11-14T00:00:00.000Z"), so its
 * first ten characters are the day itself. "Today" is the UK date, so a day stays current until
 * midnight in the UK, not until midnight UTC (an hour early in summer).
 */

export interface DatedShoot {
  date: string
  status: string
}

export const shootDay = (shoot: DatedShoot): string => shoot.date.slice(0, 10)

/** The next scheduled shoot that hasn't been and gone. Today's counts until the day is over. */
export function nextShootFrom<T extends DatedShoot>(shoots: readonly T[], today: string): T | null {
  return (
    shoots
      .filter((s) => s.status === 'SCHEDULED' && shootDay(s) >= today)
      .sort((a, b) => shootDay(a).localeCompare(shootDay(b)))[0] ?? null
  )
}

/** How a shoot day's status reads on screen. */
export const SHOOT_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}
