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
    return res.status(400).json({ error: 'Validation failed', details: err.errors })
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
const GUN_ROLES = ['CAPTAIN', 'GUN', 'HYBRID'] as const

/**
 * Captain: the syndicate's captain only.
 * Member: the captain, or an ACTIVE gun (role CAPTAIN, GUN or HYBRID) whose Clerk ID matches the caller.
 */
export async function requireSyndicateAccess(
  prisma: PrismaClient,
  syndicateId: string | null | undefined,
  userId: string,
  level: AccessLevel
): Promise<SyndicateAccess> {
  if (!syndicateId || typeof syndicateId !== 'string') throw notFound()

  const syndicate = await prisma.syndicate.findUnique({
    where: { id: syndicateId },
    select: { id: true, captainClerkId: true },
  })
  if (!syndicate) throw notFound()

  const member = await prisma.member.findFirst({
    where: { syndicateId, clerkUserId: userId, status: 'ACTIVE', role: { in: [...GUN_ROLES] } },
    select: { id: true },
  })

  const isCaptain = syndicate.captainClerkId === userId
  if (isCaptain) {
    return { syndicateId, isCaptain, memberId: member?.id ?? null }
  }
  if (level === 'member' && member) {
    return { syndicateId, isCaptain, memberId: member.id }
  }
  throw notFound()
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
