/**
 * The audit trail - ShootSync
 *
 * Every change to a syndicate's records is written to activity_logs: what happened (in words),
 * to which record, by whom, when, and which fields changed. Never the values: a name, a phone
 * number or a bank detail never enters the trail, so the trail can be kept for as long as the
 * payments it explains (6 years) without holding personal data that should have gone sooner.
 * Entries can't be edited (a database trigger refuses it); only the retention job removes them.
 *
 * How it is written:
 *   - every successful change made through a signed-in route is recorded when the response is
 *     sent, from the access check that route already makes (requireSyndicateAccess notes the
 *     syndicate and the caller) and the route's own name for the action (ACTIONS below);
 *   - changes that don't come through a signed-in route (a guest accepting, Stripe telling us a
 *     card was disputed, the nightly retention job) are recorded where they happen, with
 *     recordActivity.
 *
 * If a record can't be written the change has still happened, so the failure is reported to the
 * owner (an alert) rather than hidden: a gap in the trail is itself something to know about.
 */

import type { NextFunction, Request, Response } from 'express'
import type { Prisma, PrismaClient } from '@prisma/client'
import type { Alerts } from './alerts.js'

export type ActorRole = 'captain' | 'gun' | 'guest' | 'stripe' | 'system'

export interface ActivityEntry {
  syndicateId: string
  action: string
  actorRole: ActorRole
  actorUserId?: string | null
  actorMemberId?: string | null
  targetType?: string | null
  targetId?: string | null
  /** IDs, counts, field names and statuses only: never a person's details. */
  details?: Record<string, unknown> | null
}

type Writer = Pick<PrismaClient, 'activityLog'> | Prisma.TransactionClient

export async function recordActivity(db: Writer, entry: ActivityEntry): Promise<void> {
  await db.activityLog.create({
    data: {
      syndicateId: entry.syndicateId,
      action: entry.action,
      actorRole: entry.actorRole,
      actorUserId: entry.actorUserId ?? null,
      actorMemberId: entry.actorMemberId ?? null,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      details: (entry.details ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })
}

/**
 * What each change is called in the trail, by route. A route that changes records and is not
 * listed here is a failing test (tests/audit.test.ts), so nothing can be added unrecorded.
 * `target` names the kind of record the route's :id refers to.
 */
export const ACTIONS: Record<string, { action: string; target: string | null }> = {
  'POST /api/syndicates': { action: 'Syndicate created', target: 'syndicate' },
  'PATCH /api/syndicates/:id': { action: 'Syndicate settings changed', target: 'syndicate' },
  'DELETE /api/syndicates/:id': { action: 'Syndicate archived', target: 'syndicate' },
  'POST /api/syndicates/:id/export': { action: 'Full export downloaded', target: 'syndicate' },
  'POST /api/members/:id/erase': { action: 'Member’s details erased on request', target: 'member' },
  'POST /api/beaters/:id/erase': { action: 'Beater’s details erased on request', target: 'beater' },
  'POST /api/guests/:id/erase': { action: 'Guest’s details erased on request', target: 'guest' },
  'POST /api/members': { action: 'Member added', target: 'member' },
  'PATCH /api/members/:id': { action: 'Member details changed', target: 'member' },
  'PATCH /api/members/:id/status': { action: 'Member status changed', target: 'member' },
  'DELETE /api/members/:id': { action: 'Member removed', target: 'member' },
  'POST /api/beaters': { action: 'Beater added', target: 'beater' },
  'PATCH /api/beaters/:id': { action: 'Beater details changed', target: 'beater' },
  'DELETE /api/beaters/:id': { action: 'Beater removed', target: 'beater' },
  'POST /api/beaters/:id/pay': { action: 'Beater paid', target: 'beater' },
  'POST /api/beaters/:id/bank-details/reveal': { action: 'Bank details shown', target: 'beater' },
  'POST /api/beaters/payments/bank-export': { action: 'Bank details exported for payment', target: null },
  'POST /api/shoots': { action: 'Shoot day created', target: 'shoot' },
  'PATCH /api/shoots/:id': { action: 'Shoot day changed', target: 'shoot' },
  'POST /api/shoots/:id/complete': { action: 'Shoot day completed', target: 'shoot' },
  'POST /api/shoots/:id/cancel': { action: 'Shoot day cancelled', target: 'shoot' },
  'DELETE /api/shoots/:id': { action: 'Shoot day deleted', target: 'shoot' },
  'POST /api/shoots/:id/beaters': { action: 'Beater booked', target: 'shoot' },
  'PATCH /api/shoots/:id/beaters/:bookingId': { action: 'Beater booking changed', target: 'shoot' },
  'DELETE /api/shoots/:id/beaters/:bookingId': { action: 'Beater booking removed', target: 'shoot' },
  'PUT /api/shoots/:id/pegs': { action: 'Pegs saved', target: 'shoot' },
  'POST /api/shoots/:id/checkin': { action: 'Checked in', target: 'shoot' },
  'POST /api/bags': { action: 'Bag recorded', target: 'bag' },
  'PATCH /api/bags/:id': { action: 'Bag changed', target: 'bag' },
  'DELETE /api/bags/:id': { action: 'Bag removed', target: 'bag' },
  'POST /api/guests': { action: 'Guest invited', target: 'guest' },
  'PATCH /api/guests/:id': { action: 'Guest details changed', target: 'guest' },
  'PATCH /api/guests/:id/payment': { action: 'Guest payment recorded', target: 'guest' },
  'DELETE /api/guests/:id': { action: 'Guest removed', target: 'guest' },
  'POST /api/guests/token/:token/accept': { action: 'Guest accepted the invitation', target: 'guest' },
  'POST /api/guests/token/:token/decline': { action: 'Guest declined the invitation', target: 'guest' },
  'POST /api/subscriptions/create-checkout': { action: 'Plan checkout started', target: null },
  'POST /api/subscriptions/portal': { action: 'Billing page opened', target: null },
}

/**
 * The field names the trail may record. A request's own keys are never written as they come
 * (anyone allowed to call a route could otherwise put any text into a record kept for 6 years):
 * only names on this list are kept.
 */
export const AUDIT_FIELDS = new Set([
  'name', 'email', 'phone', 'dayRate', 'bankName', 'bankSortCode', 'bankAccountNumber', 'clearBankDetails', 'notes', 'status',
  'role', 'seasonStart', 'seasonEnd', 'defaultBeaterRate', 'pegRotationRule', 'waiverExtra', 'subscriptionAmount',
  'subscriptionType', 'locationName', 'locationAddress', 'locationPostcode', 'locationWhat3Words', 'meetTime', 'drivesPlanned',
  'expectedBag', 'captainNotes', 'weatherNotes', 'date', 'pegNumber', 'dayFee', 'paid', 'allocations', 'payments',
  'paymentReference', 'emergencyContactName', 'emergencyContactPhone', 'waiverAccepted', 'pheasant', 'partridge', 'duck',
  'woodcock', 'other', 'otherDescription', 'driveNumber', 'beaterIds', 'memberId', 'shootId', 'planTier', 'bascNumber',
  'insuranceExpiry', 'dayRatePence',
])

/** Routes that change nothing kept on the record, so are deliberately not in the trail. */
export const NOT_RECORDED: Record<string, string> = {
  'POST /api/shoots/:id/pegs/draw': 'Proposes a draw; saves nothing',
  'POST /api/session/ping': 'Keeps a signed-in session awake; no syndicate record',
  'POST /api/csp-report': 'Browser report about the page; no syndicate record',
  'POST /api/stripe/webhook': 'Stripe: recorded where each event is handled',
  'POST /api/subscriptions/webhook': 'Stripe: recorded where each event is handled',
}

/** What requireSyndicateAccess notes on the response for the trail. */
export interface AuditContext {
  syndicateId: string
  actorUserId: string | null
  actorMemberId: string | null
  actorRole: ActorRole
}

export function noteAuditContext(res: Response | undefined, context: AuditContext): void {
  if (res?.locals) res.locals.audit = context
}

/** A public route's entry: the syndicate and record it touched, with the guest as the actor. */
export function noteGuestAction(res: Response, syndicateId: string, guestId: string): void {
  noteAuditContext(res, { syndicateId, actorUserId: null, actorMemberId: null, actorRole: 'guest' })
  res.locals.auditTargetId = guestId
}

/** The record a route created or acted on, when its address doesn't name it. */
export function noteAuditTarget(res: Response, id: string): void {
  res.locals.auditTargetId = id
}

/**
 * Writes the entry now, before the route answers, for actions that must never happen unrecorded
 * (bank details shown or exported). If it can't be written, the route fails instead.
 */
export async function recordBeforeAnswering(prisma: PrismaClient, res: Response, details: Record<string, unknown> = {}): Promise<void> {
  const context = res.locals.audit as AuditContext | undefined
  const pattern = res.locals.routePattern as string | undefined
  const known = pattern ? ACTIONS[pattern] : undefined
  if (!context || !known) throw new Error(`audit: no context or name for ${pattern ?? 'an unnamed route'}`)
  const params = (res.locals.routeParams ?? {}) as Record<string, string>
  await recordActivity(prisma, {
    syndicateId: context.syndicateId,
    action: known.action,
    actorRole: context.actorRole,
    actorUserId: context.actorUserId,
    actorMemberId: context.actorMemberId,
    targetType: known.target,
    targetId: known.target ? (params.id ?? null) : null,
    details,
  })
  res.locals.auditWritten = true
}

/** Extra facts a route adds to its own entry (IDs, counts): res.locals.auditDetails. */
export function addAuditDetails(res: Response, details: Record<string, unknown>): void {
  res.locals.auditDetails = { ...(res.locals.auditDetails ?? {}), ...details }
}

/**
 * Writes the entry for every successful change before the answer goes back: by the time anyone is
 * told a change was saved, it is in the trail. (The change itself is already saved, so a failed
 * write doesn't undo it or hide it from the user; it is reported to the owner as a gap.) Mount
 * once, at /api, before the routes.
 */
export function auditTrail(prisma: PrismaClient, alerts: Alerts) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
    const entryFor = (): ActivityEntry | null => {
      if (res.statusCode < 200 || res.statusCode >= 300) return null
      const context = res.locals.audit as AuditContext | undefined
      const pattern = res.locals.routePattern as string | undefined
      // Already written by the route itself, before it answered (bank details shown or exported).
      if (res.locals.auditWritten || !pattern || NOT_RECORDED[pattern]) return null
      const known = ACTIONS[pattern]
      if (!known || !context) {
        alerts.alert('config', known ? 'A change was made through a route that did not note who made it, so it is missing from the audit trail.' : 'A change was made through a route with no name in the audit trail.', { route: pattern })
        return null
      }
      const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : {}
      const fields = Object.keys(body).filter((key) => AUDIT_FIELDS.has(key)).sort()
      const params = (res.locals.routeParams ?? {}) as Record<string, string>
      // A route whose :id isn't the record (a guest's invite token, a new record) names it itself.
      const targetId = known.target ? ((res.locals.auditTargetId as string | undefined) ?? params.id ?? null) : null
      return {
        syndicateId: context.syndicateId,
        action: known.action,
        actorRole: context.actorRole,
        actorUserId: context.actorUserId,
        actorMemberId: context.actorMemberId,
        targetType: known.target,
        targetId,
        details: { ...(fields.length ? { fields } : {}), ...(res.locals.auditDetails ?? {}) },
      }
    }
    const write = async () => {
      const entry = entryFor()
      if (!entry) return
      res.locals.auditWritten = true
      await recordActivity(prisma, entry).catch((err) => alerts.report(err, 'audit trail: write', { route: res.locals.routePattern }))
    }
    // Every route answers with res.json: the entry is written first, then the answer is sent.
    const send = res.json.bind(res)
    res.json = ((payload: unknown) => {
      void write().finally(() => send(payload))
      return res
    }) as Response['json']
    // Anything answered another way is still recorded, as it goes.
    res.on('finish', () => void write())
    next()
  }
}
