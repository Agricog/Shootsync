/**
 * A syndicate whose plan isn't paid up is read-only, on the server (the owner's decision,
 * 29 Oct 2026: reads and exports yes, changes no).
 *
 * Every signed-in route from the shared matrix is called with the plan in each unpaid state:
 *   - reading always works, so nothing recorded is ever held back;
 *   - every change is refused with 402 and a sentence, and changes nothing;
 *   - the ways back to a paid plan, and archiving, stay open.
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { CAPTAIN_A, CAPTAIN_B, GUN_A, call, createTestPrisma, createTestStripe, resetDatabase, seed, startTestServer, type TestServer } from './helpers.js'
import { CASES, snapshot } from './routeCases.js'
import { LAPSED_CAPTAIN_MESSAGE } from '../server/access.js'

type Seeded = Awaited<ReturnType<typeof seed>>

const UNPAID = [null, 'INCOMPLETE', 'UNPAID', 'CANCELLED'] as const

describe('a syndicate without a paid-up plan is read-only', () => {
  let prisma: PrismaClient
  let server: TestServer
  let data: Seeded

  before(async () => {
    prisma = createTestPrisma()
    server = await startTestServer(prisma, createTestStripe().stripe)
  })

  after(async () => {
    await server.close()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await resetDatabase(prisma)
    data = await seed(prisma)
  })

  const lapse = (status: (typeof UNPAID)[number]) =>
    prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionStatus: status } })

  for (const testCase of CASES) {
    const isRead = testCase.method === 'GET'
    const verdict = isRead ? 'still works' : testCase.allowLapsed ? 'stays open' : 'is refused for the captain and changes nothing'

    it(`${testCase.name}: ${verdict}, in every unpaid state`, async () => {
      for (const status of UNPAID) {
        await resetDatabase(prisma)
        data = await seed(prisma)
        await lapse(status)
        const before = await snapshot(prisma)
        const res = await call(server, testCase.path(data.a), { method: testCase.method, as: CAPTAIN_A, body: testCase.body?.(data.a) })
        if (isRead || testCase.allowLapsed?.includes(status)) {
          assert.ok(res.status >= 200 && res.status < 300, `${status}: expected success, got ${res.status} ${JSON.stringify(res.json)}`)
        } else if (testCase.allowLapsed) {
          // Open to an unpaid plan, but this state has its own rule (a plan still being paid
          // for can't be archived or bought twice). The point: never the lapsed-plan refusal.
          assert.notEqual(res.status, 402, `${status}: refused as lapsed`)
        } else {
          assert.equal(res.status, 402, `${status}: ${JSON.stringify(res.json)}`)
          assert.equal(res.json.error, LAPSED_CAPTAIN_MESSAGE)
          assert.equal(await snapshot(prisma), before, `${status}: something changed`)
        }
      }
    })
  }

  it("a gun's own changes are refused too, with a sentence about the captain", async () => {
    await lapse('CANCELLED')
    const res = await call(server, '/api/bags', { method: 'POST', as: GUN_A, body: { shootId: data.a.shoot.id, driveNumber: 2, pheasant: 7 } })
    assert.equal(res.status, 402)
    assert.equal(res.json.error, 'This syndicate is read-only until its captain renews the plan.')
  })

  it('another captain still gets 404, never a hint that the plan has lapsed', async () => {
    await lapse('CANCELLED')
    const res = await call(server, `/api/shoots/${data.a.shoot.id}`, { method: 'PATCH', as: CAPTAIN_B, body: { locationName: 'X' } })
    assert.equal(res.status, 404)
  })

  it('a failed payment Stripe is still retrying (past due) leaves everything working: Saturday’s shoot goes ahead', async () => {
    await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionStatus: 'PAST_DUE' } })
    assert.equal((await call(server, `/api/shoots/${data.a.shoot.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { locationName: 'Moved' } })).status, 200)
    assert.equal((await call(server, '/api/bags', { method: 'POST', as: GUN_A, body: { shootId: data.a.shoot.id, driveNumber: 2, pheasant: 7 } })).status, 201)
  })

  it('a trial counts as paid up', async () => {
    await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionStatus: 'TRIALING' } })
    const res = await call(server, `/api/shoots/${data.a.shoot.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { locationName: 'Moved' } })
    assert.equal(res.status, 200)
  })

  it('creating a new syndicate is never blocked by another one’s plan', async () => {
    await lapse('CANCELLED')
    const res = await call(server, '/api/syndicates', {
      method: 'POST', as: CAPTAIN_A, body: { name: 'Fresh start', seasonStart: '2027-10-01', seasonEnd: '2028-02-01' },
    })
    assert.equal(res.status, 201)
  })
})
