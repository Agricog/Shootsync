/**
 * Who am I - ShootSync
 *
 * GET /api/me: every syndicate the signed-in user belongs to, and in what role.
 * The browser builds its navigation and picks the syndicate it shows from this one
 * answer, so the role a page assumes is always the role the server will enforce.
 *
 * Only the caller's own memberships are listed, and only what the app shell needs:
 * no Stripe IDs, no other people.
 */

import { Router } from 'express'
import type { Deps } from '../deps.js'
import { GUN_ROLES, handle, planSummary, userIdOf } from '../access.js'

export type MembershipRole = 'CAPTAIN' | 'GUN'

const syndicateFields = {
  id: true,
  name: true,
  seasonStart: true,
  seasonEnd: true,
  stripeSubscriptionStatus: true,
  planTier: true,
  subscriptionCurrentPeriodEnd: true,
  disputeOpenedAt: true,
  pastDueSince: true,
  defaultBeaterRate: true,
  pegRotationRule: true,
} as const

export function meRoutes({ prisma, now }: Deps): Router {
  const router = Router()

  router.get('/', handle(async (req, res) => {
    const userId = userIdOf(req)

    const [captained, memberships] = await Promise.all([
      prisma.syndicate.findMany({
        where: { captainClerkId: userId, status: 'ACTIVE' },
        select: {
          ...syndicateFields,
          // The captain's own place on the gun list, if they shoot: guests they invite are theirs.
          members: { where: { clerkUserId: userId, status: 'ACTIVE' }, select: { id: true }, take: 1 },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.member.findMany({
        where: {
          clerkUserId: userId,
          status: 'ACTIVE',
          role: { in: [...GUN_ROLES] },
          syndicate: { status: 'ACTIVE', captainClerkId: { not: userId } },
        },
        select: { id: true, syndicate: { select: syndicateFields } },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    type SyndicateRow = Omit<(typeof captained)[number], 'members'>
    const shape = (s: SyndicateRow, role: MembershipRole, memberId: string | null) => ({
      id: s.id,
      name: s.name,
      role,
      memberId,
      seasonStart: s.seasonStart,
      seasonEnd: s.seasonEnd,
      defaultBeaterRate: s.defaultBeaterRate,
      pegRotationRule: s.pegRotationRule,
      subscription: planSummary(s, now()),
    })

    res.json({
      syndicates: [
        ...captained.map(({ members, ...s }) => shape(s, 'CAPTAIN', members[0]?.id ?? null)),
        ...memberships.map((m) => shape(m.syndicate, 'GUN', m.id)),
      ],
    })
  }))

  return router
}
