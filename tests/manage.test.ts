/**
 * Managing the syndicate: settings that really save, editing beaters (bank details kept
 * private and only replaced on purpose), and editing, cancelling or deleting shoot days
 * without losing a record of who paid.
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { settingsPayload, toForm, validateSettings } from '../src/utils/syndicateSettings.js'
import { emptyDraft, payloadFrom } from '../src/utils/beaterForm.js'
import { normaliseWhat3Words, shootPayload, validateShoot, type ShootDraft } from '../src/utils/shootForm.js'
import { CAPTAIN_A, call, createTestPrisma, createTestStripe, resetDatabase, seed, startTestServer, type TestServer, acceptBody } from './helpers.js'

const settings = {
  id: 's', name: 'Beatrice', seasonStart: '2026-10-01T00:00:00.000Z', seasonEnd: '2027-02-01T00:00:00.000Z',
  subscriptionAmount: 800, subscriptionType: 'ANNUAL' as const, defaultBeaterRate: 40, pegRotationRule: 'FAIR_ROTATION' as const,
}

const shootDraft: ShootDraft = {
  date: '2026-11-21', locationName: 'Oakwood', locationAddress: '', locationPostcode: 'tr1 1aa', locationWhat3Words: '///Filled.Count.Soap',
  meetTime: '08:30', drivesPlanned: '5', expectedBag: '', captainNotes: '',
}

describe('form checks', () => {
  it('settings: a season must end after it starts, and money is whole pounds', () => {
    assert.deepEqual(validateSettings(toForm(settings)), {})
    const form = toForm(settings)
    assert.ok(validateSettings({ ...form, seasonEnd: '2026-09-01' }).seasonEnd)
    assert.ok(validateSettings({ ...form, subscriptionAmount: '800.50' }).subscriptionAmount)
    assert.ok(validateSettings({ ...form, defaultBeaterRate: '1001' }).defaultBeaterRate)
    assert.ok(validateSettings({ ...form, name: '  ' }).name)
  })

  it('settings send only what changed, so a "manual" peg setting is kept unless changed here', () => {
    const manual = { ...settings, pegRotationRule: 'MANUAL' as const }
    const form = toForm(manual)
    assert.deepEqual(settingsPayload({ ...form, name: 'Oakwood' }, manual), { name: 'Oakwood' })
    assert.deepEqual(settingsPayload({ ...form, pegRotationRule: 'RANDOM' }, manual), { pegRotationRule: 'RANDOM' })
    assert.deepEqual(settingsPayload(form, manual), {})
  })

  it('beaters: a sort code without an account number (or the reverse) is refused', () => {
    assert.ok('error' in payloadFrom({ ...emptyDraft(40), name: 'Dai', bankSortCode: '123456' }, true))
    assert.ok('error' in payloadFrom({ ...emptyDraft(40), name: 'Dai', bankAccountNumber: '12345678' }, false))
  })

  it('beaters: blank bank fields on an edit keep what is saved; blank contact fields clear', () => {
    const draft = { ...emptyDraft(40), name: 'Dai', phone: '', bankSortCode: '', bankAccountNumber: '' }
    const edit = payloadFrom(draft, true)
    const body = 'body' in edit ? edit.body : undefined
    assert.ok(body)
    assert.equal('bankSortCode' in body, false)
    assert.equal('bankAccountNumber' in body, false)
    assert.equal(body.phone, null)
    assert.ok('error' in payloadFrom({ ...draft, dayRate: '40.5' }, true))
  })

  it('shoot days: what3words is tidied, the meet time must be a real time, blanks clear', () => {
    assert.equal(normaliseWhat3Words('///Filled.Count.Soap'), 'filled.count.soap')
    assert.equal(normaliseWhat3Words('filled count soap'), null)
    assert.deepEqual(validateShoot(shootDraft), {})
    assert.ok(validateShoot({ ...shootDraft, meetTime: '25:00' }).meetTime)
    assert.ok(validateShoot({ ...shootDraft, drivesPlanned: '0' }).drivesPlanned)
    const payload = shootPayload(shootDraft)
    assert.deepEqual([payload.locationPostcode, payload.locationWhat3Words, payload.locationAddress, payload.expectedBag], ['TR1 1AA', 'filled.count.soap', null, null])
  })
})

describe('managing the syndicate (API)', () => {
  let prisma: PrismaClient
  let server: TestServer
  let data: Awaited<ReturnType<typeof seed>>

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

  const as = (method: string, path: string, body?: unknown) => call(server, path, { method, as: CAPTAIN_A, body })

  it('settings save, and are what the next load shows', async () => {
    const id = data.a.syndicate.id
    const res = await as('PATCH', `/api/syndicates/${id}`, { name: 'Oakwood Guns', subscriptionAmount: 950, defaultBeaterRate: 45, pegRotationRule: 'RANDOM' })
    assert.equal(res.status, 200)
    const [syndicate] = (await as('GET', '/api/syndicates')).json
    assert.deepEqual([syndicate.name, syndicate.subscriptionAmount, syndicate.defaultBeaterRate, syndicate.pegRotationRule], ['Oakwood Guns', 950, 45, 'RANDOM'])
  })

  it('moving only one end of the season still cannot put the end before the start', async () => {
    const id = data.a.syndicate.id // season 1 Oct 2026 to 1 Feb 2027
    assert.equal((await as('PATCH', `/api/syndicates/${id}`, { seasonEnd: '2026-09-01' })).status, 400)
    assert.equal((await as('PATCH', `/api/syndicates/${id}`, { seasonStart: '2027-03-01' })).status, 400)
    assert.equal((await as('PATCH', `/api/syndicates/${id}`, { seasonStart: '2026-09-01' })).status, 200)
  })

  it('editing a beater keeps their bank details unless new ones are typed, and tidies them', async () => {
    const id = data.a.beater.id // seeded with 12-34-56 / 12345678
    assert.equal((await as('PATCH', `/api/beaters/${id}`, { name: 'Dai Morgan', dayRate: 45, phone: '07700 900111' })).status, 200)
    let beater = await prisma.beater.findUniqueOrThrow({ where: { id } })
    assert.deepEqual([beater.name, beater.dayRate, beater.bankSortCode, beater.bankAccountNumber], ['Dai Morgan', 45, '12-34-56', '12345678'])

    assert.equal((await as('PATCH', `/api/beaters/${id}`, { bankSortCode: '30 90 12', bankAccountNumber: '0123-4567' })).status, 200)
    beater = await prisma.beater.findUniqueOrThrow({ where: { id } })
    assert.deepEqual([beater.bankSortCode, beater.bankAccountNumber], ['30-90-12', '01234567'])

    assert.equal((await as('PATCH', `/api/beaters/${id}`, { bankAccountNumber: '123' })).status, 400)

    // Blank bank fields (an older form, or a cleared box) keep what is saved.
    assert.equal((await as('PATCH', `/api/beaters/${id}`, { bankSortCode: '', bankAccountNumber: '' })).status, 200)
    beater = await prisma.beater.findUniqueOrThrow({ where: { id } })
    assert.deepEqual([beater.bankSortCode, beater.bankAccountNumber], ['30-90-12', '01234567'])
  })

  it('a beater edit never sends bank numbers back to the browser', async () => {
    const res = await as('PATCH', `/api/beaters/${data.a.beater.id}`, { name: 'Dai' })
    assert.equal('bankAccountNumber' in res.json, false)
    assert.equal('bankSortCode' in res.json, false)
    assert.equal(res.json.bankAccountLast4, '5678')
  })

  it('contact details can be cleared, bank details deleted, and a beater made inactive and back', async () => {
    const id = data.a.beater.id
    await as('PATCH', `/api/beaters/${id}`, { email: 'dai@example.com', phone: '0770' })
    assert.equal((await as('PATCH', `/api/beaters/${id}`, { email: '', phone: null })).status, 200)
    let beater = await prisma.beater.findUniqueOrThrow({ where: { id } })
    assert.deepEqual([beater.email, beater.phone], [null, null])

    assert.equal((await as('PATCH', `/api/beaters/${id}`, { clearBankDetails: true })).status, 200)
    beater = await prisma.beater.findUniqueOrThrow({ where: { id } })
    assert.deepEqual([beater.bankName, beater.bankSortCode, beater.bankAccountNumber], [null, null, null])

    assert.equal((await as('PATCH', `/api/beaters/${id}`, { status: 'INACTIVE' })).status, 200)
    assert.equal((await prisma.beater.findUniqueOrThrow({ where: { id } })).status, 'INACTIVE')
    assert.equal((await as('PATCH', `/api/beaters/${id}`, { status: 'ACTIVE' })).status, 200)
    assert.equal((await prisma.beater.findUniqueOrThrow({ where: { id } })).status, 'ACTIVE')
  })

  it('a shoot day can be edited and its optional details cleared; the meet time must be a real time', async () => {
    const id = data.a.shoot.id
    await prisma.beaterPayment.deleteMany({ where: { shootId: id } }) // a scheduled day owes nothing yet
    const res = await as('PATCH', `/api/shoots/${id}`, { ...shootPayload(shootDraft), captainNotes: null, locationAddress: null })
    assert.equal(res.status, 200)
    const shoot = await prisma.shootDay.findUniqueOrThrow({ where: { id } })
    assert.deepEqual(
      [shoot.locationName, shoot.locationWhat3Words, shoot.locationPostcode, shoot.captainNotes, shoot.drivesPlanned],
      ['Oakwood', 'filled.count.soap', 'TR1 1AA', null, 5]
    )
    assert.equal((await as('PATCH', `/api/shoots/${id}`, { meetTime: '8.30am' })).status, 400)
  })

  it('a new shoot day with no meet time starts at 08:30', async () => {
    const res = await as('POST', '/api/shoots', { syndicateId: data.a.syndicate.id, date: '2026-12-12', locationName: 'Top Wood', meetTime: '' })
    assert.equal(res.status, 201)
    assert.equal(res.json.meetTime, '08:30')
  })

  it('a day where a guest has paid cannot be deleted, so the payment record survives; it can be cancelled', async () => {
    const shootId = data.a.shoot.id
    await prisma.beaterPayment.deleteMany({ where: { shootId } })
    await prisma.guestGun.update({ where: { id: data.a.guest.id }, data: { paymentStatus: 'PAID' } })
    assert.equal((await as('DELETE', `/api/shoots/${shootId}`)).status, 409)
    assert.equal((await prisma.guestGun.findUniqueOrThrow({ where: { id: data.a.guest.id } })).paymentStatus, 'PAID')
    assert.equal((await as('POST', `/api/shoots/${shootId}/cancel`)).status, 200)
  })

  it('guests: paid or refunded stay on record; one at the payment stage is withdrawn; one who never got there is removed', async () => {
    const guestId = data.a.guest.id
    for (const paymentStatus of ['PAID', 'REFUNDED'] as const) {
      await prisma.guestGun.update({ where: { id: guestId }, data: { paymentStatus } })
      assert.equal((await as('DELETE', `/api/guests/${guestId}`)).status, 409, paymentStatus)
      assert.ok(await prisma.guestGun.findUnique({ where: { id: guestId } }))
    }
    // Signed the waiver, not paid yet: may be on the card page, so withdrawn, not deleted.
    await prisma.guestGun.update({ where: { id: guestId }, data: { paymentStatus: 'PENDING', rsvpStatus: 'CONFIRMED', waiverAccepted: true } })
    const withdrawn = await as('DELETE', `/api/guests/${guestId}`)
    assert.deepEqual([withdrawn.status, withdrawn.json.withdrawn], [200, true])
    assert.equal((await prisma.guestGun.findUniqueOrThrow({ where: { id: guestId } })).rsvpStatus, 'DECLINED')
    const accept = await call(server, `/api/guests/token/${data.a.guest.inviteToken}/accept`, {
      method: 'POST', body: acceptBody(),
    })
    assert.equal(accept.status, 409, 'a withdrawn guest cannot accept again')
    // Never reached payment: removed.
    await prisma.guestGun.update({ where: { id: guestId }, data: { waiverAccepted: false, rsvpStatus: 'PENDING' } })
    assert.equal((await as('DELETE', `/api/guests/${guestId}`)).status, 200)
    assert.equal(await prisma.guestGun.findUnique({ where: { id: guestId } }), null)
  })

  it('a completed day cannot be cancelled, so what beaters are owed is never wiped', async () => {
    const shootId = data.a.shoot.id // seed: beater confirmed, £40 owed
    assert.equal((await as('POST', `/api/shoots/${shootId}/complete`)).status, 200)
    assert.equal((await as('POST', `/api/shoots/${shootId}/cancel`)).status, 409)
    assert.equal(await prisma.beaterPayment.count({ where: { shootId, status: 'PENDING' } }), 1)
  })

  it('the date of a completed day cannot move; its other details can', async () => {
    const shootId = data.a.shoot.id
    await as('POST', `/api/shoots/${shootId}/complete`)
    assert.equal((await as('PATCH', `/api/shoots/${shootId}`, { date: '2027-04-07' })).status, 409)
    assert.equal((await as('PATCH', `/api/shoots/${shootId}`, { date: '2026-11-14', captainNotes: 'Wet day' })).status, 200, 'same date is fine')
    assert.equal((await prisma.shootDay.findUniqueOrThrow({ where: { id: shootId } })).captainNotes, 'Wet day')
  })

  it('bank details must be given in full, and a bad email says so', async () => {
    const id = data.a.beater.id
    assert.equal((await as('PATCH', `/api/beaters/${id}`, { bankSortCode: '30-90-12' })).status, 400)
    assert.equal((await as('POST', '/api/beaters', { syndicateId: data.a.syndicate.id, name: 'X', bankAccountNumber: '12345678' })).status, 400)
    const email = await as('PATCH', `/api/beaters/${id}`, { email: 'not-an-email' })
    assert.equal(email.status, 400)
    assert.match(JSON.stringify(email.json), /email address/)
  })

  it('edits can never reassign a record or set what only the server sets', async () => {
    const a = data.a
    await as('PATCH', `/api/syndicates/${a.syndicate.id}`, { name: 'Ok', captainClerkId: 'user_attacker', stripeCustomerId: 'cus_x', stripeSubscriptionStatus: 'active', status: 'ARCHIVED' })
    const syndicate = await prisma.syndicate.findUniqueOrThrow({ where: { id: a.syndicate.id } })
    assert.deepEqual([syndicate.captainClerkId, syndicate.stripeCustomerId, syndicate.status], [CAPTAIN_A, 'cus_secret_A', 'ACTIVE'])

    await as('PATCH', `/api/shoots/${a.shoot.id}`, { locationName: 'Ok', syndicateId: data.b.syndicate.id, status: 'COMPLETED' })
    const shoot = await prisma.shootDay.findUniqueOrThrow({ where: { id: a.shoot.id } })
    assert.deepEqual([shoot.syndicateId, shoot.status], [a.syndicate.id, 'SCHEDULED'])

    await as('PATCH', `/api/beaters/${a.beater.id}`, { name: 'Ok', syndicateId: data.b.syndicate.id })
    assert.equal((await prisma.beater.findUniqueOrThrow({ where: { id: a.beater.id } })).syndicateId, a.syndicate.id)
  })
})
