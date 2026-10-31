/**
 * Retention - ShootSync
 *
 * Keeps only what is needed, for as long as the law needs it, and no longer. The periods are the
 * owner's decision of 30 Oct 2026 (claude/retention-policy-2026-10-30.md) and are stated, word for
 * word, in the privacy notice (src/pages/public/Privacy.tsx reads RETENTION below). Run every hour;
 * each step is idempotent, the whole run is one transaction, and only one server runs it at a time.
 *
 *   payments, and the audit trail behind them   6 years after the end of the UK tax year they fall in
 *   a signed guest acknowledgement               with its payment record: the same 6 years
 *   guest phone, email and emergency contact     30 days after the shoot day
 *   a guest who never accepted or paid           30 days after the shoot day, then removed
 *   bank details of a beater who has left        90 days after their last payment is settled
 *   contact details of members/beaters who left  12 months after leaving; the name stays while a
 *                                                payment record still needs it, then goes too
 *   a syndicate whose plan has ended             90 days after it ended, everything (export first)
 *   sign-in session records                      8 days after the session began: longer than any
 *                                                sign-in can last, so an ended session never returns
 *
 * The game book (shoot days, drives, bags, pegs) is the syndicate's own history and is kept for
 * as long as the syndicate is.
 */

import type { Prisma, PrismaClient } from '@prisma/client'
import { taxYearOf } from './beaterPay.js'
import { recordActivity } from './audit.js'
import { KEEP_SESSION_ROWS_DAYS } from './sessionPolicy.js'

const DAY = 24 * 60 * 60 * 1000

export const RETENTION = {
  paymentsYearsAfterTaxYear: 6,
  guestContactDays: 30,
  bankDetailsDaysAfterLastPayment: 90,
  leaverMonths: 12,
  syndicateDaysAfterPlanEnds: 90,
  /** Days before that deletion the captain is emailed (server/deletionWarnings.ts). Largest first. */
  deletionWarningDays: [30, 7, 1],
  sessionDays: KEEP_SESSION_ROWS_DAYS,
} as const

/** Anything dated before this is past its 6 years after the end of its tax year. */
export function paymentCutoff(now: Date): Date {
  const sixYearsAgo = new Date(Date.UTC(now.getUTCFullYear() - RETENTION.paymentsYearsAfterTaxYear, now.getUTCMonth(), now.getUTCDate()))
  return taxYearOf(sixYearsAgo).start
}

/**
 * When a syndicate is deleted, if nothing changes: 90 days after its plan ended (cancelled, or
 * Stripe gave up on payment), or 90 days after it was set up if no plan was ever chosen. Null
 * while a plan is live.
 */
export function syndicateDeletionDate(s: { planEndedAt: Date | null; stripeSubscriptionStatus: string | null; stripeSubscriptionId: string | null; createdAt: Date }): Date | null {
  const from = s.planEndedAt ?? (s.stripeSubscriptionStatus === null && s.stripeSubscriptionId === null ? s.createdAt : null)
  return from ? new Date(from.getTime() + RETENTION.syndicateDaysAfterPlanEnds * DAY) : null
}

export interface RetentionResult {
  ran: boolean
  syndicatesDeleted: number
  guestContactsCleared: number
  guestsRemoved: number
  bankDetailsCleared: number
  leaversAnonymised: number
  namesRemoved: number
  paymentsRemoved: number
  auditEntriesRemoved: number
  sessionsRemoved: number
}

const EMPTY: RetentionResult = {
  ran: false, syndicatesDeleted: 0, guestContactsCleared: 0, guestsRemoved: 0, bankDetailsCleared: 0,
  leaversAnonymised: 0, namesRemoved: 0, paymentsRemoved: 0, auditEntriesRemoved: 0, sessionsRemoved: 0,
}

/** Postgres advisory lock key for the retention run: one server at a time (a deploy overlaps two). */
const LOCK_KEY = 7_301_026

export const FORMER_MEMBER = 'Former member'
export const FORMER_BEATER = 'Former beater'

/** A member's details, removed: the row stays, because payments, bags and guests point at it. */
export function anonymousMember(id: string) {
  return {
    email: `removed-${id}@removed.invalid`,
    clerkUserId: `removed_${id}`,
    phone: null, bascNumber: null, insuranceExpiry: null, insuranceDocument: null,
    emergencyContactName: null, emergencyContactPhone: null, notes: null,
  } satisfies Prisma.MemberUpdateInput
}

export function anonymousBeater() {
  return {
    email: null, phone: null, notes: null,
    bankName: null, bankSortCode: null, bankAccountNumber: null, bankDetailsSealed: null, bankAccountLast4: null,
  } satisfies Prisma.BeaterUpdateInput
}

/** Deletes a whole syndicate in the order its records depend on each other. */
export async function deleteSyndicate(tx: Prisma.TransactionClient, syndicateId: string): Promise<void> {
  const shoots = { shootDay: { syndicateId } }
  await tx.bagRecord.deleteMany({ where: shoots })
  await tx.beaterPayment.deleteMany({ where: { syndicateId } })
  await tx.memberPayment.deleteMany({ where: { syndicateId } })
  await tx.guestGun.deleteMany({ where: shoots })
  // Members, beaters, shoot days, attendance, bookings and the audit trail follow the syndicate.
  await tx.syndicate.delete({ where: { id: syndicateId } })
}

export async function runRetention(prisma: PrismaClient, now: Date = new Date()): Promise<RetentionResult> {
  return prisma.$transaction(async (tx) => {
    const [{ locked }] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(${LOCK_KEY}) AS locked`
    if (!locked) return { ...EMPTY }
    const result: RetentionResult = { ...EMPTY, ran: true }
    const cutoff = paymentCutoff(now)
    const daysAgo = (days: number) => new Date(now.getTime() - days * DAY)
    const leaverCutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - RETENTION.leaverMonths, now.getUTCDate()))
    const perSyndicate = new Map<string, Record<string, number>>()
    const note = (syndicateId: string, what: string, count: number) => {
      if (count === 0) return
      const entry = perSyndicate.get(syndicateId) ?? {}
      entry[what] = (entry[what] ?? 0) + count
      perSyndicate.set(syndicateId, entry)
    }

    // 1. Syndicates whose plan ended 90 days ago, or that never chose one in 90 days: everything goes.
    const ninety = daysAgo(RETENTION.syndicateDaysAfterPlanEnds)
    const due: Prisma.SyndicateWhereInput = {
      OR: [
        { planEndedAt: { lte: ninety }, stripeSubscriptionStatus: { notIn: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
        { planEndedAt: { lte: ninety }, stripeSubscriptionStatus: null },
        { planEndedAt: null, stripeSubscriptionStatus: null, stripeSubscriptionId: null, createdAt: { lte: ninety } },
      ],
    }
    const ended = await tx.syndicate.findMany({ where: due, select: { id: true } })
    for (const { id } of ended) {
      // Locked and checked again: a plan started this very moment (Stripe's webhook) wins.
      await tx.$queryRaw`SELECT "id" FROM "syndicates" WHERE "id" = ${id} FOR UPDATE`
      if (!(await tx.syndicate.findFirst({ where: { AND: [{ id }, due] }, select: { id: true } }))) continue
      await deleteSyndicate(tx, id)
      result.syndicatesDeleted++
    }

    // 0. Anyone made inactive without a leaving date (by older code during a deploy) gets one now.
    await tx.$executeRaw`UPDATE "members" SET "left_at" = "updated_at" WHERE "status" = 'INACTIVE' AND "left_at" IS NULL`
    await tx.$executeRaw`UPDATE "beaters" SET "left_at" = "updated_at" WHERE "status" = 'INACTIVE' AND "left_at" IS NULL`

    // 2. Guests: contact details 30 days after the day; those who never accepted or paid, gone.
    const contactCutoff = daysAgo(RETENTION.guestContactDays)
    const neverAccepted = await tx.guestGun.findMany({
      where: { shootDay: { date: { lt: contactCutoff } }, waiverAccepted: false, paymentStatus: { in: ['PENDING', 'OVERDUE'] } },
      select: { id: true, shootDay: { select: { syndicateId: true } } },
    })
    if (neverAccepted.length) {
      await tx.guestGun.deleteMany({ where: { id: { in: neverAccepted.map((g) => g.id) } } })
      neverAccepted.forEach((g) => note(g.shootDay.syndicateId, 'guests who never accepted', 1))
      result.guestsRemoved += neverAccepted.length
    }
    const withContacts = await tx.guestGun.findMany({
      where: {
        shootDay: { date: { lt: contactCutoff } },
        OR: [{ emergencyContactName: { not: null } }, { emergencyContactPhone: { not: null } }, { phone: { not: null } }, { inviteToken: { not: null } }, { NOT: { email: { endsWith: '@removed.invalid' } } }],
      },
      select: { id: true, shootDay: { select: { syndicateId: true } } },
    })
    if (withContacts.length) {
      const ids = withContacts.map((g) => g.id)
      await tx.guestGun.updateMany({ where: { id: { in: ids } }, data: { emergencyContactName: null, emergencyContactPhone: null, phone: null, inviteToken: null } })
      await tx.$executeRaw`UPDATE "guest_guns" SET "email" = 'removed-' || "id" || '@removed.invalid' WHERE "id" = ANY(${ids}) AND "email" NOT LIKE '%@removed.invalid'`
      withContacts.forEach((g) => note(g.shootDay.syndicateId, 'guest emergency contacts', 1))
      result.guestContactsCleared += withContacts.length
    }
    // An accepted or paid guest goes with the payment rule: 6 years after the day's tax year.
    const oldGuests = await tx.guestGun.findMany({ where: { shootDay: { date: { lt: cutoff } } }, select: { id: true, shootDay: { select: { syndicateId: true } } } })
    if (oldGuests.length) {
      await tx.guestGun.deleteMany({ where: { id: { in: oldGuests.map((g) => g.id) } } })
      oldGuests.forEach((g) => note(g.shootDay.syndicateId, 'guest records past 6 years', 1))
      result.guestsRemoved += oldGuests.length
    }

    // 3. Payments 6 years after the end of their tax year. Never one still owed.
    const oldBeaterPay = await tx.beaterPayment.findMany({
      where: { status: 'PAID', shootDay: { date: { lt: cutoff } }, OR: [{ paidDate: null }, { paidDate: { lt: cutoff } }] },
      select: { id: true, syndicateId: true },
    })
    const oldMemberPay = await tx.memberPayment.findMany({
      where: { status: { in: ['PAID', 'REFUNDED'] }, OR: [{ paidDate: { lt: cutoff } }, { paidDate: null, createdAt: { lt: cutoff } }] },
      select: { id: true, syndicateId: true },
    })
    if (oldBeaterPay.length) await tx.beaterPayment.deleteMany({ where: { id: { in: oldBeaterPay.map((p) => p.id) } } })
    if (oldMemberPay.length) await tx.memberPayment.deleteMany({ where: { id: { in: oldMemberPay.map((p) => p.id) } } })
    ;[...oldBeaterPay, ...oldMemberPay].forEach((p) => note(p.syndicateId, 'payments past 6 years', 1))
    result.paymentsRemoved += oldBeaterPay.length + oldMemberPay.length

    // 4. Bank details of beaters who have left, 90 days after their last payment was settled.
    const bankCutoff = daysAgo(RETENTION.bankDetailsDaysAfterLastPayment)
    const leftBeaters = await tx.beater.findMany({
      where: {
        status: 'INACTIVE',
        leftAt: { lt: bankCutoff },
        OR: [{ bankDetailsSealed: { not: null } }, { bankSortCode: { not: null } }, { bankAccountNumber: { not: null } }, { bankName: { not: null } }],
        payments: { none: { OR: [{ status: 'PENDING' }, { paidDate: { gte: bankCutoff } }] } },
      },
      select: { id: true, syndicateId: true },
    })
    if (leftBeaters.length) {
      // The same conditions again in the write: a beater brought back or newly owed this moment keeps theirs.
      await tx.beater.updateMany({
        where: { id: { in: leftBeaters.map((b) => b.id) }, status: 'INACTIVE', leftAt: { lt: bankCutoff }, payments: { none: { OR: [{ status: 'PENDING' }, { paidDate: { gte: bankCutoff } }] } } },
        data: { bankName: null, bankSortCode: null, bankAccountNumber: null, bankDetailsSealed: null, bankAccountLast4: null },
      })
      leftBeaters.forEach((b) => note(b.syndicateId, 'bank details of beaters who left', 1))
      result.bankDetailsCleared += leftBeaters.length
    }

    // 5a. A member's emergency contact is kept while they are a member, not after.
    const leftWithContact = await tx.member.findMany({
      where: { status: 'INACTIVE', OR: [{ emergencyContactName: { not: null } }, { emergencyContactPhone: { not: null } }] },
      select: { id: true, syndicateId: true },
    })
    if (leftWithContact.length) {
      await tx.member.updateMany({ where: { id: { in: leftWithContact.map((m) => m.id) } }, data: { emergencyContactName: null, emergencyContactPhone: null } })
      leftWithContact.forEach((m) => note(m.syndicateId, 'emergency contacts of members who left', 1))
    }

    // 5. Members and beaters who left 12 months ago: contact details go; the name stays only
    // while a payment record (or a guest they invited) still needs it.
    const oldMembers = await tx.member.findMany({
      where: { status: 'INACTIVE', leftAt: { lt: leaverCutoff }, NOT: { email: { endsWith: '@removed.invalid' } } },
      select: { id: true, syndicateId: true },
    })
    for (const m of oldMembers) {
      const done = await tx.member.updateMany({ where: { id: m.id, status: 'INACTIVE', leftAt: { lt: leaverCutoff } }, data: anonymousMember(m.id) })
      if (done.count) note(m.syndicateId, 'members who left over 12 months ago', 1)
    }
    // Never while they are still owed money: those details are how they get paid.
    const oldBeaters = await tx.beater.findMany({
      where: {
        status: 'INACTIVE',
        leftAt: { lt: leaverCutoff },
        payments: { none: { status: 'PENDING' } },
        OR: [{ email: { not: null } }, { phone: { not: null } }, { notes: { not: null } }, { bankDetailsSealed: { not: null } }],
      },
      select: { id: true, syndicateId: true },
    })
    for (const b of oldBeaters) {
      const done = await tx.beater.updateMany({ where: { id: b.id, status: 'INACTIVE', leftAt: { lt: leaverCutoff }, payments: { none: { status: 'PENDING' } } }, data: anonymousBeater() })
      if (done.count) note(b.syndicateId, 'beaters who left over 12 months ago', 1)
    }
    result.leaversAnonymised += oldMembers.length + oldBeaters.length
    const nameless = await tx.member.updateMany({
      where: { status: 'INACTIVE', leftAt: { lt: leaverCutoff }, name: { not: FORMER_MEMBER }, memberPayments: { none: {} }, guestsInvited: { none: {} } },
      data: { name: FORMER_MEMBER },
    })
    const namelessBeaters = await tx.beater.updateMany({
      where: { status: 'INACTIVE', leftAt: { lt: leaverCutoff }, name: { not: FORMER_BEATER }, payments: { none: {} } },
      data: { name: FORMER_BEATER },
    })
    result.namesRemoved += nameless.count + namelessBeaters.count

    // 6. The audit trail, on the payment rule.
    const audit = await tx.activityLog.deleteMany({ where: { timestamp: { lt: cutoff } } })
    result.auditEntriesRemoved += audit.count

    // 7. Session records, once no sign-in could still be using them.
    const sessions = await tx.sessionActivity.deleteMany({ where: { firstSeenAt: { lt: daysAgo(RETENTION.sessionDays) } } })
    result.sessionsRemoved += sessions.count

    // What was removed, in each syndicate's own trail (counts only).
    for (const [syndicateId, counts] of perSyndicate) {
      await recordActivity(tx, { syndicateId, action: 'Records past their retention period removed', actorRole: 'system', details: counts })
    }
    return result
  }, { timeout: 120_000, maxWait: 10_000 })
}
