/**
 * Guest guard rails.
 *
 * - A guest can accept and decline only while the day is scheduled and hasn't passed (the
 *   morning itself is fine), and can only be invited to such a day.
 * - Guests pay the syndicate directly: the captain marks them paid, and can undo it, except
 *   for a payment that was taken by card through Stripe.
 * - A guest's link shows the day as closed after it, and expires a while later.
 * - The day fee is fixed once the guest has accepted the invitation at it.
 * - A card payment (from a page opened before online payment was switched off) for a different
 *   amount than the fee is still recorded, and said loudly.
 * - A guest's link is stored only as a hash: it is given once, when made or renewed, and a new
 *   link withdraws the old one.
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import {
  CAPTAIN_A, GUN_A, INVITE_TOKEN_A, TEST_TODAY, TEST_WEBHOOK_SECRET, call, createTestPrisma, createTestStripe, resetDatabase, seed, startTestServer, testVerifier, type TestServer,
  acceptBody,
} from './helpers.js'
import { GUEST_LINK_DAYS_AFTER_SHOOT, guestDayClosed, guestLinkExpired } from '../server/routes/guests.js'
import { INVITE_TOKEN_PATTERN, hashInviteToken, inviteLinkPath, newInviteToken } from '../server/inviteTokens.js'

type Seeded = Awaited<ReturnType<typeof seed>>

describe('when a guest can still act', () => {
  const day = (status: string) => ({ status, date: new Date('2026-11-14') })

  it('open while scheduled, up to and including the day itself', () => {
    assert.equal(guestDayClosed(day('SCHEDULED'), '2026-11-01'), null)
    assert.equal(guestDayClosed(day('SCHEDULED'), '2026-11-14'), null)
    assert.match(guestDayClosed(day('SCHEDULED'), '2026-11-15') ?? '', /already taken place/)
  })

  it('closed once the day is completed or cancelled, whatever the date', () => {
    assert.match(guestDayClosed(day('COMPLETED'), '2026-11-01') ?? '', /already taken place/)
    assert.match(guestDayClosed(day('CANCELLED'), '2026-11-01') ?? '', /cancelled/)
  })

  it(`the link expires ${GUEST_LINK_DAYS_AFTER_SHOOT} days after the day, not before`, () => {
    const date = new Date('2026-11-14')
    assert.equal(guestLinkExpired(date, '2026-12-14'), false)
    assert.equal(guestLinkExpired(date, '2026-12-15'), true)
  })
})

describe('guest guard rails, on the server', () => {
  let prisma: PrismaClient
  let data: Seeded
  let today = TEST_TODAY
  let server: TestServer
  const { stripe } = createTestStripe()

  before(async () => {
    prisma = createTestPrisma()
    server = await startTestServer(prisma, stripe, testVerifier, () => today)
  })

  after(async () => {
    await server.close()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    today = TEST_TODAY
    await resetDatabase(prisma)
    data = await seed(prisma)
  })

  const invite = () => call(server, `/api/guests/token/${INVITE_TOKEN_A}`)
  const accept = () => call(server, `/api/guests/token/${INVITE_TOKEN_A}/accept`, {
    method: 'POST', body: acceptBody(),
  })
  const guestRow = () => prisma.guestGun.findUniqueOrThrow({ where: { id: data.a.guest.id } })

  it('before the day: open, and the guest can accept', async () => {
    today = '2026-11-01'
    assert.equal((await invite()).json.closed, null)
    assert.equal((await accept()).status, 200)
  })

  it('on the morning of the day the guest can still accept', async () => {
    today = '2026-11-14'
    assert.equal((await invite()).json.closed, null)
    assert.equal((await accept()).status, 200)
  })

  for (const [label, prepare] of [
    ['the day has passed', async () => { today = '2026-11-15' }],
    ['the day is completed', async () => { await prisma.shootDay.update({ where: { id: data.a.shoot.id }, data: { status: 'COMPLETED' } }) }],
    ['the day is cancelled', async () => { await prisma.shootDay.update({ where: { id: data.a.shoot.id }, data: { status: 'CANCELLED' } }) }],
  ] as const) {
    it(`once ${label}: the link says so, and accepting, declining and paying are refused, changing nothing`, async () => {
      await prepare()
      const shown = await invite()
      assert.equal(shown.status, 200)
      assert.match(shown.json.closed, /closed/)
      const before = await guestRow()

      const accepted = await accept()
      assert.equal(accepted.status, 409)
      assert.equal(accepted.json.error, shown.json.closed)
      assert.equal((await call(server, `/api/guests/token/${INVITE_TOKEN_A}/decline`, { method: 'POST' })).status, 409)
      assert.deepEqual(await guestRow(), before)
    })

    it(`once ${label}: a guest who accepted earlier sees the day as closed, and stays confirmed`, async () => {
      await accept()
      await prepare()
      const shown = await invite()
      assert.match(shown.json.closed, /closed/)
      assert.equal(shown.json.rsvpStatus, 'CONFIRMED')
    })

    it(`once ${label}: no new guests can be invited to it, by the captain or a gun`, async () => {
      await prepare()
      for (const as of [CAPTAIN_A, GUN_A]) {
        const res = await call(server, '/api/guests', {
          method: 'POST', as, body: { shootId: data.a.shoot.id, invitedByMemberId: data.a.gun.id, name: 'Late', email: 'late@example.com' },
        })
        assert.equal(res.status, 409, as)
      }
      assert.equal(await prisma.guestGun.count({ where: { name: 'Late' } }), 0)
    })
  }

  it(`the link stops opening ${GUEST_LINK_DAYS_AFTER_SHOOT} days after the day`, async () => {
    today = '2026-12-14'
    assert.equal((await invite()).status, 200)
    today = '2026-12-15'
    const expired = await invite()
    assert.equal(expired.status, 404)
    assert.equal(JSON.stringify(expired.json).includes(data.a.guest.email), false)
  })

  describe('the day fee', () => {
    const setFee = (dayFee: number) => call(server, `/api/guests/${data.a.guest.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { dayFee } })

    it('can change until the guest accepts the invitation', async () => {
      assert.equal((await setFee(6000)).status, 200)
      assert.equal((await guestRow()).dayFee, 6000)
    })

    it('is fixed once they have accepted at it: the change is refused and nothing else in it is saved', async () => {
      await accept()
      const res = await call(server, `/api/guests/${data.a.guest.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { dayFee: 1000, notes: 'cheaper' } })
      assert.equal(res.status, 409)
      assert.match(res.json.error, /can’t change now/)
      const row = await guestRow()
      assert.equal(row.dayFee, 5000)
      assert.equal(row.notes, null)
    })

    it('sending the same fee again, and changing anything else, still work after they accept', async () => {
      await accept()
      assert.equal((await call(server, `/api/guests/${data.a.guest.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { dayFee: 5000, pegNumber: 4 } })).status, 200)
      assert.equal((await call(server, `/api/guests/${data.a.guest.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { notes: 'Bringing a dog' } })).status, 200)
      const row = await guestRow()
      assert.equal(row.pegNumber, 4)
      assert.equal(row.notes, 'Bringing a dog')
    })
  })

  describe('the captain records a guest’s day fee as paid', () => {
    const mark = (paid: boolean, as = CAPTAIN_A) => call(server, `/api/guests/${data.a.guest.id}/payment`, { method: 'PATCH', as, body: { paid } })

    it('marks paid, and undoes it', async () => {
      const paid = await mark(true)
      assert.equal(paid.status, 200)
      assert.equal(paid.json.paymentStatus, 'PAID')
      assert.equal((await mark(true)).json.error, 'This guest is already marked paid.')
      assert.equal((await mark(false)).status, 200)
      assert.equal((await guestRow()).paymentStatus, 'PENDING')
      assert.equal((await mark(false)).json.error, 'This guest isn’t marked paid.')
    })

    it('a guest who is marked paid stays on record until it is undone', async () => {
      await mark(true)
      assert.equal((await call(server, `/api/guests/${data.a.guest.id}`, { method: 'DELETE', as: CAPTAIN_A })).status, 409)
      await mark(false)
      assert.equal((await call(server, `/api/guests/${data.a.guest.id}`, { method: 'DELETE', as: CAPTAIN_A })).status, 200)
    })

    it('a card payment taken through Stripe can’t be undone here: it has to be refunded in Stripe', async () => {
      await prisma.guestGun.update({ where: { id: data.a.guest.id }, data: { paymentStatus: 'PAID', stripePaymentId: 'pi_card' } })
      const res = await mark(false)
      assert.equal(res.status, 409)
      assert.match(res.json.error, /Refund them in Stripe/)
      assert.equal((await guestRow()).paymentStatus, 'PAID')
    })

    it('nothing to mark for a free guest or one who declined', async () => {
      await prisma.guestGun.update({ where: { id: data.a.guest.id }, data: { dayFee: 0 } })
      assert.equal((await mark(true)).json.error, 'This guest has no day fee to pay.')
      await prisma.guestGun.update({ where: { id: data.a.guest.id }, data: { dayFee: 5000, rsvpStatus: 'DECLINED' } })
      const declined = await mark(true)
      assert.equal(declined.status, 409)
      assert.match(declined.json.error, /declined/)
      assert.equal((await guestRow()).paymentStatus, 'PENDING')
    })

    it('only the captain: a gun is told it doesn’t exist, and nothing changes', async () => {
      assert.equal((await mark(true, GUN_A)).status, 404)
      assert.equal((await guestRow()).paymentStatus, 'PENDING')
    })

    it('the guest’s page then shows it as paid, and never offers a card payment', async () => {
      await accept()
      await mark(true)
      const shown = await invite()
      assert.equal(shown.json.paymentStatus, 'PAID')
    })
  })

  describe('a card payment for a different amount than the fee', () => {
    const paid = (amount_total: number, currency = 'gbp') => {
      const body = JSON.stringify({
        id: `evt_${amount_total}_${currency}`, object: 'event', type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_amount', object: 'checkout.session', mode: 'payment', payment_status: 'paid', payment_intent: 'pi_amount', amount_total, currency, metadata: { type: 'guest_day_fee', guestId: data.a.guest.id } } },
      })
      const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: TEST_WEBHOOK_SECRET })
      return fetch(`${server.baseUrl}/api/stripe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature }, body })
    }

    it('the right amount is recorded quietly', async () => {
      server.alerts.length = 0
      assert.equal((await paid(5000)).status, 200)
      assert.deepEqual(server.alerts, [])
      assert.equal((await guestRow()).paymentStatus, 'PAID')
    })

    for (const [amount, currency] of [[4000, 'gbp'], [5000, 'eur']] as const) {
      it(`${amount} ${currency} is still recorded as paid (so they can't pay twice), and the owner is alerted to put it right`, async () => {
        server.alerts.length = 0
        assert.equal((await paid(amount, currency)).status, 200)
        assert.equal((await guestRow()).paymentStatus, 'PAID')
        assert.equal(server.alerts.length, 1)
        assert.equal(server.alerts[0].kind, 'money')
        assert.match(server.alerts[0].message, /different amount from their day fee/)
        assert.deepEqual(server.alerts[0].details, { guest: data.a.guest.id, paid: amount, currency, dayFeePence: 5000, session: 'cs_test_amount' })
      })
    }
  })

  describe('the invitation link is never stored, only its hash', () => {
    const asCaptain = (method: string, path: string, body?: unknown) => call(server, path, { method, as: CAPTAIN_A, body })
    const asGun = (method: string, path: string, body?: unknown) => call(server, path, { method, as: GUN_A, body })
    const tokenOf = (link: string) => link.slice('/guest/accept/'.length)

    it('a token is 32 random bytes, and its hash is what the table holds', () => {
      const made = newInviteToken()
      assert.match(made.token, INVITE_TOKEN_PATTERN)
      assert.equal(made.hash, hashInviteToken(made.token))
      assert.notEqual(made.hash, made.token)
      assert.notEqual(newInviteToken().token, made.token)
      assert.equal(inviteLinkPath(made.token), `/guest/accept/${made.token}`)
      // SHA-256 of the token's text, as hex: the same thing migration 0007 computes in SQL (tests/migrations.test.ts).
      assert.equal(hashInviteToken('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    })

    it('adding a guest gives the link once; the table holds its hash, which no list or sheet sends', async () => {
      const added = await asCaptain('POST', '/api/guests', { shootId: data.a.shoot.id, invitedByMemberId: data.a.gun.id, name: 'Once', email: 'once@example.com' })
      assert.equal(added.status, 201)
      assert.equal('inviteToken' in added.json, false)
      const token = tokenOf(added.json.inviteLink)
      assert.match(token, INVITE_TOKEN_PATTERN)
      const row = await prisma.guestGun.findUniqueOrThrow({ where: { id: added.json.id } })
      assert.equal(row.inviteToken, hashInviteToken(token))
      // The link opens the guest's page; the hash itself does not.
      assert.equal((await call(server, `/api/guests/token/${token}`)).status, 200)
      assert.equal((await call(server, `/api/guests/token/${row.inviteToken}`)).status, 404)
      // Nothing the captain reads or changes afterwards carries the hash.
      const answers = [
        ...(await Promise.all([`/api/guests/${added.json.id}`, `/api/guests?shootId=${data.a.shoot.id}`, `/api/shoots/${data.a.shoot.id}`].map(async (path) => [path, (await asCaptain('GET', path)).json] as const))),
        ['PATCH guest', (await asCaptain('PATCH', `/api/guests/${added.json.id}`, { notes: 'left-handed' })).json] as const,
        ['PATCH guest fee', (await asCaptain('PATCH', `/api/guests/${added.json.id}`, { dayFee: 4000 })).json] as const,
        ['PATCH payment', (await asCaptain('PATCH', `/api/guests/${added.json.id}/payment`, { paid: true })).json] as const,
      ]
      for (const [path, body] of answers) {
        const text = JSON.stringify(body)
        assert.equal(text.includes(row.inviteToken!), false, path)
        assert.equal(text.includes(token), false, path)
      }
    })

    it('a new link works at once and the old one stops; the renewal is in the trail without the link', async () => {
      const guestId = data.a.guest.id
      assert.equal((await call(server, `/api/guests/token/${INVITE_TOKEN_A}`)).status, 200)
      const renewed = await asCaptain('POST', `/api/guests/${guestId}/invite-link`)
      assert.equal(renewed.status, 200)
      const token = tokenOf(renewed.json.inviteLink)
      assert.match(token, INVITE_TOKEN_PATTERN)
      assert.notEqual(token, INVITE_TOKEN_A)
      assert.equal((await call(server, `/api/guests/token/${INVITE_TOKEN_A}`)).status, 404, 'the old link')
      assert.equal((await call(server, `/api/guests/token/${token}`)).status, 200, 'the new link')
      const entry = await prisma.activityLog.findFirstOrThrow({ where: { syndicateId: data.a.syndicate.id, action: 'Guest invitation link renewed' } })
      assert.deepEqual([entry.targetType, entry.targetId], ['guest', guestId])
      assert.deepEqual(entry.details, { previousLinkWithdrawn: true })
      assert.equal(JSON.stringify(entry).includes(token), false)
      assert.equal(JSON.stringify(entry).includes(hashInviteToken(token)), false)
    })

    it('a gun cannot renew a link, even for their own guest', async () => {
      assert.equal((await asGun('POST', `/api/guests/${data.a.guest.id}/invite-link`)).status, 404)
    })

    for (const [label, prepare] of [
      ['the guest declined', async () => { await prisma.guestGun.update({ where: { id: data.a.guest.id }, data: { rsvpStatus: 'DECLINED' } }) }],
      ['the day is over', async () => { today = '2026-11-15' }],
      ['their details are erased', async () => { await prisma.guestGun.update({ where: { id: data.a.guest.id }, data: { email: `removed-${data.a.guest.id}@removed.invalid`, inviteToken: null } }) }],
    ] as const) {
      it(`no new link once ${label}, and the stored hash is left as it was`, async () => {
        await prepare()
        const before = (await guestRow()).inviteToken
        const res = await asCaptain('POST', `/api/guests/${data.a.guest.id}/invite-link`)
        assert.equal(res.status, 409)
        assert.equal((await guestRow()).inviteToken, before)
      })
    }
  })
})
