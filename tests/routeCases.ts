/**
 * Every signed-in API route, called on syndicate A's own data, with what it needs.
 * Shared by the cross-account matrix (tests/isolation.test.ts) and the lapsed-plan matrix
 * (tests/lapsed.test.ts). tests/isolation.test.ts fails if a signed-in route is missing here.
 */

import type { PrismaClient } from '@prisma/client'
import type { seed } from './helpers.js'

type Seeded = Awaited<ReturnType<typeof seed>>
export type Side = Seeded['a']

export interface Case {
  name: string
  method: string
  path: (x: Side) => string
  body?: (x: Side) => unknown
  level: 'captain' | 'member'
  /**
   * State the route needs to succeed for a paid-up captain, set before each call in the
   * cross-account matrix. The lapsed matrix sets each unpaid state itself instead.
   */
  prepare?: (prisma: PrismaClient, x: Side) => Promise<unknown>
  /**
   * Open to a syndicate without a paid-up plan: the ways back to a paid plan, and archiving
   * (which needs the plan to have ended). Lists the unpaid states in which it should succeed;
   * in the others it may refuse for its own reasons, but never with the lapsed-plan 402.
   */
  allowLapsed?: ReadonlyArray<string | null>
}

const planEnded = (prisma: PrismaClient, x: Side) =>
  prisma.syndicate.update({ where: { id: x.syndicate.id }, data: { stripeSubscriptionStatus: 'CANCELLED' } })

export const CASES: Case[] = [
  // Syndicates
  { name: 'read syndicate', method: 'GET', path: (x) => `/api/syndicates/${x.syndicate.id}`, level: 'member' },
  { name: 'update syndicate', method: 'PATCH', path: (x) => `/api/syndicates/${x.syndicate.id}`, body: () => ({ name: 'Renamed' }), level: 'captain' },
  { name: 'archive syndicate', method: 'DELETE', path: (x) => `/api/syndicates/${x.syndicate.id}`, level: 'captain', prepare: planEnded, allowLapsed: [null, 'CANCELLED'] },
  // Members
  { name: 'list members', method: 'GET', path: (x) => `/api/members?syndicateId=${x.syndicate.id}`, level: 'captain' },
  { name: 'read member', method: 'GET', path: (x) => `/api/members/${x.gun.id}`, level: 'captain' },
  { name: 'invite member', method: 'POST', path: () => '/api/members', body: (x) => ({ syndicateId: x.syndicate.id, email: 'new@example.com', name: 'New Gun' }), level: 'captain' },
  { name: 'update member', method: 'PATCH', path: (x) => `/api/members/${x.gun.id}`, body: () => ({ name: 'Renamed' }), level: 'captain' },
  { name: 'change member status', method: 'PATCH', path: (x) => `/api/members/${x.gun.id}/status`, body: () => ({ status: 'INACTIVE' }), level: 'captain' },
  { name: 'remove member', method: 'DELETE', path: (x) => `/api/members/${x.gun.id}`, level: 'captain' },
  // Beaters
  { name: 'list beaters', method: 'GET', path: (x) => `/api/beaters?syndicateId=${x.syndicate.id}`, level: 'captain' },
  { name: 'beater payments summary', method: 'GET', path: (x) => `/api/beaters/payments/summary?syndicateId=${x.syndicate.id}`, level: 'captain' },
  { name: 'beaters owed total', method: 'GET', path: (x) => `/api/beaters/payments/owed?syndicateId=${x.syndicate.id}`, level: 'captain' },
  { name: 'read beater', method: 'GET', path: (x) => `/api/beaters/${x.beater.id}`, level: 'captain' },
  { name: 'add beater', method: 'POST', path: () => '/api/beaters', body: (x) => ({ syndicateId: x.syndicate.id, name: 'New Beater' }), level: 'captain' },
  { name: 'update beater', method: 'PATCH', path: (x) => `/api/beaters/${x.beater.id}`, body: () => ({ bankSortCode: '99-99-99', bankAccountNumber: '99999999' }), level: 'captain' },
  { name: 'deactivate beater', method: 'DELETE', path: (x) => `/api/beaters/${x.beater.id}`, level: 'captain' },
  { name: 'pay beater', method: 'POST', path: (x) => `/api/beaters/${x.beater.id}/pay`, body: (x) => ({ payments: [{ paymentId: x.payment.id, amount: 4000 }], paymentReference: 'REF' }), level: 'captain' },
  // Shoots
  { name: 'list shoots', method: 'GET', path: (x) => `/api/shoots?syndicateId=${x.syndicate.id}`, level: 'member' },
  { name: 'read shoot sheet', method: 'GET', path: (x) => `/api/shoots/${x.shoot.id}`, level: 'captain' },
  { name: 'create shoot', method: 'POST', path: () => '/api/shoots', body: (x) => ({ syndicateId: x.syndicate.id, date: '2026-12-05', locationName: 'New Wood' }), level: 'captain' },
  { name: 'update shoot', method: 'PATCH', path: (x) => `/api/shoots/${x.shoot.id}`, body: () => ({ locationName: 'Moved' }), level: 'captain' },
  { name: 'complete shoot', method: 'POST', path: (x) => `/api/shoots/${x.shoot.id}/complete`, level: 'captain' },
  { name: 'cancel shoot', method: 'POST', path: (x) => `/api/shoots/${x.shoot.id}/cancel`, level: 'captain' },
  { name: 'book beaters onto a day', method: 'POST', path: (x) => `/api/shoots/${x.shoot.id}/beaters`, body: (x) => ({ beaterIds: [x.beater.id] }), level: 'captain' },
  { name: 'change a beater booking', method: 'PATCH', path: (x) => `/api/shoots/${x.shoot.id}/beaters/${x.booking.id}`, body: () => ({ status: 'NO_SHOW' }), level: 'captain' },
  { name: 'remove a beater booking', method: 'DELETE', path: (x) => `/api/shoots/${x.shoot.id}/beaters/${x.booking.id}`, level: 'captain' },
  { name: 'read peg sheet', method: 'GET', path: (x) => `/api/shoots/${x.shoot.id}/pegs`, level: 'captain' },
  { name: 'draw pegs', method: 'POST', path: (x) => `/api/shoots/${x.shoot.id}/pegs/draw`, body: (x) => ({ method: 'fair', numberOfPegs: 4, memberIds: [x.gun.id, x.captainMember.id] }), level: 'captain' },
  { name: 'save pegs', method: 'PUT', path: (x) => `/api/shoots/${x.shoot.id}/pegs`, body: (x) => ({ allocations: [{ memberId: x.gun.id, pegNumber: 2 }] }), level: 'captain' },
  { name: 'check in', method: 'POST', path: (x) => `/api/shoots/${x.shoot.id}/checkin`, body: (x) => ({ memberId: x.gun.id }), level: 'member' },
  { name: 'delete shoot', method: 'DELETE', path: (x) => `/api/shoots/${x.shoot.id}`, level: 'captain' },
  // Bags
  { name: 'list bags', method: 'GET', path: (x) => `/api/bags?shootId=${x.shoot.id}`, level: 'member' },
  { name: 'season bag', method: 'GET', path: (x) => `/api/bags/season?syndicateId=${x.syndicate.id}`, level: 'member' },
  { name: 'read bag', method: 'GET', path: (x) => `/api/bags/${x.bag.id}`, level: 'member' },
  { name: 'record bag', method: 'POST', path: () => '/api/bags', body: (x) => ({ shootId: x.shoot.id, driveNumber: 2, pheasant: 7 }), level: 'member' },
  { name: 'update bag', method: 'PATCH', path: (x) => `/api/bags/${x.bag.id}`, body: () => ({ pheasant: 99 }), level: 'member' },
  { name: 'delete bag', method: 'DELETE', path: (x) => `/api/bags/${x.bag.id}`, level: 'captain' },
  // Guests
  { name: 'list guests by shoot', method: 'GET', path: (x) => `/api/guests?shootId=${x.shoot.id}`, level: 'captain' },
  { name: 'list guests by syndicate', method: 'GET', path: (x) => `/api/guests?syndicateId=${x.syndicate.id}`, level: 'captain' },
  { name: 'read guest', method: 'GET', path: (x) => `/api/guests/${x.guest.id}`, level: 'captain' },
  { name: 'invite guest', method: 'POST', path: () => '/api/guests', body: (x) => ({ shootId: x.shoot.id, invitedByMemberId: x.gun.id, name: 'Guest Two', email: 'g2@example.com' }), level: 'member' },
  { name: 'update guest', method: 'PATCH', path: (x) => `/api/guests/${x.guest.id}`, body: () => ({ pegNumber: 8 }), level: 'captain' },
  { name: 'mark guest paid', method: 'PATCH', path: (x) => `/api/guests/${x.guest.id}/payment`, body: () => ({ paid: true }), level: 'captain' },
  { name: 'remove guest', method: 'DELETE', path: (x) => `/api/guests/${x.guest.id}`, level: 'captain' },
  // Subscriptions
  { name: 'start plan checkout', method: 'POST', path: () => '/api/subscriptions/create-checkout', body: (x) => ({ syndicateId: x.syndicate.id, planTier: 'STANDARD', email: 'a@example.com' }), level: 'captain', prepare: planEnded, allowLapsed: [null, 'CANCELLED'] },
  { name: 'open billing portal', method: 'POST', path: () => '/api/subscriptions/portal', body: (x) => ({ syndicateId: x.syndicate.id }), level: 'captain', allowLapsed: [null, 'INCOMPLETE', 'UNPAID', 'CANCELLED'] },
  { name: 'subscription status', method: 'GET', path: (x) => `/api/subscriptions/status/${x.syndicate.id}`, level: 'member' },
]

/**
 * Routes that act only on the caller's own account, so there is no other syndicate's data to
 * reach through them. Each has its own tests. Everything else must be in CASES above.
 */
export const SELF_SCOPED = [
  'GET /api/me',
  'GET /api/syndicates', // the syndicates the caller captains
  'POST /api/syndicates', // the caller becomes captain of a new one
]

/** Every row in the database, so a refused request can be proven to have changed nothing. */
export async function snapshot(prisma: PrismaClient) {
  const [syndicates, members, beaters, shoots, attendances, bags, payments, bookings, guests] = await Promise.all([
    prisma.syndicate.findMany({ orderBy: { id: 'asc' } }),
    prisma.member.findMany({ orderBy: { id: 'asc' } }),
    prisma.beater.findMany({ orderBy: { id: 'asc' } }),
    prisma.shootDay.findMany({ orderBy: { id: 'asc' } }),
    prisma.shootAttendance.findMany({ orderBy: { id: 'asc' } }),
    prisma.bagRecord.findMany({ orderBy: { id: 'asc' } }),
    prisma.beaterPayment.findMany({ orderBy: { id: 'asc' } }),
    prisma.beaterBooking.findMany({ orderBy: { id: 'asc' } }),
    prisma.guestGun.findMany({ orderBy: { id: 'asc' } }),
  ])
  return JSON.stringify({ syndicates, members, beaters, shoots, attendances, bags, payments, bookings, guests })
}
