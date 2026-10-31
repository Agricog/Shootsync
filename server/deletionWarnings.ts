/**
 * Warning captains before their records are deleted - ShootSync
 *
 * A syndicate whose plan has ended (or that never started one) is deleted 90 days later by the
 * retention job (server/retention.ts). The captain is emailed 30, 7 and 1 day before that date,
 * so the deletion never comes as a surprise and there is time to download everything or start a
 * plan. Runs every hour, straight after the retention job.
 *
 * - Once each: a row in deletion_warnings (migration 0008) per syndicate, deletion date and
 *   warning, unique, so two servers can't both claim it.
 * - Claim, send, confirm. The claim is a short transaction that locks the syndicate and checks again
 *   that its plan hasn't just started (Stripe's webhook wins, as in the retention job). The email
 *   is sent after that commits, never inside a transaction, so a rollback can't undo a send and
 *   no database connection waits on Resend. Then the claim is marked 'sent'.
 * - A server that stops mid-send leaves its claim 'pending'. After CLAIM_LEASE_MS it is taken
 *   again. The idempotency key names the warning and a fingerprint of the exact email (which names
 *   the date, never a count of days, so it doesn't change from one day to the next): the same email
 *   resent is accepted by Resend once. If the email has changed in between (the captain changed
 *   their address, say), it has a new key and goes; better twice than not at all. Resend remembers a
 *   key for 24 hours and retries come hourly, so a second copy needs the job to have been down for
 *   a day after a send whose answer was lost.
 * - Never a pile-up: if the job was down and several warnings are overdue, only the most urgent
 *   one goes (a captain with 5 days left gets the 7-day warning, not the 30-day one as well).
 * - No address is kept: the captain's email is looked up from the sign-in service (Clerk) at the
 *   moment of sending. If their account has none, that is recorded (so it isn't tried every hour)
 *   and the owner is alerted.
 * - A failed send is alerted and tried again next hour. Alerts carry IDs, the HTTP status and
 *   Resend's error code: never an address, never Resend's own wording.
 * - Every warning sent is written to the syndicate's activity log, without the address.
 */

import { createHash } from 'node:crypto'
import { Prisma, type PrismaClient, type StripeSubscriptionStatus } from '@prisma/client'
import type { Alerts } from './alerts.js'
import { recordActivity } from './audit.js'
import { escapeHtml, MAIL_REPLY_TO, MailError, type Mailer, type OutgoingEmail } from './mailer.js'
import { RETENTION, syndicateDeletionDate } from './retention.js'
import { HIDDEN_CHARACTERS } from './validation.js'

const DAY = 24 * 60 * 60 * 1000

/** Plans on which nothing is deleted. */
const LIVE_PLAN: StripeSubscriptionStatus[] = ['ACTIVE', 'TRIALING', 'PAST_DUE']

/**
 * How long a claim belongs to the server that took it. A send gives up after 10 seconds, so a claim
 * still 'pending' after this is from a server that stopped, and is taken again.
 */
export const CLAIM_LEASE_MS = 15 * 60 * 1000

/**
 * Another server got there first: the unique index refused this claim. Checked by Prisma's error
 * code rather than its class alone, so it holds however the client is bundled.
 */
const alreadyClaimed = (err: unknown) =>
  (err instanceof Prisma.PrismaClientKnownRequestError || (err as { name?: unknown } | null)?.name === 'PrismaClientKnownRequestError') &&
  (err as { code?: unknown }).code === 'P2002'

/** Looks up the captain's email address from the sign-in service. Null when the account has none. */
export type CaptainEmail = (clerkUserId: string) => Promise<string | null>

export interface DeletionWarningDeps {
  mailer: Mailer
  captainEmail: CaptainEmail
  alerts: Alerts
  /** The public site, for the link in the email. */
  siteUrl: string
  /** When the run starts (which warnings are due). Defaults to the clock. */
  now?: Date
  /** The time each claim and send is recorded at, read when it happens. Defaults to the real time, or to `now` if given. */
  clock?: () => Date
}

export interface DeletionWarningResult {
  sent: number
  noEmail: number
  failed: number
}

/** Whole days left until `deletionDate`, rounded up: 29 days and an hour left is 30. */
export function daysLeft(deletionDate: Date, now: Date): number {
  return Math.ceil((deletionDate.getTime() - now.getTime()) / DAY)
}

/**
 * Which warning is due with this many days left: the most urgent one whose time has come, or
 * null if none has (more than 30 days left) or the date has passed (the retention job's turn).
 */
export function warningDue(days: number): number | null {
  if (days < 1) return null
  const due = RETENTION.deletionWarningDays.filter((d) => days <= d)
  return due.length ? Math.min(...due) : null
}

const LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const longUtc = (date: Date) => {
  const parts = LONG.formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('weekday')} ${get('day')} ${get('month')} ${get('year')}`
}

/** The calendar day `date` falls on in the UK, as midnight UTC of that day (so it can be counted back). */
function ukDay(date: Date): Date {
  const parts = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Europe/London' }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')))
}

/** "Thursday 28 January 2027": the UK day the deletion falls on, and the day before it. */
export function deletionDays(deletionDate: Date): { on: string; dayBefore: string } {
  const day = ukDay(deletionDate)
  return { on: longUtc(day), dayBefore: longUtc(new Date(day.getTime() - DAY)) }
}

/**
 * A name on one line, for a subject: no line breaks or hidden characters. New names can't contain
 * them (server/routes/syndicates.ts); this covers any saved before that check.
 */
export function oneLine(text: string): string {
  return text.replace(new RegExp(HIDDEN_CHARACTERS.source, 'gu'), ' ').replace(/\s+/g, ' ').trim()
}

export interface WarningEmailInput {
  syndicateName: string
  deletionDate: Date
  /** Which warning: 30, 7 or 1. */
  stage: number
  /** The captain archived it: it is gone from the app, and can't be reopened or downloaded. */
  archived: boolean
  siteUrl: string
}

/**
 * The email, in words a captain can act on. Plain text first; the HTML says the same.
 * It names dates, never a count of days, so a resend of the same warning is the same email (and
 * Resend's idempotency key accepts it once), and it is right whenever it arrives. The deletion
 * runs during the day named, so the day to act by is the day before.
 */
export function warningEmail({ syndicateName, deletionDate, stage, archived, siteUrl }: WarningEmailInput): { subject: string; text: string; html: string } {
  const name = oneLine(syndicateName)
  const { on, dayBefore } = deletionDays(deletionDate)
  const subject = `${name}: ${stage === 1 ? 'final notice, ' : ''}records will be deleted on ${on}`
  const settings = `${siteUrl}/settings`
  const what = 'members, beaters and their pay, shoot days, the game book, guests and their signed acknowledgements, and the activity log'
  const lines = archived
    ? [
        `You archived ${name} in ShootSync. Its records (${what}) will be deleted for good on ${on}.`,
        `If you meant to leave, there is nothing to do.`,
        `If you didn't mean to archive it, reply to this email as soon as you can, and before ${dayBefore}.`,
      ]
    : [
        `${name} has no active ShootSync plan, so its records (${what}) will be deleted for good on ${on}. To be safe, act by ${dayBefore}.`,
        `To keep using ShootSync, choose a plan: ${settings}`,
        `To keep a copy, sign in and use Download everything under Settings, Your records: ${settings}`,
        `Keeping payment records for HMRC after that is the syndicate's own responsibility, from your download.`,
      ]
  const footer = `You are receiving this because you are the captain of ${name} on ShootSync. Questions: reply to this email or write to ${MAIL_REPLY_TO}.`
  const text = [...lines, '', footer].join('\n\n')
  const link = (t: string) => escapeHtml(t).replace(escapeHtml(settings), `<a href="${escapeHtml(settings)}">${escapeHtml(settings)}</a>`)
  const html = [
    '<div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #0f172a; max-width: 560px">',
    ...lines.map((l) => `<p>${link(l)}</p>`),
    `<p style="font-size: 13px; color: #475569">${escapeHtml(footer)}</p>`,
    '</div>',
  ].join('\n')
  return { subject, text, html }
}

/** What an alert may say about a failure: the mailer's own sentence (status and code only), or the error's kind. */
const failureText = (err: unknown) => (err instanceof MailError ? err.message : err instanceof Error ? err.name : 'unknown error')

/**
 * Names the warning and the exact email it is: the same email resent has the same key (and Resend
 * sends it once); a changed email has a new one (and goes, rather than being refused every hour).
 */
export function idempotencyKey(syndicateId: string, deletionDate: Date, stage: number, email: Omit<OutgoingEmail, 'idempotencyKey'>): string {
  const fingerprint = createHash('sha256').update(JSON.stringify([email.to, email.subject, email.text, email.html])).digest('hex').slice(0, 16)
  return `deletion-warning/${syndicateId}/${deletionDate.toISOString()}/${stage}/${fingerprint}`
}

interface Claim {
  syndicateId: string
  deletionDate: Date
  stage: number
  outcome: 'pending' | 'no_email'
  /** A stale 'pending' claim to take over, exactly as it was read. */
  retake: { id: string; claimedAt: Date } | null
  now: Date
}

/**
 * Takes the claim, or returns null if there is nothing to send after all: another server has it,
 * or the plan has just started or changed (checked again under a lock on the syndicate).
 */
async function claimWarning(prisma: PrismaClient, c: Claim): Promise<string | null> {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "syndicates" WHERE "id" = ${c.syndicateId} FOR UPDATE`
      const fresh = await tx.syndicate.findUnique({ where: { id: c.syndicateId }, select: { planEndedAt: true, stripeSubscriptionStatus: true, stripeSubscriptionId: true, createdAt: true } })
      if (!fresh || (fresh.stripeSubscriptionStatus !== null && LIVE_PLAN.includes(fresh.stripeSubscriptionStatus)) || syndicateDeletionDate(fresh)?.getTime() !== c.deletionDate.getTime()) return null
      if (c.retake) {
        const { count } = await tx.deletionWarning.updateMany({ where: { id: c.retake.id, outcome: 'pending', claimedAt: c.retake.claimedAt }, data: { outcome: c.outcome, claimedAt: c.now } })
        return count === 1 ? c.retake.id : null
      }
      // A less urgent warning that was never confirmed is replaced by this one.
      await tx.deletionWarning.updateMany({ where: { syndicateId: c.syndicateId, deletionDueAt: c.deletionDate, daysBefore: { gt: c.stage }, outcome: 'pending' }, data: { outcome: 'superseded' } })
      const row = await tx.deletionWarning.create({ data: { syndicateId: c.syndicateId, deletionDueAt: c.deletionDate, daysBefore: c.stage, outcome: c.outcome, claimedAt: c.now }, select: { id: true } })
      return row.id
    })
  } catch (err) {
    if (alreadyClaimed(err)) return null
    throw err
  }
}

export async function runDeletionWarnings(prisma: PrismaClient, deps: DeletionWarningDeps): Promise<DeletionWarningResult> {
  const fixed = deps.now
  const clock = deps.clock ?? (fixed ? () => fixed : () => new Date())
  const now = fixed ?? clock()
  const result: DeletionWarningResult = { sent: 0, noEmail: 0, failed: 0 }
  // Anything whose deletion date is within the longest warning period, and that isn't on a live plan.
  const longest = Math.max(...RETENTION.deletionWarningDays)
  const startedBefore = new Date(now.getTime() - (RETENTION.syndicateDaysAfterPlanEnds - longest) * DAY)
  const candidates = await prisma.syndicate.findMany({
    where: {
      OR: [{ stripeSubscriptionStatus: null }, { stripeSubscriptionStatus: { notIn: LIVE_PLAN } }],
      AND: [{ OR: [{ planEndedAt: { lte: startedBefore } }, { planEndedAt: null, createdAt: { lte: startedBefore } }] }],
    },
    select: { id: true, name: true, status: true, captainClerkId: true, planEndedAt: true, stripeSubscriptionStatus: true, stripeSubscriptionId: true, createdAt: true },
    orderBy: { id: 'asc' },
  })

  for (const s of candidates) {
    const deletionDate = syndicateDeletionDate(s)
    if (!deletionDate) continue
    const stage = warningDue(daysLeft(deletionDate, now))
    if (stage === null) continue
    const details = { syndicate: s.id, daysBefore: stage, deletionDate: deletionDate.toISOString().slice(0, 10) }

    try {
      // This warning, or a more urgent one, already handled for this deletion date: nothing to do,
      // unless it is a claim left 'pending' by a server that stopped mid-send.
      const existing = await prisma.deletionWarning.findFirst({ where: { syndicateId: s.id, deletionDueAt: deletionDate, daysBefore: { lte: stage } }, orderBy: { daysBefore: 'asc' }, select: { id: true, outcome: true, claimedAt: true, daysBefore: true } })
      const stale = existing?.outcome === 'pending' && existing.daysBefore === stage && existing.claimedAt.getTime() <= clock().getTime() - CLAIM_LEASE_MS
      if (existing && !stale) continue

      let address: string | null
      try {
        address = await deps.captainEmail(s.captainClerkId)
      } catch (err) {
        result.failed++
        deps.alerts.alert('email', 'A deletion warning could not be sent: the captain’s email address could not be looked up. It will be tried again in an hour.', { ...details, error: failureText(err) })
        continue
      }

      const claim = await claimWarning(prisma, { syndicateId: s.id, deletionDate, stage, outcome: address ? 'pending' : 'no_email', retake: stale ? existing : null, now: clock() })
      if (!claim) continue

      if (!address) {
        result.noEmail++
        deps.alerts.alert('email', 'A deletion warning could not be sent: the captain’s account has no email address. Contact them another way before the deletion date.', details)
        continue
      }

      const email = warningEmail({ syndicateName: s.name, deletionDate, stage, archived: s.status === 'ARCHIVED', siteUrl: deps.siteUrl })
      try {
        await deps.mailer.send({ to: address, ...email, idempotencyKey: idempotencyKey(s.id, deletionDate, stage, { to: address, ...email }) })
      } catch (err) {
        // The claim stays 'pending' and is taken again next hour, once its lease is up. The same
        // email goes under the same key, so if this one did reach Resend it isn't sent twice.
        result.failed++
        deps.alerts.alert('email', 'A deletion warning could not be sent. It will be tried again in an hour.', { ...details, error: failureText(err) })
        continue
      }

      await prisma.$transaction(async (tx) => {
        const { count } = await tx.deletionWarning.updateMany({ where: { id: claim, outcome: 'pending' }, data: { outcome: 'sent', sentAt: clock() } })
        if (count === 1) await recordActivity(tx, { syndicateId: s.id, action: 'Deletion warning emailed', actorRole: 'system', actorUserId: 'system', targetType: 'syndicate', targetId: s.id, details: { daysBefore: stage, deletionDate: details.deletionDate } })
      })
      result.sent++
    } catch (err) {
      // Anything unexpected (the database, say) for one syndicate never stops the others. A send
      // that went but wasn't confirmed is taken again later with the same key, so it isn't repeated.
      result.failed++
      deps.alerts.report(err, 'deletion warning', details)
    }
  }
  return result
}

/**
 * The captain's address, from Clerk, at the moment of sending: their primary email if Clerk has
 * one. An account that has been deleted, or has no address, is null (recorded and alerted, above).
 */
export function clerkCaptainEmail(getUser: (id: string) => Promise<{ primaryEmailAddress: { emailAddress: string } | null }>, timeoutMs = 10_000): CaptainEmail {
  return async (clerkUserId) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    // A lookup that hangs can't hold up the run: it fails, and is tried again next hour.
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('The sign-in service did not answer in time'), { name: 'TimeoutError' })), timeoutMs)
    })
    try {
      const user = await Promise.race([getUser(clerkUserId), timeout])
      return user.primaryEmailAddress?.emailAddress ?? null
    } catch (err) {
      // Clerk answers 404 for an account that no longer exists: no address to send to.
      if ((err as { status?: unknown } | null)?.status === 404) return null
      throw err
    } finally {
      clearTimeout(timer)
    }
  }
}
