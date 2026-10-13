/**
 * Beater pay - ShootSync
 *
 * Units: day rates (Beater.dayRate, BeaterBooking.dayRate, Syndicate.defaultBeaterRate)
 * are whole pounds. Money owed and paid (BeaterPayment.amount) is pence, like every
 * other amount of money ShootSync stores. Convert only with poundsToPence.
 *
 * The rule: once a shoot day is completed, every beater booked on it and marked
 * Confirmed is owed their booked day rate, once. Nobody else is owed anything for it.
 * syncBeaterPayments makes the records match that rule. It runs when a day is
 * completed and whenever a booking on a completed day changes. Paid records are
 * never altered or removed; the routes refuse changes to a booking already paid.
 */

import type { Prisma } from '@prisma/client'

export const poundsToPence = (pounds: number) => Math.round(pounds * 100)

type Tx = Prisma.TransactionClient

export async function syncBeaterPayments(tx: Tx, shootId: string): Promise<void> {
  const shoot = await tx.shootDay.findUnique({ where: { id: shootId }, select: { status: true, syndicateId: true } })
  if (!shoot) return

  const [bookings, payments] = await Promise.all([
    tx.beaterBooking.findMany({ where: { shootId }, select: { beaterId: true, dayRate: true, status: true } }),
    tx.beaterPayment.findMany({ where: { shootId }, select: { id: true, beaterId: true, amount: true, status: true } }),
  ])

  const owed = new Map<string, number>()
  if (shoot.status === 'COMPLETED') {
    for (const booking of bookings) {
      if (booking.status === 'CONFIRMED') owed.set(booking.beaterId, poundsToPence(booking.dayRate))
    }
  }

  // Unpaid records that no longer match the rule are corrected or removed.
  for (const payment of payments) {
    if (payment.status === 'PAID') continue
    const amount = owed.get(payment.beaterId)
    // Guarded on PENDING in the write itself, so a record paid a moment ago is never touched.
    if (amount === undefined) await tx.beaterPayment.deleteMany({ where: { id: payment.id, status: 'PENDING' } })
    else if (amount !== payment.amount) await tx.beaterPayment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { amount } })
  }

  // Anyone owed who has no record yet gets one.
  const recorded = new Set(payments.map((p) => p.beaterId))
  for (const [beaterId, amount] of owed) {
    if (recorded.has(beaterId)) continue
    await tx.beaterPayment.create({
      data: { syndicateId: shoot.syndicateId, beaterId, shootId, amount, status: 'PENDING' },
    })
  }
}

/**
 * Locks shoot days' rows for the rest of the transaction, so everything that changes a day's
 * beaters or pay (booking, completing, cancelling, deleting, paying) happens one at a time.
 * Several days are locked in id order, so two transactions can never deadlock.
 */
export async function lockShoot(tx: Tx, shootId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM shoot_days WHERE id = ${shootId} FOR UPDATE`
}

export async function lockShoots(tx: Tx, shootIds: string[]): Promise<void> {
  for (const id of [...new Set(shootIds)].sort()) await lockShoot(tx, id)
}

/** UK tax year containing `date`: 6 April to 5 April. Returned in UTC. */
export function taxYearOf(date: Date): { start: Date; end: Date } {
  const year = date.getUTCFullYear()
  const startThisYear = Date.UTC(year, 3, 6)
  const startYear = date.getTime() >= startThisYear ? year : year - 1
  return { start: new Date(Date.UTC(startYear, 3, 6)), end: new Date(Date.UTC(startYear + 1, 3, 6)) }
}

/** HMRC: PAYE applies once a daily casual beater works, or is expected to work, more than this many days for you in a tax year. */
export const HMRC_CASUAL_DAY_LIMIT = 14

/** UK bank details, normalised: sort code "12-34-56", account number 8 digits. Null if not valid. */
export function normaliseSortCode(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '')
  return /^\d{6}$/.test(digits) ? `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}` : null
}

export function normaliseAccountNumber(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '')
  return /^\d{8}$/.test(digits) ? digits : null
}
