/**
 * The full export - ShootSync
 *
 * Everything ShootSync holds for one syndicate, in one file the captain keeps: the syndicate's
 * settings, members, beaters (bank details included, opened, because the export is how records are
 * handed back when the service ends), shoot days, attendance and pegs, bookings, bags, guests with
 * their signed acknowledgements, payments and the audit trail. ShootSync processes these records
 * for the syndicate; this is what UK GDPR Article 28(3)(g) calls returning them.
 *
 * Money is in pence, dates are ISO 8601 (UTC), and nothing internal to ShootSync (Stripe IDs,
 * session records, invite tokens) is included.
 */

import type { PrismaClient } from '@prisma/client'
import { openBankNumbers, type BankKeys } from './bankCrypto.js'

export const EXPORT_FORMAT = 'shootsync-export/1'

export async function buildSyndicateExport(prisma: PrismaClient, syndicateId: string, keys: BankKeys | null, now: Date) {
  const shoots = { shootDay: { syndicateId } }
  const [syndicate, members, beaters, shootDays, attendance, bookings, bags, guests, beaterPayments, memberPayments, activity] = await Promise.all([
    prisma.syndicate.findUniqueOrThrow({
      where: { id: syndicateId },
      select: { id: true, name: true, seasonStart: true, seasonEnd: true, defaultBeaterRatePence: true, pegRotationRule: true, waiverExtra: true, planTier: true, stripeSubscriptionStatus: true, createdAt: true },
    }),
    prisma.member.findMany({
      where: { syndicateId },
      select: { id: true, name: true, email: true, phone: true, role: true, status: true, bascNumber: true, insuranceExpiry: true, emergencyContactName: true, emergencyContactPhone: true, subscriptionStatus: true, subscriptionPaidDate: true, invitedAt: true, acceptedAt: true, leftAt: true, notes: true, createdAt: true },
      orderBy: { name: 'asc' },
    }),
    prisma.beater.findMany({
      where: { syndicateId },
      select: { id: true, name: true, email: true, phone: true, dayRatePence: true, status: true, bankName: true, bankSortCode: true, bankAccountNumber: true, bankDetailsSealed: true, leftAt: true, notes: true, createdAt: true },
      orderBy: { name: 'asc' },
    }),
    prisma.shootDay.findMany({ where: { syndicateId }, orderBy: { date: 'asc' } }),
    prisma.shootAttendance.findMany({ where: shoots, select: { shootId: true, memberId: true, roleOnDay: true, pegNumber: true, confirmed: true, attended: true, checkedInAt: true, notes: true } }),
    prisma.beaterBooking.findMany({ where: { syndicateId }, select: { shootId: true, beaterId: true, dayRatePence: true, status: true, invitedAt: true, confirmedAt: true, checkedIn: true, checkedInAt: true, notes: true } }),
    prisma.bagRecord.findMany({ where: shoots, orderBy: [{ shootId: 'asc' }, { driveNumber: 'asc' }] }),
    prisma.guestGun.findMany({
      where: shoots,
      select: { id: true, shootId: true, invitedByMemberId: true, name: true, email: true, phone: true, emergencyContactName: true, emergencyContactPhone: true, pegNumber: true, dayFee: true, paymentStatus: true, rsvpStatus: true, waiverAccepted: true, waiverAcceptedAt: true, waiverVersion: true, waiverTextHash: true, waiverText: true, notes: true, createdAt: true },
    }),
    prisma.beaterPayment.findMany({ where: { syndicateId }, select: { id: true, beaterId: true, shootId: true, amount: true, status: true, paidDate: true, paymentReference: true, notes: true, createdAt: true } }),
    prisma.memberPayment.findMany({ where: { syndicateId }, select: { id: true, memberId: true, amount: true, paymentType: true, status: true, dueDate: true, paidDate: true, paymentMethod: true, notes: true, createdAt: true } }),
    prisma.activityLog.findMany({ where: { syndicateId }, orderBy: { timestamp: 'asc' }, select: { timestamp: true, action: true, actorRole: true, actorMemberId: true, targetType: true, targetId: true, details: true } }),
  ])

  const unreadable: string[] = []
  const beatersOut = beaters.map(({ bankSortCode, bankAccountNumber, bankDetailsSealed, ...beater }) => {
    let sortCode = bankSortCode
    let accountNumber = bankAccountNumber
    if (bankDetailsSealed && keys) {
      try {
        ;({ sortCode, accountNumber } = openBankNumbers(bankDetailsSealed, beater.id, keys))
      } catch {
        unreadable.push(beater.id)
      }
    }
    return { ...beater, bankSortCode: sortCode, bankAccountNumber: accountNumber }
  })

  const shootDaysOut = shootDays.map(({ syndicateId: _s, ...day }) => day)
  // The trail's entries from Stripe carry Stripe's own IDs, which are ShootSync's, not the syndicate's.
  const STRIPE_KEYS = new Set(['subscription', 'session', 'invoice', 'dispute', 'charge', 'paymentIntent'])
  const activityOut = activity.map((entry) => ({
    ...entry,
    details: entry.details && typeof entry.details === 'object' && !Array.isArray(entry.details)
      ? Object.fromEntries(Object.entries(entry.details as Record<string, unknown>).filter(([key]) => !STRIPE_KEYS.has(key)))
      : entry.details,
  }))

  return {
    document: {
      format: EXPORT_FORMAT,
      exportedAt: now.toISOString(),
      notes: [
        'Money is in pence. Dates are UTC.',
        'Bank details are included so that the syndicate holds them itself: store this file securely and delete it when no longer needed.',
        'Retention periods: https://shootsync.co.uk/privacy',
      ],
      syndicate,
      members,
      beaters: beatersOut,
      shootDays: shootDaysOut,
      attendance,
      beaterBookings: bookings,
      bags,
      guests,
      beaterPayments,
      memberPayments,
      activity: activityOut,
    },
    unreadable,
  }
}
