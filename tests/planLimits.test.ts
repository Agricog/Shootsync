/**
 * What each plan covers, enforced on the server: Starter up to 10 active guns and 15 active
 * beaters, Standard up to 20 guns and any number of beaters. The pricing page's words and the
 * server's numbers come from the same place, and a test holds them together.
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { CAPTAIN_A, call, createTestPrisma, createTestStripe, resetDatabase, seed, startTestServer, type TestServer } from './helpers.js'
import { PLAN_LIMITS } from '../server/plans.js'
import { limitMessage } from '../server/planLimits.js'
import { PLANS } from '../src/config/plans.js'

type Seeded = Awaited<ReturnType<typeof seed>>

describe('plan limits', () => {
  it('the pricing page promises exactly what the server enforces', () => {
    for (const plan of PLANS) {
      const limits = PLAN_LIMITS[plan.tier]
      const guns = limits.guns === null ? 'Unlimited guns' : `Up to ${limits.guns} guns`
      const beaters = limits.beaters === null ? 'Unlimited beaters' : `Up to ${limits.beaters} beaters`
      assert.ok(plan.features.includes(guns), `${plan.name} should say "${guns}"`)
      assert.ok(plan.features.includes(beaters), `${plan.name} should say "${beaters}"`)
      const mentions = plan.features.filter((f) => /\b(guns|beaters)\b/i.test(f) && /^(Up to|Unlimited)/.test(f))
      assert.equal(mentions.length, 2, `${plan.name} states its limits once each`)
    }
  })

  it('the refusal says what to do, and only offers an upgrade where there is one', () => {
    assert.equal(limitMessage('STARTER', 'guns', 10), 'Your Starter plan covers up to 10 active guns. Make a member inactive or move to the Standard plan under Settings, Manage billing, then try again.')
    assert.equal(limitMessage('STANDARD', 'guns', 20), 'Your Standard plan covers up to 20 active guns. Make a member inactive, then try again.')
  })

  describe('on the server', () => {
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

    const syndicateId = () => data.a.syndicate.id
    const onPlan = (planTier: 'STARTER' | 'STANDARD') => prisma.syndicate.update({ where: { id: syndicateId() }, data: { planTier } })
    const activeGuns = () => prisma.member.count({ where: { syndicateId: syndicateId(), status: 'ACTIVE', role: { in: ['CAPTAIN', 'GUN', 'HYBRID'] } } })
    /** Adds active guns straight into the database until the syndicate has `total`. */
    const fillGunsTo = async (total: number) => {
      const have = await activeGuns()
      for (let i = have; i < total; i++) {
        await prisma.member.create({ data: { syndicateId: syndicateId(), clerkUserId: `pending_fill_${i}`, email: `fill${i}@example.com`, name: `Fill ${i}`, role: 'GUN', status: 'ACTIVE' } })
      }
    }
    const addGun = (name: string) =>
      call(server, '/api/members', { method: 'POST', as: CAPTAIN_A, body: { syndicateId: syndicateId(), name, email: `${name.replace(/\s/g, '')}@example.com` } })
    const addBeater = (name: string) => call(server, '/api/beaters', { method: 'POST', as: CAPTAIN_A, body: { syndicateId: syndicateId(), name } })

    it('Starter: the tenth gun can be added, the eleventh cannot, and nothing is half-saved', async () => {
      await onPlan('STARTER')
      await fillGunsTo(9)
      assert.equal((await addGun('Tenth Gun')).status, 201)
      const eleventh = await addGun('Eleventh Gun')
      assert.equal(eleventh.status, 409)
      assert.equal(eleventh.json.error, limitMessage('STARTER', 'guns', 10))
      assert.equal(await activeGuns(), 10)
    })

    it('Starter: a gun made inactive frees a place; reactivating past the limit is refused', async () => {
      await onPlan('STARTER')
      await fillGunsTo(10)
      const gun = data.a.gun.id
      assert.equal((await call(server, `/api/members/${gun}/status`, { method: 'PATCH', as: CAPTAIN_A, body: { status: 'INACTIVE' } })).status, 200)
      assert.equal((await addGun('Replacement')).status, 201)
      const back = await call(server, `/api/members/${gun}/status`, { method: 'PATCH', as: CAPTAIN_A, body: { status: 'ACTIVE' } })
      assert.equal(back.status, 409)
      assert.equal(await activeGuns(), 10)
    })

    it('Standard covers twenty guns', async () => {
      await fillGunsTo(19)
      assert.equal((await addGun('Twentieth')).status, 201)
      assert.equal((await addGun('Twenty-first')).status, 409)
    })

    it('Starter: fifteen beaters, and reactivating one past that is refused; Standard has no beater limit', async () => {
      await onPlan('STARTER')
      for (let i = 1; i < 15; i++) assert.equal((await addBeater(`Beater ${i}`)).status, 201, `beater ${i}`)
      const sixteenth = await addBeater('Sixteenth')
      assert.equal(sixteenth.status, 409)
      assert.equal(sixteenth.json.error, limitMessage('STARTER', 'beaters', 15))

      const resting = await prisma.beater.create({ data: { syndicateId: syndicateId(), name: 'Resting', status: 'INACTIVE' } })
      assert.equal((await call(server, `/api/beaters/${resting.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { status: 'ACTIVE' } })).status, 409)
      // Editing anything else about an active beater is not adding one.
      assert.equal((await call(server, `/api/beaters/${data.a.beater.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { status: 'ACTIVE', name: 'Renamed' } })).status, 200)

      await onPlan('STANDARD')
      assert.equal((await addBeater('Sixteenth')).status, 201)
    })

    it('moving to a smaller plan removes nobody; it only stops more being added', async () => {
      await fillGunsTo(14)
      await onPlan('STARTER')
      assert.equal(await activeGuns(), 14)
      assert.equal((await addGun('One more')).status, 409)
      // Everyone can still be edited, and made inactive.
      assert.equal((await call(server, `/api/members/${data.a.gun.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { name: 'Edited' } })).status, 200)
      assert.equal((await call(server, `/api/members/${data.a.gun.id}/status`, { method: 'PATCH', as: CAPTAIN_A, body: { status: 'INACTIVE' } })).status, 200)
    })

    it('turning an active non-gun record into a gun counts against the plan', async () => {
      await onPlan('STARTER')
      await fillGunsTo(10)
      const beaterRole = await prisma.member.findFirstOrThrow({ where: { syndicateId: syndicateId(), role: 'BEATER' } })
      const res = await call(server, `/api/members/${beaterRole.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { role: 'GUN' } })
      assert.equal(res.status, 409)
      assert.equal((await prisma.member.findUniqueOrThrow({ where: { id: beaterRole.id } })).role, 'BEATER')
    })

    it('an addition waits for the syndicate lock, so the count it checks is the count it adds to', async () => {
      await onPlan('STARTER')
      let request: Promise<{ status: number }> | null = null
      let finishedWhileLocked = false
      await prisma.$transaction(async (tx) => {
        // The same lock the check takes. (FOR UPDATE here would also hold up the member insert's
        // foreign-key lock, so the test would wait even if the check took no lock at all.)
        await tx.$queryRaw`SELECT id FROM syndicates WHERE id = ${syndicateId()} FOR NO KEY UPDATE`
        request = addGun('Waits Its Turn')
        const raced = await Promise.race([request.then(() => 'finished'), new Promise((r) => setTimeout(() => r('waiting'), 750))])
        finishedWhileLocked = raced === 'finished'
      }, { timeout: 10_000 })
      assert.equal(finishedWhileLocked, false, 'the addition did not wait for the lock')
      assert.equal((await request!).status, 201)
    })

    it('two additions at the same moment cannot both take the last place', async () => {
      await onPlan('STARTER')
      await fillGunsTo(9)
      const results = await Promise.all([addGun('Racer One'), addGun('Racer Two'), addGun('Racer Three')])
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409])
      assert.equal(await activeGuns(), 10)
    })
  })
})
