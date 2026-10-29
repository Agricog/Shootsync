/**
 * Plan limits - ShootSync
 *
 * Each plan covers a number of active guns and active beaters (server/plans.ts). Adding or
 * reactivating one past the limit is refused with a sentence saying what to do. Lowering a
 * plan never removes anyone: a syndicate over its new limit keeps everyone, and simply can't
 * add more until it is back under.
 *
 * The count and the change happen inside one transaction holding the syndicate's row lock, so
 * two additions at the same moment can't both squeeze into the last place. Callers that read a
 * record to decide whether a check is needed take the lock first (lockSyndicate), then read.
 */

import type { Prisma } from '@prisma/client'
import { HttpError, GUN_ROLES } from './access.js'
import { PLAN_LIMITS, type PlanTierKey } from './plans.js'

type Tx = Prisma.TransactionClient
export type LimitedKind = 'guns' | 'beaters'

const PLAN_NAMES: Record<PlanTierKey, string> = { STARTER: 'Starter', STANDARD: 'Standard' }

/**
 * Locks the syndicate row against other plan-limit checks for the rest of the transaction.
 * FOR NO KEY UPDATE, not FOR UPDATE: two checks still queue behind each other, but ordinary
 * inserts that point at the syndicate (shoot days, bookings, pay) don't have to wait.
 */
export async function lockSyndicate(tx: Tx, syndicateId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM syndicates WHERE id = ${syndicateId} FOR NO KEY UPDATE`
}

export function limitMessage(tier: PlanTierKey, kind: LimitedKind, limit: number): string {
  const what = kind === 'guns' ? 'active guns' : 'active beaters'
  const way = kind === 'guns' ? 'Make a member inactive' : 'Make a beater inactive'
  const upgrade = tier === 'STARTER' ? ' or move to the Standard plan under Settings, Manage billing' : ''
  return `Your ${PLAN_NAMES[tier]} plan covers up to ${limit} ${what}. ${way}${upgrade}, then try again.`
}

/**
 * Refuses, inside `tx`, if the syndicate already has as many active guns (or beaters) as its plan
 * covers. Call it before the write that would add one, in the same transaction.
 */
export async function assertRoomFor(tx: Tx, syndicateId: string, kind: LimitedKind): Promise<void> {
  await lockSyndicate(tx, syndicateId)
  const { planTier } = await tx.syndicate.findUniqueOrThrow({ where: { id: syndicateId }, select: { planTier: true } })
  // A live plan always has a tier (the webhook sets it from the price). If one ever doesn't,
  // hold it to the smallest plan rather than to none.
  const tier: PlanTierKey = planTier ?? 'STARTER'
  const limit = PLAN_LIMITS[tier][kind]
  if (limit === null) return
  const active =
    kind === 'guns'
      ? await tx.member.count({ where: { syndicateId, status: 'ACTIVE', role: { in: [...GUN_ROLES] } } })
      : await tx.beater.count({ where: { syndicateId, status: 'ACTIVE' } })
  if (active >= limit) throw new HttpError(409, limitMessage(tier, kind, limit))
}
