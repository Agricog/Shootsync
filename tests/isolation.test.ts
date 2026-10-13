/**
 * Cross-account isolation (Standard §07.5).
 *
 * Every protected endpoint is called on syndicate A's data by:
 *   - captain B (another customer)   → must get 404 and change nothing
 *   - a signed-in stranger           → must get 404 and change nothing
 *   - A's own gun (a member)         → 404 on captain-only endpoints, success on member endpoints
 *   - A's member with the BEATER role → 404 everywhere (beaters are not guns)
 *   - captain A                      → success
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import {
  BEATER_ROLE_A,
  CAPTAIN_A,
  CAPTAIN_B,
  GUN_A,
  STRANGER,
  call,
  createTestPrisma,
  createTestStripe,
  resetDatabase,
  seed,
  startTestServer,
  type TestServer,
} from './helpers.js'

type Seeded = Awaited<ReturnType<typeof seed>>
type Side = Seeded['a']

interface Case {
  name: string
  method: string
  path: (x: Side) => string
  body?: (x: Side) => unknown
  level: 'captain' | 'member'
}

const CASES: Case[] = [
  // Syndicates
  { name: 'read syndicate', method: 'GET', path: (x) => `/api/syndicates/${x.syndicate.id}`, level: 'member' },
  { name: 'update syndicate', method: 'PATCH', path: (x) => `/api/syndicates/${x.syndicate.id}`, body: () => ({ name: 'Renamed' }), level: 'captain' },
  { name: 'archive syndicate', method: 'DELETE', path: (x) => `/api/syndicates/${x.syndicate.id}`, level: 'captain' },
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
  { name: 'read beater', method: 'GET', path: (x) => `/api/beaters/${x.beater.id}`, level: 'captain' },
  { name: 'add beater', method: 'POST', path: () => '/api/beaters', body: (x) => ({ syndicateId: x.syndicate.id, name: 'New Beater' }), level: 'captain' },
  { name: 'update beater', method: 'PATCH', path: (x) => `/api/beaters/${x.beater.id}`, body: () => ({ bankAccountNumber: '99999999' }), level: 'captain' },
  { name: 'deactivate beater', method: 'DELETE', path: (x) => `/api/beaters/${x.beater.id}`, level: 'captain' },
  { name: 'book beater', method: 'POST', path: (x) => `/api/beaters/${x.beater.id}/book`, body: (x) => ({ shootId: x.shoot.id }), level: 'captain' },
  { name: 'pay beater', method: 'POST', path: (x) => `/api/beaters/${x.beater.id}/pay`, body: (x) => ({ paymentIds: [x.payment.id], paymentReference: 'REF' }), level: 'captain' },
  { name: 'pay beater in full', method: 'POST', path: (x) => `/api/beaters/pay-all/${x.beater.id}`, body: () => ({ paymentReference: 'REF' }), level: 'captain' },
  // Shoots
  { name: 'list shoots', method: 'GET', path: (x) => `/api/shoots?syndicateId=${x.syndicate.id}`, level: 'member' },
  { name: 'read shoot sheet', method: 'GET', path: (x) => `/api/shoots/${x.shoot.id}`, level: 'captain' },
  { name: 'create shoot', method: 'POST', path: () => '/api/shoots', body: (x) => ({ syndicateId: x.syndicate.id, date: '2026-12-05', locationName: 'New Wood' }), level: 'captain' },
  { name: 'update shoot', method: 'PATCH', path: (x) => `/api/shoots/${x.shoot.id}`, body: () => ({ locationName: 'Moved' }), level: 'captain' },
  { name: 'complete shoot', method: 'POST', path: (x) => `/api/shoots/${x.shoot.id}/complete`, level: 'captain' },
  { name: 'cancel shoot', method: 'POST', path: (x) => `/api/shoots/${x.shoot.id}/cancel`, level: 'captain' },
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
  { name: 'remove guest', method: 'DELETE', path: (x) => `/api/guests/${x.guest.id}`, level: 'captain' },
  // Subscriptions
  { name: 'start plan checkout', method: 'POST', path: () => '/api/subscriptions/create-checkout', body: (x) => ({ syndicateId: x.syndicate.id, planTier: 'STANDARD', email: 'a@example.com' }), level: 'captain' },
  { name: 'open billing portal', method: 'POST', path: () => '/api/subscriptions/portal', body: (x) => ({ syndicateId: x.syndicate.id }), level: 'captain' },
  { name: 'subscription status', method: 'GET', path: (x) => `/api/subscriptions/status/${x.syndicate.id}`, level: 'member' },
]

/** Every row in the database, so a refused request can be proven to have changed nothing. */
async function snapshot(prisma: PrismaClient) {
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

describe('cross-account isolation', () => {
  let prisma: PrismaClient
  let server: TestServer
  let data: Seeded

  before(async () => {
    prisma = createTestPrisma()
    const { stripe } = createTestStripe()
    server = await startTestServer(prisma, stripe)
  })

  after(async () => {
    await server.close()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await resetDatabase(prisma)
    data = await seed(prisma)
  })

  for (const testCase of CASES) {
    const request = (as: string, side: Side) =>
      call(server, testCase.path(side), {
        method: testCase.method,
        as,
        body: testCase.body ? testCase.body(side) : undefined,
      })

    it(`${testCase.name}: another captain gets 404 and changes nothing`, async () => {
      const before = await snapshot(prisma)
      const res = await request(CAPTAIN_B, data.a)
      assert.equal(res.status, 404, JSON.stringify(res.json))
      assert.equal(await snapshot(prisma), before)
    })

    it(`${testCase.name}: a signed-in stranger gets 404 and changes nothing`, async () => {
      const before = await snapshot(prisma)
      const res = await request(STRANGER, data.a)
      assert.equal(res.status, 404, JSON.stringify(res.json))
      assert.equal(await snapshot(prisma), before)
    })

    it(`${testCase.name}: the syndicate's own gun ${testCase.level === 'member' ? 'is allowed' : 'gets 404'}`, async () => {
      const before = await snapshot(prisma)
      const res = await request(GUN_A, data.a)
      if (testCase.level === 'member') {
        assert.ok(res.status >= 200 && res.status < 300, `expected success, got ${res.status} ${JSON.stringify(res.json)}`)
      } else {
        assert.equal(res.status, 404, JSON.stringify(res.json))
        assert.equal(await snapshot(prisma), before)
      }
    })

    it(`${testCase.name}: a member with the beater role gets 404 and changes nothing`, async () => {
      const before = await snapshot(prisma)
      const res = await request(BEATER_ROLE_A, data.a)
      assert.equal(res.status, 404, JSON.stringify(res.json))
      assert.equal(await snapshot(prisma), before)
    })

    it(`${testCase.name}: the captain is allowed`, async () => {
      const res = await request(CAPTAIN_A, data.a)
      assert.ok(res.status >= 200 && res.status < 300, `expected success, got ${res.status} ${JSON.stringify(res.json)}`)
    })
  }

  describe('records from another syndicate cannot be linked in', () => {
    it("captain A cannot book their beater onto B's shoot", async () => {
      const res = await call(server, `/api/beaters/${data.a.beater.id}/book`, {
        method: 'POST', as: CAPTAIN_A, body: { shootId: data.b.shoot.id },
      })
      assert.equal(res.status, 400)
      assert.equal(await prisma.beaterBooking.count(), 0)
    })

    it("captain A cannot save B's member onto their peg list", async () => {
      const before = await prisma.shootAttendance.count()
      const res = await call(server, `/api/shoots/${data.a.shoot.id}/pegs`, {
        method: 'PUT', as: CAPTAIN_A, body: { allocations: [{ memberId: data.b.gun.id, pegNumber: 1 }] },
      })
      assert.equal(res.status, 400)
      assert.equal(await prisma.shootAttendance.count(), before)
    })

    it("captain A cannot invite a guest in the name of B's member", async () => {
      const res = await call(server, '/api/guests', {
        method: 'POST', as: CAPTAIN_A,
        body: { shootId: data.a.shoot.id, invitedByMemberId: data.b.gun.id, name: 'X', email: 'x@example.com' },
      })
      assert.equal(res.status, 400)
    })

    it('a gun cannot invite a guest in another member\'s name', async () => {
      const res = await call(server, '/api/guests', {
        method: 'POST', as: GUN_A,
        body: { shootId: data.a.shoot.id, invitedByMemberId: data.a.captainMember.id, name: 'X', email: 'x@example.com' },
      })
      assert.equal(res.status, 404)
    })

    it("captain A cannot mark B's beater payment as paid through their own beater", async () => {
      await call(server, `/api/beaters/${data.a.beater.id}/pay`, {
        method: 'POST', as: CAPTAIN_A, body: { paymentIds: [data.b.payment.id] },
      })
      const payment = await prisma.beaterPayment.findUnique({ where: { id: data.b.payment.id } })
      assert.equal(payment?.status, 'PENDING')
    })

    it('a gun can only check themselves in', async () => {
      const res = await call(server, `/api/shoots/${data.a.shoot.id}/checkin`, {
        method: 'POST', as: GUN_A, body: { memberId: data.a.captainMember.id },
      })
      assert.equal(res.status, 404)
    })
  })
})
