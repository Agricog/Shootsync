/**
 * Retention, export and erasure (batch 9d): records are removed when their time is up and not a
 * day before, a captain can take everything away, and a person's details can be erased on request.
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { CAPTAIN_A, GUN_A, call, createTestPrisma, createTestStripe, resetDatabase, seed, startTestServer, type TestServer } from './helpers.js'
import { RETENTION, paymentCutoff, runRetention, syndicateDeletionDate, FORMER_BEATER, FORMER_MEMBER } from '../server/retention.js'
import { RETENTION as STATED } from '../src/config/retention.js'
import { EXPORT_FORMAT } from '../server/syndicateExport.js'

type Seeded = Awaited<ReturnType<typeof seed>>
const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-11-14T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY)

describe('retention periods', () => {
  it('the privacy notice states exactly the periods the server enforces', () => {
    assert.deepEqual(STATED, RETENTION)
  })

  it('payments go 6 years after the end of their UK tax year (which ends 5 April), not a day before', () => {
    // On 14 Nov 2026 the cutoff is the start of tax year 2020/21: anything in 2019/20 or earlier has had its 6 years.
    assert.equal(paymentCutoff(NOW).toISOString(), '2020-04-06T00:00:00.000Z')
    // On 5 April 2027 the 2020/21 year is not yet past its 6 years; on 6 April it is.
    assert.equal(paymentCutoff(new Date('2027-04-05T12:00:00Z')).toISOString(), '2020-04-06T00:00:00.000Z')
    assert.equal(paymentCutoff(new Date('2027-04-06T12:00:00Z')).toISOString(), '2021-04-06T00:00:00.000Z')
  })

  it('a syndicate is deleted 90 days after its plan ends, or after it was set up if no plan was ever chosen', () => {
    const base = { stripeSubscriptionStatus: 'CANCELLED', stripeSubscriptionId: 'sub_x', createdAt: daysAgo(400) }
    assert.equal(syndicateDeletionDate({ ...base, planEndedAt: daysAgo(10) })?.toISOString(), new Date(daysAgo(10).getTime() + 90 * DAY).toISOString())
    assert.equal(syndicateDeletionDate({ ...base, planEndedAt: null }), null)
    assert.equal(syndicateDeletionDate({ planEndedAt: null, stripeSubscriptionStatus: null, stripeSubscriptionId: null, createdAt: daysAgo(5) })?.toISOString(), new Date(daysAgo(5).getTime() + 90 * DAY).toISOString())
  })
})

describe('retention run', () => {
  let prisma: PrismaClient
  let data: Seeded

  before(() => {
    prisma = createTestPrisma()
  })

  after(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await resetDatabase(prisma)
    data = await seed(prisma)
  })

  const shootOn = (date: Date, syndicateId = data.a.syndicate.id) => prisma.shootDay.create({ data: { syndicateId, date, locationName: 'Old Farm', status: 'COMPLETED' } })

  it('guest phone and emergency contact go 30 days after the day; a guest who never accepted or paid goes entirely', async () => {
    const old = await shootOn(daysAgo(31))
    const recent = await shootOn(daysAgo(29))
    const signed = await prisma.guestGun.create({ data: { shootId: old.id, invitedByMemberId: data.a.gun.id, name: 'Signed', email: 's@example.com', phone: '0770', emergencyContactName: 'Jo', emergencyContactPhone: '0771', waiverAccepted: true, inviteToken: 'f'.repeat(64) } })
    const never = await prisma.guestGun.create({ data: { shootId: old.id, invitedByMemberId: data.a.gun.id, name: 'Never', email: 'n@example.com' } })
    const keep = await prisma.guestGun.create({ data: { shootId: recent.id, invitedByMemberId: data.a.gun.id, name: 'Recent', email: 'r@example.com', emergencyContactName: 'Pat', waiverAccepted: true } })
    const result = await runRetention(prisma, NOW)
    assert.equal(result.ran, true)
    const s = await prisma.guestGun.findUniqueOrThrow({ where: { id: signed.id } })
    assert.deepEqual([s.name, s.email, s.phone, s.emergencyContactName, s.emergencyContactPhone, s.inviteToken, s.waiverAccepted], ['Signed', `removed-${signed.id}@removed.invalid`, null, null, null, null, true])
    assert.equal(await prisma.guestGun.findUnique({ where: { id: never.id } }), null)
    assert.equal((await prisma.guestGun.findUniqueOrThrow({ where: { id: keep.id } })).emergencyContactName, 'Pat')
  })

  it('payments, and guests on record, go 6 years after their tax year; never a payment still owed', async () => {
    const ancient = await shootOn(new Date('2020-04-05T00:00:00Z'))
    const lastKept = await shootOn(new Date('2020-04-06T00:00:00Z'))
    const paidOld = await prisma.beaterPayment.create({ data: { syndicateId: data.a.syndicate.id, beaterId: data.a.beater.id, shootId: ancient.id, amount: 4000, status: 'PAID', paidDate: new Date('2020-04-05T00:00:00Z') } })
    const paidKept = await prisma.beaterPayment.create({ data: { syndicateId: data.a.syndicate.id, beaterId: data.a.beater.id, shootId: lastKept.id, amount: 4000, status: 'PAID', paidDate: new Date('2020-04-06T00:00:00Z') } })
    const owedOld = await prisma.beaterPayment.create({ data: { syndicateId: data.a.syndicate.id, beaterId: data.b.beater.id, shootId: ancient.id, amount: 4000, status: 'PENDING' } })
    const guestOld = await prisma.guestGun.create({ data: { shootId: ancient.id, invitedByMemberId: data.a.gun.id, name: 'Old guest', email: 'o@example.com', waiverAccepted: true, paymentStatus: 'PAID' } })
    const guestKept = await prisma.guestGun.create({ data: { shootId: lastKept.id, invitedByMemberId: data.a.gun.id, name: 'Kept guest', email: 'k@example.com', waiverAccepted: true } })
    await runRetention(prisma, NOW)
    assert.equal(await prisma.beaterPayment.findUnique({ where: { id: paidOld.id } }), null)
    assert.ok(await prisma.beaterPayment.findUnique({ where: { id: paidKept.id } }))
    assert.ok(await prisma.beaterPayment.findUnique({ where: { id: owedOld.id } }))
    assert.equal(await prisma.guestGun.findUnique({ where: { id: guestOld.id } }), null)
    assert.ok(await prisma.guestGun.findUnique({ where: { id: guestKept.id } }))
    // The game book stays.
    assert.ok(await prisma.shootDay.findUnique({ where: { id: ancient.id } }))
  })

  it('a beater who has left keeps bank details until 90 days after their last payment is settled', async () => {
    await prisma.beaterPayment.updateMany({ where: { beaterId: data.a.beater.id }, data: { status: 'PAID', paidDate: daysAgo(89) } })
    await prisma.beater.update({ where: { id: data.a.beater.id }, data: { status: 'INACTIVE', leftAt: daysAgo(200) } })
    await runRetention(prisma, NOW)
    assert.ok((await prisma.beater.findUniqueOrThrow({ where: { id: data.a.beater.id } })).bankDetailsSealed)
    await prisma.beaterPayment.updateMany({ where: { beaterId: data.a.beater.id }, data: { paidDate: daysAgo(91) } })
    await runRetention(prisma, NOW)
    const b = await prisma.beater.findUniqueOrThrow({ where: { id: data.a.beater.id } })
    assert.deepEqual([b.bankDetailsSealed, b.bankAccountLast4, b.bankName], [null, null, null])
    // Still owed anything: kept, whatever the dates.
    await prisma.beater.update({ where: { id: data.b.beater.id }, data: { status: 'INACTIVE', leftAt: daysAgo(400) } })
    await runRetention(prisma, NOW)
    assert.ok((await prisma.beater.findUniqueOrThrow({ where: { id: data.b.beater.id } })).bankDetailsSealed)
  })

  it('a member’s emergency contact goes when they leave; their contact details 12 months later; their name when nothing needs it', async () => {
    await prisma.member.update({ where: { id: data.a.gun.id }, data: { status: 'INACTIVE', leftAt: daysAgo(10), phone: '0770' } })
    await runRetention(prisma, NOW)
    let m = await prisma.member.findUniqueOrThrow({ where: { id: data.a.gun.id } })
    assert.deepEqual([m.emergencyContactName, m.phone, m.name], [null, '0770', 'A Gun'])
    await prisma.member.update({ where: { id: data.a.gun.id }, data: { leftAt: daysAgo(370) } })
    await runRetention(prisma, NOW)
    m = await prisma.member.findUniqueOrThrow({ where: { id: data.a.gun.id } })
    assert.deepEqual([m.phone, m.email.endsWith('@removed.invalid')], [null, true])
    // The seeded guest was invited by this gun, so the name stays with that record.
    assert.equal(m.name, 'A Gun')
    await prisma.guestGun.deleteMany({ where: { invitedByMemberId: data.a.gun.id } })
    await runRetention(prisma, NOW)
    assert.equal((await prisma.member.findUniqueOrThrow({ where: { id: data.a.gun.id } })).name, FORMER_MEMBER)
  })

  it('a beater who left 12 months ago loses contact details once nothing is owed; the name goes once no payment needs it', async () => {
    await prisma.beater.update({ where: { id: data.a.beater.id }, data: { status: 'INACTIVE', leftAt: daysAgo(370), email: 'b@example.com', phone: '0770' } })
    // Still owed: their details are how they get paid, so they stay.
    await runRetention(prisma, NOW)
    assert.equal((await prisma.beater.findUniqueOrThrow({ where: { id: data.a.beater.id } })).phone, '0770')
    await prisma.beaterPayment.updateMany({ where: { beaterId: data.a.beater.id }, data: { status: 'PAID', paidDate: daysAgo(200) } })
    await prisma.beater.update({ where: { id: data.a.beater.id }, data: { status: 'INACTIVE', leftAt: daysAgo(370), email: 'b@example.com', phone: '0770' } })
    await runRetention(prisma, NOW)
    const b = await prisma.beater.findUniqueOrThrow({ where: { id: data.a.beater.id } })
    assert.deepEqual([b.email, b.phone, b.name], [null, null, 'A Beater'])
    await prisma.beaterPayment.deleteMany({ where: { beaterId: data.a.beater.id } })
    await runRetention(prisma, NOW)
    assert.equal((await prisma.beater.findUniqueOrThrow({ where: { id: data.a.beater.id } })).name, FORMER_BEATER)
  })

  it('a syndicate whose plan ended 90 days ago is deleted with everything; one day sooner it is not; a live one never', async () => {
    await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionStatus: 'CANCELLED', planEndedAt: daysAgo(89) } })
    await runRetention(prisma, NOW)
    assert.ok(await prisma.syndicate.findUnique({ where: { id: data.a.syndicate.id } }))
    await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { planEndedAt: daysAgo(90) } })
    // Live again but the clock wasn't cleared (a webhook missed): still never deleted.
    await prisma.syndicate.update({ where: { id: data.b.syndicate.id }, data: { stripeSubscriptionStatus: 'ACTIVE', planEndedAt: daysAgo(400) } })
    const result = await runRetention(prisma, NOW)
    assert.equal(result.syndicatesDeleted, 1)
    assert.equal(await prisma.syndicate.findUnique({ where: { id: data.a.syndicate.id } }), null)
    for (const table of ['member', 'beater', 'shootDay', 'bagRecord', 'guestGun', 'beaterPayment', 'activityLog'] as const) {
      const count = await (prisma[table] as unknown as { count: (a: unknown) => Promise<number> }).count({ where: table === 'bagRecord' || table === 'guestGun' ? { shootDay: { syndicateId: data.a.syndicate.id } } : { syndicateId: data.a.syndicate.id } })
      assert.equal(count, 0, table)
    }
    assert.ok(await prisma.syndicate.findUnique({ where: { id: data.b.syndicate.id } }))
  })

  it('a syndicate that never chose a plan is deleted 90 days after it was set up', async () => {
    const empty = await prisma.syndicate.create({ data: { name: 'Never paid', captainClerkId: CAPTAIN_A, seasonStart: new Date('2026-10-01'), seasonEnd: new Date('2027-02-01'), createdAt: daysAgo(91) } })
    const fresh = await prisma.syndicate.create({ data: { name: 'Just made', captainClerkId: CAPTAIN_A, seasonStart: new Date('2026-10-01'), seasonEnd: new Date('2027-02-01'), createdAt: daysAgo(80) } })
    await runRetention(prisma, NOW)
    assert.equal(await prisma.syndicate.findUnique({ where: { id: empty.id } }), null)
    assert.ok(await prisma.syndicate.findUnique({ where: { id: fresh.id } }))
  })

  it('records what it removed in each syndicate’s trail, counts only; a second run finds nothing', async () => {
    const old = await shootOn(daysAgo(40))
    await prisma.guestGun.create({ data: { shootId: old.id, invitedByMemberId: data.a.gun.id, name: 'Never', email: 'n@example.com' } })
    await runRetention(prisma, NOW)
    const entry = await prisma.activityLog.findFirstOrThrow({ where: { syndicateId: data.a.syndicate.id, action: 'Records past their retention period removed' } })
    assert.deepEqual([entry.actorRole, entry.details], ['system', { 'guests who never accepted': 1 }])
    const again = await runRetention(prisma, NOW)
    const { ran, ...counts } = again
    assert.equal(ran, true)
    assert.ok(Object.values(counts).every((n) => n === 0), JSON.stringify(counts))
  })

  it('only one server runs it at a time', async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7301026)`
      const other = createTestPrisma()
      try {
        assert.equal((await runRetention(other, NOW)).ran, false)
      } finally {
        await other.$disconnect()
      }
    })
  })
})

describe('export and erasure', () => {
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

  it('the export holds everything for the syndicate, bank details opened, and nothing of anyone else’s or ShootSync’s own', async () => {
    await prisma.activityLog.create({ data: { syndicateId: data.a.syndicate.id, action: 'Plan status changed', actorRole: 'stripe', details: { from: null, to: 'ACTIVE', subscription: 'sub_secret_x' } } })
    const res = await call(server, `/api/syndicates/${data.a.syndicate.id}/export`, { method: 'POST', as: CAPTAIN_A })
    assert.equal(res.status, 200)
    assert.ok(res.json.activity.some((a: { details: { to?: string } }) => a.details?.to === 'ACTIVE'))
    assert.equal(res.headers.get('cache-control'), 'no-store')
    const doc = res.json
    assert.equal(doc.format, EXPORT_FORMAT)
    assert.equal(doc.syndicate.id, data.a.syndicate.id)
    assert.deepEqual(doc.beaters.map((b: { bankSortCode: string; bankAccountNumber: string }) => [b.bankSortCode, b.bankAccountNumber]), [['12-34-56', '12345678']])
    assert.equal(doc.beaters[0].bankDetailsSealed, undefined)
    assert.ok(doc.members.length >= 2 && doc.shootDays.length >= 1 && doc.bags.length >= 1 && doc.guests.length >= 1 && doc.beaterPayments.length >= 1)
    const text = JSON.stringify(doc)
    for (const forbidden of [data.b.syndicate.id, 'cus_secret', 'sub_secret_x', 'inviteToken', 'stripeSubscriptionId', 'stripeCustomerId', 'sess_']) assert.equal(text.includes(forbidden), false, forbidden)
    assert.equal((await call(server, `/api/syndicates/${data.a.syndicate.id}/export`, { method: 'POST', as: GUN_A })).status, 404)
  })

  it('a member’s details are erased on request once they have been removed; the name stays where a record needs it', async () => {
    assert.equal((await call(server, `/api/members/${data.a.gun.id}/erase`, { method: 'POST', as: CAPTAIN_A })).status, 409)
    await prisma.member.update({ where: { id: data.a.gun.id }, data: { status: 'INACTIVE', phone: '0770', bascNumber: 'B1' } })
    const res = await call(server, `/api/members/${data.a.gun.id}/erase`, { method: 'POST', as: CAPTAIN_A })
    assert.equal(res.status, 200)
    assert.equal(res.json.nameKept, true)
    const m = await prisma.member.findUniqueOrThrow({ where: { id: data.a.gun.id } })
    assert.deepEqual([m.name, m.phone, m.bascNumber, m.emergencyContactName, m.email.endsWith('@removed.invalid'), m.clerkUserId.startsWith('removed_')], ['A Gun', null, null, null, true, true])
  })

  it('a beater’s details are erased once removed and paid; while owed money, never', async () => {
    await prisma.beater.update({ where: { id: data.a.beater.id }, data: { status: 'INACTIVE', email: 'b@example.com' } })
    const owed = await call(server, `/api/beaters/${data.a.beater.id}/erase`, { method: 'POST', as: CAPTAIN_A })
    assert.equal(owed.status, 409)
    assert.match(owed.json.error, /still owed money/)
    await prisma.beaterPayment.updateMany({ where: { beaterId: data.a.beater.id }, data: { status: 'PAID', paidDate: new Date() } })
    const res = await call(server, `/api/beaters/${data.a.beater.id}/erase`, { method: 'POST', as: CAPTAIN_A })
    assert.equal(res.status, 200)
    const b = await prisma.beater.findUniqueOrThrow({ where: { id: data.a.beater.id } })
    assert.deepEqual([b.name, b.email, b.bankDetailsSealed, b.bankAccountLast4], ['A Beater', null, null, null])
  })

  it('a guest who signed is kept on record without contact details; one who never did is removed; never before the day', async () => {
    assert.equal((await call(server, `/api/guests/${data.a.guest.id}/erase`, { method: 'POST', as: CAPTAIN_A })).status, 409)
    await prisma.shootDay.update({ where: { id: data.a.shoot.id }, data: { status: 'COMPLETED' } })
    await prisma.guestGun.update({ where: { id: data.a.guest.id }, data: { waiverAccepted: true, emergencyContactName: 'Jo', phone: '0770' } })
    const res = await call(server, `/api/guests/${data.a.guest.id}/erase`, { method: 'POST', as: CAPTAIN_A })
    assert.equal(res.json.nameKept, true)
    const g = await prisma.guestGun.findUniqueOrThrow({ where: { id: data.a.guest.id } })
    assert.deepEqual([g.phone, g.emergencyContactName, g.inviteToken, g.waiverAccepted, g.email.endsWith('@removed.invalid')], [null, null, null, true, true])
    const other = await prisma.guestGun.create({ data: { shootId: data.a.shoot.id, invitedByMemberId: data.a.gun.id, name: 'Never', email: 'n@example.com' } })
    assert.equal((await call(server, `/api/guests/${other.id}/erase`, { method: 'POST', as: CAPTAIN_A })).json.nameKept, false)
    assert.equal(await prisma.guestGun.findUnique({ where: { id: other.id } }), null)
  })

  it('the captain is told when an ended syndicate will be deleted', async () => {
    await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionStatus: 'CANCELLED', planEndedAt: new Date('2026-11-01T00:00:00Z') } })
    const res = await call(server, `/api/subscriptions/status/${data.a.syndicate.id}`, { as: CAPTAIN_A })
    assert.equal(res.json.deletionDate, '2027-01-30T00:00:00.000Z')
    await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionStatus: 'ACTIVE' } })
    assert.equal((await call(server, `/api/subscriptions/status/${data.a.syndicate.id}`, { as: CAPTAIN_A })).json.deletionDate, null)
  })

  it('archiving starts the clock; a date with an impossible year is refused', async () => {
    await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionStatus: null, stripeSubscriptionId: null } })
    assert.equal((await call(server, `/api/syndicates/${data.a.syndicate.id}`, { method: 'DELETE', as: CAPTAIN_A })).status, 200)
    assert.ok((await prisma.syndicate.findUniqueOrThrow({ where: { id: data.a.syndicate.id } })).planEndedAt)
    const bad = await call(server, `/api/syndicates/${data.b.syndicate.id}`, { method: 'PATCH', as: 'user_captainB', body: { seasonEnd: '0028-02-28' } })
    assert.equal(bad.status, 400)
    assert.match(JSON.stringify(bad.json), /four-digit year/)
    // Not a real day: refused, never rolled on to March.
    const notADay = await call(server, `/api/syndicates/${data.b.syndicate.id}`, { method: 'PATCH', as: 'user_captainB', body: { seasonEnd: '2027-02-31' } })
    assert.equal(notADay.status, 400)
    assert.match(JSON.stringify(notADay.json), /real date/)
    assert.equal((await call(server, `/api/syndicates/${data.b.syndicate.id}`, { method: 'PATCH', as: 'user_captainB', body: { seasonEnd: '12' } })).status, 400)
  })
})
