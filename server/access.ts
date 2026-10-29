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

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'HttpError'
  }
}

export const notFound = (what = 'Not found') => new HttpError(404, what)

/** Wraps an async handler so thrown errors reach one place and get a uniform response. */
export function handle(
  fn: (req: Request, res: Response) => Promise<unknown>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next)
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
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' })
    if (err.code === 'P2002') return res.status(409).json({ error: 'Already exists' })
  }
  if (err instanceof SyntaxError && 'body' in (err as object)) {
    return res.status(400).json({ error: 'Invalid JSON' })
  }
  console.error(`[api] ${req.method} ${req.path} failed:`, err)
  return res.status(500).json({ error: 'Internal server error' })
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

export function isLiveSubscription(status: string | null | undefined): boolean {
  return status != null && LIVE_SUBSCRIPTION_STATES.has(status)
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
    select: { id: true, captainClerkId: true, status: true, stripeSubscriptionStatus: true },
  })
  if (!syndicate || syndicate.status !== 'ACTIVE') throw notFound()

  const member = await prisma.member.findFirst({
    where: { syndicateId, clerkUserId: userId, status: 'ACTIVE', role: { in: [...GUN_ROLES] } },
    select: { id: true },
  })

  const isCaptain = syndicate.captainClerkId === userId
  if (!isCaptain && !(level === 'member' && member)) throw notFound()

  const isWrite = req.method !== 'GET' && req.method !== 'HEAD'
  if (isWrite && !options.allowLapsed && !isLiveSubscription(syndicate.stripeSubscriptionStatus)) {
    throw new HttpError(402, isCaptain ? LAPSED_CAPTAIN_MESSAGE : LAPSED_MEMBER_MESSAGE)
  }

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
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SyndicateSelect

interface BankFields {
  bankName: string | null
  bankSortCode: string | null
  bankAccountNumber: string | null
}

/**
 * Replace full bank details with a masked summary. Full details are only
 * returned by the captain-only payments summary, where they are needed to pay.
 */
export function maskBankDetails<T extends BankFields>(beater: T) {
  const { bankSortCode, bankAccountNumber, ...rest } = beater
  return {
    ...rest,
    bankDetailsOnFile: Boolean(bankSortCode && bankAccountNumber),
    bankAccountLast4: bankAccountNumber ? bankAccountNumber.replace(/\s/g, '').slice(-4) : null,
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
