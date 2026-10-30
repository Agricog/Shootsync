/**
 * The audit trail (batch 9d): every change is recorded, with who and what, and never a value.
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import type Stripe from 'stripe'
import { CAPTAIN_A, CAPTAIN_B, GUN_A, INVITE_TOKEN_A, TEST_WEBHOOK_SECRET, acceptBody, call, createTestPrisma, createTestStripe, registeredRoutes, resetDatabase, seed, startTestServer, type TestServer } from './helpers.js'
import { ACTIONS, NOT_RECORDED } from '../server/audit.js'
import { CASES } from './routeCases.js'

type Seeded = Awaited<ReturnType<typeof seed>>

describe('audit trail', () => {
  let prisma: PrismaClient
  let server: TestServer
  let stripe: Stripe
  let data: Seeded

  before(async () => {
    prisma = createTestPrisma()
    stripe = createTestStripe().stripe
    server = await startTestServer(prisma, stripe)
  })

  after(async () => {
    await server.close()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await resetDatabase(prisma)
    data = await seed(prisma)
    server.alerts.length = 0
  })

  /** Entries are written once the response has gone: wait for them. */
  async function trail(syndicateId = data.a.syndicate.id, expected = 1) {
    for (let i = 0; i < 50; i++) {
      const rows = await prisma.activityLog.findMany({ where: { syndicateId }, orderBy: { timestamp: 'asc' } })
      if (rows.length >= expected) return rows
      await new Promise((r) => setTimeout(r, 20))
    }
    return prisma.activityLog.findMany({ where: { syndicateId }, orderBy: { timestamp: 'asc' } })
  }

  it('every route that changes anything is named in the trail, or says why it is not', () => {
    const routes = registeredRoutes(prisma, stripe).filter((r) => r.method !== 'GET')
    const unnamed = routes.map((r) => `${r.method} ${r.path.replace(/\/$/, '')}`).filter((key) => !ACTIONS[key] && !NOT_RECORDED[key])
    assert.deepEqual(unnamed, [])
    // And nothing named that no longer exists.
    const live = new Set(routes.map((r) => `${r.method} ${r.path.replace(/\/$/, '')}`))
    assert.deepEqual(Object.keys(ACTIONS).filter((key) => !live.has(key)), [])
  })

  it('a change is recorded with who, what, which record and the names of the fields: never their values', async () => {
    const res = await call(server, `/api/beaters/${data.a.beater.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { name: 'Dai Secret-Surname', phone: '07700 900999', bankSortCode: '30-90-12', bankAccountNumber: '87654321' } })
    assert.equal(res.status, 200)
    const [entry] = await trail()
    assert.equal(entry.action, 'Beater details changed')
    assert.deepEqual([entry.actorRole, entry.actorUserId, entry.targetType, entry.targetId], ['captain', CAPTAIN_A, 'beater', data.a.beater.id])
    assert.deepEqual((entry.details as { fields: string[] }).fields, ['bankAccountNumber', 'bankSortCode', 'name', 'phone'])
    const stored = JSON.stringify(entry)
    for (const value of ['Secret-Surname', '07700', '87654321', '30-90-12']) assert.equal(stored.includes(value), false, value)
  })

  it('every change in the access matrix writes its entry, naming the record, before the answer arrives', async () => {
    const missing: string[] = []
    // Routes that deliberately record nothing (a proposed draw saves nothing) are left out.
    const unrecorded = Object.keys(NOT_RECORDED).map((key) => {
      const [method, path] = key.split(' ')
      return { method, pattern: new RegExp(`^${path.replace(/:[a-zA-Z]+/g, '[^/?]+')}(\\?|$)`) }
    })
    const recorded = CASES.filter((c) => c.method !== 'GET' && !unrecorded.some((u) => u.method === c.method && u.pattern.test(c.path(data.a))))
    assert.ok(recorded.length > 30)
    for (const testCase of recorded) {
      await resetDatabase(prisma)
      data = await seed(prisma)
      await testCase.prepare?.(prisma, data.a)
      const res = await call(server, testCase.path(data.a), { method: testCase.method, as: CAPTAIN_A, body: testCase.body?.(data.a) })
      if (res.status < 200 || res.status >= 300) { missing.push(`${testCase.name}: ${res.status}`); continue }
      // No waiting: the entry must already be there when the answer arrives.
      const entries = await prisma.activityLog.findMany({ where: { syndicateId: data.a.syndicate.id } })
      if (entries.length !== 1) { missing.push(`${testCase.name}: ${entries.length} entries`); continue }
      if (entries[0].targetType && !entries[0].targetId) missing.push(`${testCase.name}: no record named`)
    }
    assert.deepEqual(missing, [])
  })

  it('a new syndicate’s first entry is its own creation, by its captain', async () => {
    const res = await call(server, '/api/syndicates', { method: 'POST', as: CAPTAIN_A, body: { name: 'Fresh', seasonStart: '2027-10-01', seasonEnd: '2028-02-01' } })
    assert.equal(res.status, 201)
    const [entry] = await prisma.activityLog.findMany({ where: { syndicateId: res.json.id } })
    assert.deepEqual([entry?.action, entry?.actorRole, entry?.actorUserId, entry?.targetId], ['Syndicate created', 'captain', CAPTAIN_A, res.json.id])
  })

  it('if the record of showing bank details can’t be written, they aren’t shown', async () => {
    // The database refuses that one entry, as a full disk or a lost connection would.
    await prisma.$executeRawUnsafe(`ALTER TABLE activity_logs ADD CONSTRAINT test_refuse_shown CHECK (action <> 'Bank details shown') NOT VALID`)
    try {
      const res = await call(server, `/api/beaters/${data.a.beater.id}/bank-details/reveal`, { method: 'POST', as: CAPTAIN_A })
      assert.equal(res.status, 500)
      assert.equal(JSON.stringify(res.json).includes('12345678'), false)
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE activity_logs DROP CONSTRAINT test_refuse_shown')
    }
  })

  it('a field name nobody uses is never written into the trail', async () => {
    const res = await call(server, `/api/shoots/${data.a.shoot.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { locationName: 'Moved', 'Ring 07700 900999 for a good time': true } })
    assert.equal(res.status, 200)
    const [entry] = await trail()
    assert.deepEqual((entry.details as { fields: string[] }).fields, ['locationName'])
  })

  it('a refused change is not recorded', async () => {
    assert.equal((await call(server, `/api/beaters/${data.a.beater.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { bankAccountNumber: '1' } })).status, 400)
    assert.equal((await call(server, `/api/beaters/${data.b.beater.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { name: 'X' } })).status, 404)
    await new Promise((r) => setTimeout(r, 100))
    assert.equal(await prisma.activityLog.count(), 0)
  })

  it('a gun’s own change is recorded as theirs', async () => {
    assert.equal((await call(server, '/api/bags', { method: 'POST', as: GUN_A, body: { shootId: data.a.shoot.id, driveNumber: 2, pheasant: 7 } })).status, 201)
    const [entry] = await trail()
    assert.deepEqual([entry.action, entry.actorRole, entry.actorMemberId], ['Bag recorded', 'gun', data.a.gun.id])
  })

  it('showing and exporting bank details are recorded, with which beaters', async () => {
    await call(server, `/api/beaters/${data.a.beater.id}/bank-details/reveal`, { method: 'POST', as: CAPTAIN_A })
    await call(server, '/api/beaters/payments/bank-export', { method: 'POST', as: CAPTAIN_A, body: { syndicateId: data.a.syndicate.id } })
    const entries = await trail(data.a.syndicate.id, 2)
    assert.deepEqual(entries.map((e) => e.action).sort(), ['Bank details exported for payment', 'Bank details shown'])
    const exported = entries.find((e) => e.action === 'Bank details exported for payment')!
    assert.deepEqual(exported.details, { beaters: [data.a.beater.id], withoutBankDetails: 0 })
    assert.equal(JSON.stringify(entries).includes('12345678'), false)
  })

  it('a guest accepting is recorded against the guest, with the guest as the actor and no contact details', async () => {
    assert.equal((await call(server, `/api/guests/token/${INVITE_TOKEN_A}/accept`, { method: 'POST', body: acceptBody() })).status, 200)
    const [entry] = await trail()
    assert.deepEqual([entry.action, entry.actorRole, entry.actorUserId, entry.targetId], ['Guest accepted the invitation', 'guest', null, data.a.guest.id])
    assert.equal(JSON.stringify(entry).includes('07700900000'), false)
    assert.equal(JSON.stringify(entry).includes(INVITE_TOKEN_A), false)
  })

  it('Stripe’s changes are recorded as Stripe’s', async () => {
    const body = JSON.stringify({ id: 'evt_guest', object: 'event', type: 'checkout.session.completed', data: { object: { id: 'cs_g', object: 'checkout.session', mode: 'payment', payment_status: 'paid', payment_intent: 'pi_g', amount_total: 5000, currency: 'gbp', metadata: { type: 'guest_day_fee', guestId: data.a.guest.id } } } })
    const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: TEST_WEBHOOK_SECRET })
    const res = await fetch(`${server.baseUrl}/api/stripe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature }, body })
    assert.equal(res.status, 200)
    const [entry] = await trail()
    assert.deepEqual([entry.action, entry.actorRole, entry.targetId], ['Guest paid by card', 'stripe', data.a.guest.id])
  })

  it('an entry can’t be edited, through the app or the database', async () => {
    await call(server, `/api/shoots/${data.a.shoot.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { locationName: 'Moved' } })
    const [entry] = await trail()
    await assert.rejects(prisma.activityLog.update({ where: { id: entry.id }, data: { action: 'Nothing happened' } }), /cannot be changed/)
  })

  it('the captain reads the trail, newest first, with names looked up now; nobody else can', async () => {
    await call(server, `/api/shoots/${data.a.shoot.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { locationName: 'Moved' } })
    await call(server, '/api/bags', { method: 'POST', as: GUN_A, body: { shootId: data.a.shoot.id, driveNumber: 2, pheasant: 7 } })
    await trail(data.a.syndicate.id, 2)
    const res = await call(server, `/api/syndicates/${data.a.syndicate.id}/activity`, { as: CAPTAIN_A })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('cache-control'), 'no-store')
    assert.deepEqual(res.json.entries.map((e: { action: string; who: string }) => [e.action, e.who]), [['Bag recorded', 'A Gun'], ['Shoot day changed', 'Captain']])
    assert.match(res.json.entries[1].target, /^Moved, 14 Nov 2026$/)
    assert.deepEqual(res.json.entries[1].fields, ['locationName'])
    assert.equal((await call(server, `/api/syndicates/${data.a.syndicate.id}/activity`, { as: GUN_A })).status, 404)
    assert.equal((await call(server, `/api/syndicates/${data.a.syndicate.id}/activity`, { as: CAPTAIN_B })).status, 404)
  })

  it('pages through a long trail without skipping or repeating an entry', async () => {
    const at = new Date('2026-11-01T10:00:00Z')
    // 120 entries, many in the same millisecond: a timestamp cursor would lose some.
    await prisma.activityLog.createMany({ data: Array.from({ length: 120 }, (_, i) => ({ syndicateId: data.a.syndicate.id, action: `Entry ${i}`, actorRole: 'system', timestamp: new Date(at.getTime() + Math.floor(i / 7)) })) })
    const seen: string[] = []
    let afterId: string | undefined
    for (let page = 0; page < 5; page++) {
      const res = await call(server, `/api/syndicates/${data.a.syndicate.id}/activity${afterId ? `?after=${afterId}` : ''}`, { as: CAPTAIN_A })
      seen.push(...res.json.entries.map((e: { id: string }) => e.id))
      if (!res.json.more) break
      afterId = res.json.entries.at(-1).id
    }
    assert.equal(seen.length, 120)
    assert.equal(new Set(seen).size, 120)
  })

  it('leaving starts the retention clock, and coming back stops it', async () => {
    await call(server, `/api/beaters/${data.a.beater.id}`, { method: 'DELETE', as: CAPTAIN_A })
    const left = (await prisma.beater.findUniqueOrThrow({ where: { id: data.a.beater.id } })).leftAt
    assert.ok(left)
    // Removing again doesn't move the clock.
    await call(server, `/api/beaters/${data.a.beater.id}`, { method: 'DELETE', as: CAPTAIN_A })
    assert.equal((await prisma.beater.findUniqueOrThrow({ where: { id: data.a.beater.id } })).leftAt?.getTime(), left.getTime())
    await call(server, `/api/beaters/${data.a.beater.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { status: 'ACTIVE' } })
    assert.equal((await prisma.beater.findUniqueOrThrow({ where: { id: data.a.beater.id } })).leftAt, null)

    await call(server, `/api/members/${data.a.gun.id}/status`, { method: 'PATCH', as: CAPTAIN_A, body: { status: 'INACTIVE' } })
    assert.ok((await prisma.member.findUniqueOrThrow({ where: { id: data.a.gun.id } })).leftAt)
    await call(server, `/api/members/${data.a.gun.id}/status`, { method: 'PATCH', as: CAPTAIN_A, body: { status: 'ACTIVE' } })
    assert.equal((await prisma.member.findUniqueOrThrow({ where: { id: data.a.gun.id } })).leftAt, null)
  })
})
