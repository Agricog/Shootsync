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
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import {
  CAPTAIN_A, GUN_A, INVITE_TOKEN_A, TEST_TODAY, TEST_WEBHOOK_SECRET, call, createTestPrisma, createTestStripe, resetDatabase, seed, startTestServer, testVerifier, type TestServer,
  acceptBody,
} from './helpers.js'
import { GUEST_LINK_DAYS_AFTER_SHOOT, guestDayClosed, guestLinkExpired } from '../server/routes/guests.js'

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

    /** Runs fn with console.error recorded. */
    async function errorsDuring(fn: () => Promise<unknown>): Promise<string[]> {
      const original = console.error
      const lines: string[] = []
      console.error = (...args: unknown[]) => { lines.push(args.join(' ')) }
      try {
        await fn()
      } finally {
        console.error = original
      }
      return lines
    }

    it('the right amount is recorded quietly', async () => {
      const errors = await errorsDuring(async () => assert.equal((await paid(5000)).status, 200))
      assert.deepEqual(errors, [])
      assert.equal((await guestRow()).paymentStatus, 'PAID')
    })

    for (const [amount, currency] of [[4000, 'gbp'], [5000, 'eur']] as const) {
      it(`${amount} ${currency} is still recorded as paid (so they can't pay twice), and logged to be put right`, async () => {
        const errors = await errorsDuring(async () => assert.equal((await paid(amount, currency)).status, 200))
        assert.equal((await guestRow()).paymentStatus, 'PAID')
        assert.equal(errors.length, 1)
        assert.match(errors[0], new RegExp(`paid ${amount} ${currency} but the day fee is 5000 gbp`))
      })
    }
  })
})
