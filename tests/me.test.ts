/**
 * Who am I, archiving, and what the API says when something is wrong.
 *
 * GET /api/me is what the browser builds its navigation from, so it must list exactly the
 * syndicates the server will let this user into, in exactly the role the server enforces.
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import {
  BEATER_ROLE_A,
  CAPTAIN_A,
  CAPTAIN_B,
  GUN_A,
  INVITE_TOKEN_A,
  STRANGER,
  call,
  createTestPrisma,
  createTestStripe,
  resetDatabase,
  seed,
  startTestServer,
  type TestServer,
  acceptBody,
} from './helpers.js'

type Seeded = Awaited<ReturnType<typeof seed>>

describe('who am I, archiving and plain-English errors', () => {
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

  const me = async (as: string) => {
    const res = await call(server, '/api/me', { as })
    assert.equal(res.status, 200, JSON.stringify(res.json))
    return res.json.syndicates as Array<Record<string, any>>
  }

  describe('GET /api/me', () => {
    it("lists the captain's own syndicate, as captain, with their own place on the gun list", async () => {
      const list = await me(CAPTAIN_A)
      assert.equal(list.length, 1)
      assert.equal(list[0].id, data.a.syndicate.id)
      assert.equal(list[0].role, 'CAPTAIN')
      assert.equal(list[0].memberId, data.a.captainMember.id)
      assert.equal(list[0].name, 'A Syndicate')
      assert.equal(list[0].defaultBeaterRate, 40)
      assert.equal(list[0].pegRotationRule, 'FAIR_ROTATION')
    })

    it("lists a signed-in gun's syndicate, as gun, with their member record", async () => {
      const list = await me(GUN_A)
      assert.deepEqual(list.map((s) => [s.id, s.role, s.memberId]), [[data.a.syndicate.id, 'GUN', data.a.gun.id]])
    })

    it('lists nothing for a stranger, or for a member who is not a gun', async () => {
      assert.deepEqual(await me(STRANGER), [])
      assert.deepEqual(await me(BEATER_ROLE_A), [])
    })

    it('an inactive gun is no longer listed', async () => {
      await prisma.member.update({ where: { id: data.a.gun.id }, data: { status: 'INACTIVE' } })
      assert.deepEqual(await me(GUN_A), [])
    })

    it('never sends Stripe IDs, the captain’s account ID, or anyone else', async () => {
      const res = await call(server, '/api/me', { as: CAPTAIN_A })
      const text = JSON.stringify(res.json)
      for (const secret of ['cus_secret_A', CAPTAIN_A, 'captainClerkId', 'stripeCustomerId', 'stripeSubscriptionId', 'B Syndicate', 'A Gun']) {
        assert.equal(text.includes(secret), false, `response contains ${secret}`)
      }
    })

    it('a plan can be used while active, trialling, or past due while Stripe retries; not once unpaid or ended', async () => {
      const cases: Array<[string | null, boolean]> = [
        [null, false], ['ACTIVE', true], ['TRIALING', true], ['PAST_DUE', true], ['UNPAID', false], ['INCOMPLETE', false], ['CANCELLED', false],
      ]
      for (const [status, expected] of cases) {
        await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionStatus: status as any } })
        const [syndicate] = await me(CAPTAIN_A)
        assert.equal(syndicate.subscription.isActive, expected, `status ${status}`)
        assert.equal(syndicate.subscription.status, status)
      }
    })

    it('a captain who also shoots in another syndicate sees both, each in its own role', async () => {
      await prisma.member.create({
        data: { syndicateId: data.b.syndicate.id, clerkUserId: CAPTAIN_A, email: 'a-in-b@example.com', name: 'A in B', role: 'GUN', status: 'ACTIVE' },
      })
      const list = await me(CAPTAIN_A)
      assert.deepEqual(list.map((s) => [s.id, s.role]), [[data.a.syndicate.id, 'CAPTAIN'], [data.b.syndicate.id, 'GUN']])
    })
  })

  describe('archiving a syndicate', () => {
    it('is refused while a plan is still being charged, with what to do instead', async () => {
      for (const status of ['ACTIVE', 'TRIALING', 'PAST_DUE', 'UNPAID', 'INCOMPLETE'] as const) {
        await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionStatus: status } })
        const res = await call(server, `/api/syndicates/${data.a.syndicate.id}`, { method: 'DELETE', as: CAPTAIN_A })
        assert.equal(res.status, 409, status)
        assert.match(res.json.error, /Cancel the plan/)
      }
      const row = await prisma.syndicate.findUniqueOrThrow({ where: { id: data.a.syndicate.id } })
      assert.equal(row.status, 'ACTIVE')
    })

    it('once the plan has ended, takes the syndicate out of the app for everyone, keeping its records', async () => {
      await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionStatus: 'CANCELLED' } })
      const archived = await call(server, `/api/syndicates/${data.a.syndicate.id}`, { method: 'DELETE', as: CAPTAIN_A })
      assert.equal(archived.status, 200)

      assert.deepEqual(await me(CAPTAIN_A), [])
      assert.deepEqual(await me(GUN_A), [])
      assert.deepEqual((await call(server, '/api/syndicates', { as: CAPTAIN_A })).json, [])
      for (const [as, path] of [
        [CAPTAIN_A, `/api/syndicates/${data.a.syndicate.id}`],
        [CAPTAIN_A, `/api/shoots/${data.a.shoot.id}`],
        [CAPTAIN_A, `/api/members?syndicateId=${data.a.syndicate.id}`],
        [GUN_A, `/api/shoots?syndicateId=${data.a.syndicate.id}`],
      ]) {
        assert.equal((await call(server, path, { as })).status, 404, path)
      }
      const write = await call(server, '/api/shoots', { method: 'POST', as: CAPTAIN_A, body: { syndicateId: data.a.syndicate.id, date: '2026-12-05', locationName: 'X' } })
      assert.equal(write.status, 404)
      assert.equal(await prisma.shootDay.count({ where: { syndicateId: data.a.syndicate.id } }), 1)
    })

    it("its guests' links stop working: no RSVP, no waiver", async () => {
      await prisma.guestGun.update({ where: { id: data.a.guest.id }, data: { rsvpStatus: 'CONFIRMED', waiverAccepted: true } })
      await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { status: 'ARCHIVED' } })
      const base = `/api/guests/token/${INVITE_TOKEN_A}`
      for (const [method, path, body] of [
        ['GET', base, undefined],
        ['POST', `${base}/accept`, acceptBody()],
        ['POST', `${base}/decline`, {}],
      ] as const) {
        const res = await call(server, path, { method, body })
        assert.equal(res.status, 404, `${method} ${path}`)
        assert.equal(res.json.error, 'This invitation is invalid or has expired.')
      }
      const guest = await prisma.guestGun.findUniqueOrThrow({ where: { id: data.a.guest.id } })
      assert.equal(guest.rsvpStatus, 'CONFIRMED')
    })

    it("another captain's syndicate is untouched", async () => {
      await call(server, `/api/syndicates/${data.a.syndicate.id}`, { method: 'DELETE', as: CAPTAIN_A })
      assert.equal((await me(CAPTAIN_B)).length, 1)
    })
  })

  describe('a bag record seen by a gun', () => {
    it("carries the day, but never the captain's private notes", async () => {
      const asGun = await call(server, `/api/bags/${data.a.bag.id}`, { as: GUN_A })
      assert.equal(asGun.status, 200)
      assert.equal(asGun.json.shootDay.locationName, 'A Farm')
      assert.equal('captainNotes' in asGun.json.shootDay, false)
      assert.equal('weatherNotes' in asGun.json.shootDay, false)

      const asCaptain = await call(server, `/api/bags/${data.a.bag.id}`, { as: CAPTAIN_A })
      assert.equal(asCaptain.json.shootDay.captainNotes, 'A captain-only notes')
    })
  })

  describe('validation errors read as sentences', () => {
    const newShoot = (body: Record<string, unknown>) =>
      call(server, '/api/shoots', { method: 'POST', as: CAPTAIN_A, body: { syndicateId: data.a.syndicate.id, date: '2026-12-05', locationName: 'Wood', ...body } })

    it('names the field and says what is wrong', async () => {
      const blank = await newShoot({ locationName: '' })
      assert.equal(blank.status, 400)
      assert.equal(blank.json.error, 'Location is required.')
      assert.deepEqual(blank.json.details, [{ path: ['locationName'], message: 'Location is required.' }])

      assert.equal((await newShoot({ locationPostcode: 'X'.repeat(13) })).json.error, 'Postcode must be 12 characters or fewer.')
      assert.equal((await newShoot({ drivesPlanned: 2.5 })).json.error, 'Drives planned must be a whole number.')
      assert.equal((await newShoot({ drivesPlanned: 0 })).json.error, 'Drives planned must be at least 1.')
      assert.equal((await newShoot({ locationName: undefined })).json.error, 'Location is required.')
    })

    it("keeps a schema's own wording", async () => {
      assert.equal((await newShoot({ meetTime: '9am' })).json.error, 'Meet time must be like 08:30')
    })

    it('never echoes what was sent', async () => {
      const marker = 'UNIQUE-MARKER-'.padEnd(200, 'x')
      const res = await newShoot({ locationName: marker })
      assert.equal(res.status, 400)
      assert.equal(JSON.stringify(res.json).includes('UNIQUE-MARKER'), false)
    })
  })
})
