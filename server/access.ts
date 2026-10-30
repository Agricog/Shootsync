/**
 * Access control - ShootSync
 *
 * The app-layer ownership check is the primary control (Standard §07.1).
 * Every handler that touches syndicate data resolves the record's syndicate
 * and calls requireSyndicateAccess before reading or writing anything.
 *
 * "No access" and "does not exist" give the same 404, so another captain's
 * IDs cannot be probed.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { Prisma, type PrismaClient } from '@prisma/client'
import { ZodError } from 'zod'
import { validationResponse } from './validation.js'
import { errorReference, type Alerts } from './alerts.js'
import { noteAuditContext } from './audit.js'
import { syndicateDeletionDate } from './retention.js'
import { SUPPORT_EMAIL } from './site.js'

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'HttpError'
  }
}

export const notFound = (what = 'That could not be found. It may have been removed.') => new HttpError(404, what)

/** Wraps an async handler so thrown errors reach one place and get a uniform response. */
export function handle(
  fn: (req: Request, res: Response) => Promise<unknown>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    // The route pattern (never the IDs in the URL) is noted here, while the router still knows it,
    // for the error report.
    const route = `${req.method} ${req.baseUrl}${req.route?.path ?? ''}`.replace(/(.)\/$/, '$1')
    // For the audit trail (server/audit.ts), which writes after the response has gone.
    res.locals.routePattern = route
    res.locals.routeParams = { ...req.params }
    fn(req, res).catch((err) => {
      // A frozen error object can't take the note; the report then names no route, nothing worse.
      try { if (err instanceof Object) (err as { route?: string }).route = route } catch { /* frozen */ }
      next(err)
    })
  }
}

/** Final error handler: known errors get their status, anything else a generic 500. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message })
  }
  if (err instanceof ZodError) {
    return res.status(400).json(validationResponse(err.issues))
  }
  // Every message is a sentence someone can act on: never a code or a database term.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'That could not be found. It may have been removed.' })
    if (err.code === 'P2002') return res.status(409).json({ error: 'That is already on the list.' })
    if (err.code === 'P2003') return res.status(409).json({ error: 'That is part of the record (a bag, a payment or a signed acknowledgement depends on it), so it can’t be removed.' })
  }
  if (err instanceof SyntaxError && 'body' in (err as object)) {
    return res.status(400).json({ error: 'That request could not be read. Reload the page and try again.' })
  }
  // Reported with a reference the user can quote; the path is the route pattern, never the IDs in it.
  const alerts = req.app?.locals?.alerts as Alerts | undefined
  const route = (err as { route?: string } | null)?.route ?? `${req.method} ${req.baseUrl ?? ''}${req.route?.path ?? ''}`
  const reference = alerts ? alerts.report(err, route) : errorReference()
  if (!alerts) console.error(`[error ${reference}] ${route}:`, err instanceof Error ? `${err.name}: ${err.message}` : String(err))
  return res.status(500).json({ error: `ShootSync had a problem with that. Try again in a moment; if it keeps happening, email ${SUPPORT_EMAIL} quoting ${reference}.`, reference })
}

/** The signed-in user. The auth gate guarantees this on protected routes. */
export function userIdOf(req: Request): string {
  const userId = req.auth?.userId
  if (!userId) throw new HttpError(401, 'Sign in required')
  return userId
}

export type AccessLevel = 'captain' | 'member'

export interface SyndicateAccess {
  syndicateId: string
  isCaptain: boolean
  /** The caller's own Member record in this syndicate, if they have one. */
  memberId: string | null
}

/** Member roles that count as a gun for 'member'-level access. Beaters have their own portal. */
export const GUN_ROLES = ['CAPTAIN', 'GUN', 'HYBRID'] as const

/**
 * Subscription states in which the syndicate can be used in full. PAST_DUE is included: while
 * Stripe retries a failed card the captain is warned but nothing stops (the owner's decision,
 * 29 Oct 2026: a card failing on Friday must not stop Saturday's shoot). Once Stripe gives up the
 * plan is UNPAID or CANCELLED, and the syndicate is read-only.
 */
const LIVE_SUBSCRIPTION_STATES = new Set(['ACTIVE', 'TRIALING', 'PAST_DUE'])

/** How long a failed card keeps full use after it first failed, while Stripe retries it. */
export const PAST_DUE_GRACE_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

export interface PlanFields {
  stripeSubscriptionStatus: string | null
  subscriptionCurrentPeriodEnd: Date | null
  disputeOpenedAt: Date | null
  pastDueSince: Date | null
}

export interface PlanAccess {
  /** Changes are accepted. */
  live: boolean
  /** Why not, when not: the message the captain sees. */
  reason: 'dispute' | 'overdue' | 'lapsed' | null
  /** While live on a failed card: the day it becomes read-only unless a payment arrives. */
  readOnlyFrom: Date | null
}

/**
 * Whether a syndicate can be changed, from its plan:
 *   - a disputed payment (chargeback) makes it read-only at once, until a payment arrives;
 *   - a failed card (PAST_DUE) keeps full use for PAST_DUE_GRACE_DAYS after it first failed
 *     (not after the paid-up date: Stripe moves that on when it raises the renewal invoice,
 *     before the card is tried), then read-only: nobody gets more than two weeks' unpaid use;
 *   - ACTIVE and TRIALING are live; everything else is read-only.
 */
export function planAccess(plan: PlanFields, now: Date): PlanAccess {
  if (plan.disputeOpenedAt) return { live: false, reason: 'dispute', readOnlyFrom: null }
  const status = plan.stripeSubscriptionStatus
  if (status === 'PAST_DUE') {
    const since = plan.pastDueSince
    const readOnlyFrom = since ? new Date(since.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS) : null
    if (readOnlyFrom && now.getTime() >= readOnlyFrom.getTime()) return { live: false, reason: 'overdue', readOnlyFrom }
    return { live: true, reason: null, readOnlyFrom }
  }
  if (status != null && LIVE_SUBSCRIPTION_STATES.has(status)) return { live: true, reason: null, readOnlyFrom: null }
  return { live: false, reason: 'lapsed', readOnlyFrom: null }
}

/** What the browser is told about a plan: the same rule, with the dates it needs to explain itself. */
export function planSummary(
  plan: PlanFields & { planTier: string | null; planEndedAt: Date | null; stripeSubscriptionId: string | null; createdAt: Date },
  now: Date,
) {
  const access = planAccess(plan, now)
  return {
    /** When everything is deleted if no plan is started before then (server/retention.ts); null while a plan is live. */
    deletionDate: access.live ? null : syndicateDeletionDate(plan),
    status: plan.stripeSubscriptionStatus,
    planTier: plan.planTier,
    isActive: access.live,
    /** Why it isn't active, when it isn't: 'dispute' | 'overdue' | 'lapsed'. */
    reason: access.reason,
    currentPeriodEnd: plan.subscriptionCurrentPeriodEnd,
    /** While a failed card is being retried: the day the syndicate becomes read-only. */
    readOnlyFrom: access.readOnlyFrom,
  }
}

/** The clock the app was given (tests fix it); real time otherwise. */
export function nowOf(req: Request): Date {
  const clock = req.app?.locals?.now as (() => Date) | undefined
  return clock ? clock() : new Date()
}


export interface AccessOptions {
  /**
   * Let this write through while the plan isn't paid up. Only for the ways back to a paid
   * plan (choosing one, the billing portal) and archiving, which needs the plan to have ended.
   */
  allowLapsed?: boolean
}

/** What a captain is told when a write is refused because the plan has lapsed. */
export const LAPSED_CAPTAIN_MESSAGE =
  'This syndicate is read-only until its plan is active. Choose a plan, or update your payment details, in Settings. Everything you have recorded is still here.'
const LAPSED_MEMBER_MESSAGE = 'This syndicate is read-only until its captain renews the plan.'
export const OVERDUE_CAPTAIN_MESSAGE =
  'The payment for this syndicate is more than two weeks overdue, so it is read-only. Update your card under Settings and everything opens up again.'
export const DISPUTED_CAPTAIN_MESSAGE =
  `A payment for this syndicate has been disputed with the card issuer, so it is read-only until that is settled and a payment has arrived. Email ${SUPPORT_EMAIL} if this is unexpected.`
const PLAN_MESSAGES: Record<'captain' | 'member', Record<NonNullable<PlanAccess['reason']>, string>> = {
  captain: { lapsed: LAPSED_CAPTAIN_MESSAGE, overdue: OVERDUE_CAPTAIN_MESSAGE, dispute: DISPUTED_CAPTAIN_MESSAGE },
  member: { lapsed: LAPSED_MEMBER_MESSAGE, overdue: LAPSED_MEMBER_MESSAGE, dispute: LAPSED_MEMBER_MESSAGE },
}

/**
 * Who may act on a syndicate, and whether they may change anything.
 *
 * Captain: the syndicate's captain only.
 * Member: the captain, or an ACTIVE gun (role CAPTAIN, GUN or HYBRID) whose Clerk ID matches the caller.
 * An archived syndicate is gone from the app for everyone: same 404 as one that never existed.
 *
 * Reads (GET) are always allowed to someone with access, so a lapsed captain keeps every record
 * and export. Any other method is a change, and is refused with 402 unless the plan is paid up.
 * The decision is taken from the request itself, so a new route is read-only-when-lapsed by default.
 */
export async function requireSyndicateAccess(
  prisma: PrismaClient,
  syndicateId: string | null | undefined,
  req: Request,
  level: AccessLevel,
  options: AccessOptions = {}
): Promise<SyndicateAccess> {
  const userId = userIdOf(req)
  if (!syndicateId || typeof syndicateId !== 'string') throw notFound()

  const syndicate = await prisma.syndicate.findUnique({
    where: { id: syndicateId },
    select: { id: true, captainClerkId: true, status: true, stripeSubscriptionStatus: true, subscriptionCurrentPeriodEnd: true, disputeOpenedAt: true, pastDueSince: true },
  })
  if (!syndicate || syndicate.status !== 'ACTIVE') throw notFound()

  const member = await prisma.member.findFirst({
    where: { syndicateId, clerkUserId: userId, status: 'ACTIVE', role: { in: [...GUN_ROLES] } },
    select: { id: true },
  })

  const isCaptain = syndicate.captainClerkId === userId
  if (!isCaptain && !(level === 'member' && member)) throw notFound()

  const isWrite = req.method !== 'GET' && req.method !== 'HEAD'
  if (isWrite && !options.allowLapsed) {
    const plan = planAccess(syndicate, nowOf(req))
    if (!plan.live && plan.reason) throw new HttpError(402, PLAN_MESSAGES[isCaptain ? 'captain' : 'member'][plan.reason])
  }

  noteAuditContext(req.res, { syndicateId, actorUserId: userId, actorMemberId: member?.id ?? null, actorRole: isCaptain ? 'captain' : 'gun' })
  return { syndicateId, isCaptain, memberId: member?.id ?? null }
}

// ---------------------------------------------------------------------------
// Resolve a child record to the syndicate it belongs to
// ---------------------------------------------------------------------------

export async function syndicateOfShoot(prisma: PrismaClient, shootId: unknown): Promise<string> {
  if (typeof shootId !== 'string' || !shootId) throw notFound()
  const row = await prisma.shootDay.findUnique({ where: { id: shootId }, select: { syndicateId: true } })
  if (!row) throw notFound()
  return row.syndicateId
}

export async function syndicateOfBeater(prisma: PrismaClient, beaterId: unknown): Promise<string> {
  if (typeof beaterId !== 'string' || !beaterId) throw notFound()
  const row = await prisma.beater.findUnique({ where: { id: beaterId }, select: { syndicateId: true } })
  if (!row) throw notFound()
  return row.syndicateId
}

export async function syndicateOfMember(prisma: PrismaClient, memberId: unknown): Promise<string> {
  if (typeof memberId !== 'string' || !memberId) throw notFound()
  const row = await prisma.member.findUnique({ where: { id: memberId }, select: { syndicateId: true } })
  if (!row) throw notFound()
  return row.syndicateId
}

export async function syndicateOfGuest(prisma: PrismaClient, guestId: unknown): Promise<string> {
  if (typeof guestId !== 'string' || !guestId) throw notFound()
  const row = await prisma.guestGun.findUnique({
    where: { id: guestId },
    select: { shootDay: { select: { syndicateId: true } } },
  })
  if (!row) throw notFound()
  return row.shootDay.syndicateId
}

export async function syndicateOfBag(prisma: PrismaClient, bagId: unknown): Promise<string> {
  if (typeof bagId !== 'string' || !bagId) throw notFound()
  const row = await prisma.bagRecord.findUnique({
    where: { id: bagId },
    select: { shootDay: { select: { syndicateId: true } } },
  })
  if (!row) throw notFound()
  return row.shootDay.syndicateId
}

// ---------------------------------------------------------------------------
// Response shaping: never send the browser more than it needs (§07.7)
// ---------------------------------------------------------------------------

/** Syndicate fields safe to send to the browser. Stripe customer/subscription IDs stay server-side. */
export const syndicateSelect = {
  id: true,
  name: true,
  captainClerkId: true,
  seasonStart: true,
  seasonEnd: true,
  subscriptionAmount: true,
  subscriptionType: true,
  stripeSubscriptionStatus: true,
  subscriptionCurrentPeriodEnd: true,
  planTier: true,
  defaultBeaterRate: true,
  pegRotationRule: true,
  waiverExtra: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SyndicateSelect

interface BankFields {
  bankName: string | null
  bankSortCode: string | null
  bankAccountNumber: string | null
  bankDetailsSealed: string | null
  bankAccountLast4: string | null
}

/**
 * A beater as the browser sees them: whether bank details are on file and the last four digits,
 * never the numbers. The numbers leave the server only through the two recorded routes that
 * need them (one beater shown, or the export for paying), server/routes/beaters.ts.
 */
export function maskBankDetails<T extends BankFields>(beater: T) {
  const { bankSortCode, bankAccountNumber, bankDetailsSealed, bankAccountLast4, ...rest } = beater
  return {
    ...rest,
    bankDetailsOnFile: Boolean(bankDetailsSealed || (bankSortCode && bankAccountNumber)),
    bankAccountLast4: bankAccountLast4 ?? (bankAccountNumber ? bankAccountNumber.replace(/\D/g, '').slice(-4) : null),
  }
}

/** Strip the captain's private notes from a shoot day before a gun sees it. */
export function withoutCaptainOnlyFields<T extends { captainNotes: string | null; weatherNotes: string | null }>(shoot: T) {
  const { captainNotes: _notes, weatherNotes: _weather, ...rest } = shoot
  return rest
}

/** Accepts only plain string IDs from query strings. */
export function queryString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
