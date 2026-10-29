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
import { PUBLIC_ROUTES } from '../server/auth.js'
import {
  BEATER_ROLE_A,
  CAPTAIN_A,
  CAPTAIN_B,
  GUN_A,
  STRANGER,
  call,
  concrete,
  createTestPrisma,
  registeredRoutes,
  createTestStripe,
  resetDatabase,
  seed,
  startTestServer,
  type TestServer,
} from './helpers.js'
import { CASES, SELF_SCOPED, snapshot } from './routeCases.js'

type Seeded = Awaited<ReturnType<typeof seed>>
type Side = Seeded['a']


/** "/api/shoots/:id/beaters/:bookingId" -> a pattern matching any concrete path of that shape. */
const routePattern = (path: string) => new RegExp(`^${path.replace(/\/$/, '').replace(/:[A-Za-z]+/g, '[^/?]+')}(\\?.*)?$`)

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

  it('every signed-in route is in the matrix, or acts only on the caller’s own account', async () => {
    const { stripe } = createTestStripe()
    const routes = registeredRoutes(prisma, stripe)
    assert.ok(routes.length >= 50, `only found ${routes.length} routes`)
    // Which route each case actually reaches: the most specific one that matches it, as Express
    // does ("/api/bags/season" is the season route, not "/api/bags/:id" with id "season").
    const params = (path: string) => (path.match(/:/g) ?? []).length
    const reached = new Set(
      CASES.map((c) => {
        const target = routes
          .filter((r) => r.method === c.method && routePattern(r.path).test(c.path(data.a)))
          .sort((x, y) => params(x.path) - params(y.path))[0]
        return target ? `${target.method} ${target.path.replace(/\/$/, '')}` : `none: ${c.name}`
      })
    )
    assert.deepEqual([...reached].filter((r) => r.startsWith('none')), [])

    const missing: string[] = []
    for (const route of routes) {
      const path = route.path.replace(/\/$/, '')
      // A public route's parameters have a fixed shape (a 64-hex token, a Stripe session ID).
      const sample = path.replace(':token', 'a'.repeat(64)).replace(':sessionId', 'cs_test_abcdefghijkl')
      const isPublic = PUBLIC_ROUTES.some((p) => p.method === route.method && p.path.test(concrete(sample).replace(/^\/api/, '')))
      if (isPublic) continue
      if (SELF_SCOPED.includes(`${route.method} ${path}`)) continue
      if (!reached.has(`${route.method} ${path}`)) missing.push(`${route.method} ${path}`)
    }
    assert.deepEqual(missing, [])
  })

  it('the self-scoped list names only routes that exist', () => {
    const { stripe } = createTestStripe()
    const routes = registeredRoutes(prisma, stripe).map((r) => `${r.method} ${r.path.replace(/\/$/, '')}`)
    for (const entry of SELF_SCOPED) assert.ok(routes.includes(entry), `${entry} is not a route`)
  })

  for (const testCase of CASES) {
    // Any state the route needs is set first, so "changes nothing" is measured from there.
    const request = async (as: string, side: Side, before?: () => Promise<string>) => {
      await testCase.prepare?.(prisma, side)
      const snapshotBefore = before ? await before() : null
      const res = await call(server, testCase.path(side), {
        method: testCase.method,
        as,
        body: testCase.body ? testCase.body(side) : undefined,
      })
      return { ...res, snapshotBefore }
    }

    it(`${testCase.name}: another captain gets 404 and changes nothing`, async () => {
      const res = await request(CAPTAIN_B, data.a, () => snapshot(prisma))
      assert.equal(res.status, 404, JSON.stringify(res.json))
      assert.equal(await snapshot(prisma), res.snapshotBefore)
    })

    it(`${testCase.name}: a signed-in stranger gets 404 and changes nothing`, async () => {
      const res = await request(STRANGER, data.a, () => snapshot(prisma))
      assert.equal(res.status, 404, JSON.stringify(res.json))
      assert.equal(await snapshot(prisma), res.snapshotBefore)
    })

    it(`${testCase.name}: the syndicate's own gun ${testCase.level === 'member' ? 'is allowed' : 'gets 404'}`, async () => {
      const res = await request(GUN_A, data.a, () => snapshot(prisma))
      if (testCase.level === 'member') {
        assert.ok(res.status >= 200 && res.status < 300, `expected success, got ${res.status} ${JSON.stringify(res.json)}`)
      } else {
        assert.equal(res.status, 404, JSON.stringify(res.json))
        assert.equal(await snapshot(prisma), res.snapshotBefore)
      }
    })

    it(`${testCase.name}: a member with the beater role gets 404 and changes nothing`, async () => {
      const res = await request(BEATER_ROLE_A, data.a, () => snapshot(prisma))
      assert.equal(res.status, 404, JSON.stringify(res.json))
      assert.equal(await snapshot(prisma), res.snapshotBefore)
    })

    it(`${testCase.name}: the captain is allowed`, async () => {
      const res = await request(CAPTAIN_A, data.a)
      assert.ok(res.status >= 200 && res.status < 300, `expected success, got ${res.status} ${JSON.stringify(res.json)}`)
    })
  }

  describe('records from another syndicate cannot be linked in', () => {
    it("captain A cannot book their beater onto B's shoot, or B's beater onto their own", async () => {
      const before = await prisma.beaterBooking.count()
      const ontoB = await call(server, `/api/shoots/${data.b.shoot.id}/beaters`, {
        method: 'POST', as: CAPTAIN_A, body: { beaterIds: [data.a.beater.id] },
      })
      assert.equal(ontoB.status, 404)
      const bsBeater = await call(server, `/api/shoots/${data.a.shoot.id}/beaters`, {
        method: 'POST', as: CAPTAIN_A, body: { beaterIds: [data.b.beater.id] },
      })
      assert.equal(bsBeater.status, 400)
      assert.equal(await prisma.beaterBooking.count(), before)
    })

    it("captain A cannot change B's booking through their own shoot", async () => {
      const res = await call(server, `/api/shoots/${data.a.shoot.id}/beaters/${data.b.booking.id}`, {
        method: 'PATCH', as: CAPTAIN_A, body: { status: 'NO_SHOW' },
      })
      assert.equal(res.status, 404)
      const booking = await prisma.beaterBooking.findUniqueOrThrow({ where: { id: data.b.booking.id } })
      assert.equal(booking.status, 'CONFIRMED')
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
        method: 'POST', as: CAPTAIN_A, body: { payments: [{ paymentId: data.b.payment.id, amount: 4000 }] },
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
