/**
 * Alerts, error references and the money events (batch 9c).
 *
 *   - anything a human must act on is an alert with IDs only, never personal data;
 *   - an unexpected failure gives the user a reference, and the report carries the same one;
 *   - a card dispute makes a syndicate read-only at once and a payment opens it again;
 *   - a refund is recorded against the guest it was for;
 *   - a failed card keeps full use for two weeks after the paid-up date, then read-only;
 *   - when Clerk can't be reached the user is told to try again, not signed out.
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import type Stripe from 'stripe'
import { CAPTAIN_A, GUN_A, TEST_TODAY, TEST_WEBHOOK_SECRET, call, createTestPrisma, createTestStripe, resetDatabase, seed, startTestServer, testVerifier, type TestServer } from './helpers.js'
import { CASES, snapshot } from './routeCases.js'
import { DISPUTED_CAPTAIN_MESSAGE, OVERDUE_CAPTAIN_MESSAGE, PAST_DUE_GRACE_DAYS, planAccess } from '../server/access.js'
import { clerkUnreachable, refusal, sessionFromClaims } from '../server/auth.js'
import { errorReference, keepBreadcrumb, reportable, scrubServerEvent } from '../server/alerts.js'

type Seeded = Awaited<ReturnType<typeof seed>>

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date(`${TEST_TODAY}T12:00:00Z`)

describe('plan access rule', () => {
  const plan = (status: string | null, since: Date | null = null, dispute: Date | null = null) =>
    ({ stripeSubscriptionStatus: status, subscriptionCurrentPeriodEnd: null, disputeOpenedAt: dispute, pastDueSince: since })

  it('active and trialing are live; unpaid, incomplete, cancelled and no plan are not', () => {
    assert.equal(planAccess(plan('ACTIVE'), NOW).live, true)
    assert.equal(planAccess(plan('TRIALING'), NOW).live, true)
    for (const status of ['UNPAID', 'INCOMPLETE', 'CANCELLED', null]) {
      assert.deepEqual(planAccess(plan(status), NOW), { live: false, reason: 'lapsed', readOnlyFrom: null }, String(status))
    }
  })

  it('a failed card is live for exactly two weeks after it first failed, and says when that ends', () => {
    const since = new Date(NOW.getTime() - 3 * DAY)
    const readOnlyFrom = new Date(since.getTime() + PAST_DUE_GRACE_DAYS * DAY)
    assert.deepEqual(planAccess(plan('PAST_DUE', since), NOW), { live: true, reason: null, readOnlyFrom })
    assert.deepEqual(planAccess(plan('PAST_DUE', since), new Date(readOnlyFrom.getTime() - 1)), { live: true, reason: null, readOnlyFrom })
    assert.deepEqual(planAccess(plan('PAST_DUE', since), readOnlyFrom), { live: false, reason: 'overdue', readOnlyFrom })
    assert.equal(PAST_DUE_GRACE_DAYS, 14)
    // The paid-up date plays no part: Stripe moves it on before the card is even tried.
    assert.deepEqual(planAccess({ ...plan('PAST_DUE', since), subscriptionCurrentPeriodEnd: new Date(NOW.getTime() + 25 * DAY) }, readOnlyFrom).live, false)
    // No failure time on record (an older row): live, warned, until Stripe says otherwise.
    assert.deepEqual(planAccess(plan('PAST_DUE'), NOW), { live: true, reason: null, readOnlyFrom: null })
  })

  it('an open dispute is read-only whatever the status', () => {
    for (const status of ['ACTIVE', 'TRIALING', 'PAST_DUE']) {
      assert.deepEqual(planAccess(plan(status, null, NOW), NOW), { live: false, reason: 'dispute', readOnlyFrom: null }, status)
    }
  })
})

describe('error references', () => {
  it('are short, readable and never the same twice in a thousand', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const ref = errorReference()
      assert.match(ref, /^SS-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
      seen.add(ref)
    }
    assert.equal(seen.size, 1000)
  })
})

describe('what leaves the server for Sentry', () => {
  it('no request (its URL can carry an invite token), no user, no console lines; named by the route pattern', () => {
    const event = scrubServerEvent(
      { request: { url: 'https://shootsync.co.uk/api/guests/token/' + 'a'.repeat(64) + '/accept', method: 'POST' }, user: { id: 'u' }, transaction: 'POST /api/guests/token/' + 'a'.repeat(64) + '/accept', message: 'kept' },
      { originalException: Object.assign(new Error('x'), { route: 'POST /api/guests/token/:token/accept' }) },
    )
    assert.deepEqual(event, { transaction: 'POST /api/guests/token/:token/accept', message: 'kept' })
    // The route noted on the capture wins; with neither, the URL-based name goes too.
    assert.equal(scrubServerEvent({ transaction: 'GET /x/abc' }, { data: { route: 'GET /x/:id' } }).transaction, 'GET /x/:id')
    assert.deepEqual(scrubServerEvent({ transaction: 'GET /x/abc' }), {})
    assert.equal(keepBreadcrumb({ category: 'console', message: 'anything' }), null)
    assert.deepEqual(keepBreadcrumb({ category: 'http', message: 'kept' }), { category: 'http', message: 'kept' })
  })

  it('a Prisma validation error is reported by name only: its message would hold the record', () => {
    const err = new Error('Invalid `prisma.member.create()` invocation: data: { name: "Dave Wilson", email: "dave@example.com" }')
    err.name = 'PrismaClientValidationError'
    const safe = reportable(err) as Error
    assert.equal(safe.name, 'PrismaClientValidationError')
    assert.equal(safe.message.includes('Dave'), false)
    assert.equal((safe.stack ?? '').includes('Dave'), false)
    assert.ok(safe.stack)
    const plain = new Error('boom')
    assert.equal(reportable(plain), plain)
  })
})

describe('when the sign-in service cannot be reached', () => {
  it('Clerk being down is told apart from a bad token', () => {
    assert.equal(clerkUnreachable(Object.assign(new Error('x'), { reason: 'jwk-remote-failed-to-load' })), true)
    assert.equal(clerkUnreachable(Object.assign(new Error('x'), { reason: 'jwk-failed-to-resolve' })), true)
    assert.equal(clerkUnreachable(new TypeError('fetch failed')), true)
    // An outage page where Clerk's keys should be: JSON parsing fails, with no reason.
    assert.equal(clerkUnreachable(new SyntaxError('Unexpected token < in JSON')), true)
    assert.equal(clerkUnreachable(Object.assign(new Error('x'), { reason: 'token-expired' })), false)
    assert.equal(clerkUnreachable(Object.assign(new Error('x'), { reason: 'token-invalid-signature' })), false)
    // This server's own refusals carry a reason too.
    assert.equal(clerkUnreachable(refusal('Token has no subject')), false)
    assert.throws(() => sessionFromClaims({ sub: '', sid: 's' }), (err: unknown) => !clerkUnreachable(err))
  })
})

describe('alerts and money events', () => {
  let prisma: PrismaClient
  let server: TestServer
  let data: Seeded
  let stripe: Stripe
  let charges: Map<string, Stripe.Charge>
  let subscriptions: Map<string, Stripe.Subscription>
  let disputes: Map<string, Stripe.Dispute>

  before(async () => {
    prisma = createTestPrisma()
    const fake = createTestStripe()
    stripe = fake.stripe
    charges = fake.charges
    subscriptions = fake.subscriptions
    disputes = fake.disputes
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
    disputes.clear()
  })

  async function deliver(payload: object): Promise<number> {
    const body = JSON.stringify({ object: 'event', created: Math.floor(NOW.getTime() / 1000), ...payload })
    const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: TEST_WEBHOOK_SECRET })
    const res = await fetch(`${server.baseUrl}/api/stripe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature }, body })
    return res.status
  }

  const syndicateA = () => prisma.syndicate.findUniqueOrThrow({ where: { id: data.a.syndicate.id } })
  const customerA = () => syndicateA().then((s) => s.stripeCustomerId)

  const dispute = (id: string, charge: string, paymentIntent: string | null, status = 'needs_response') =>
    ({ id, object: 'dispute', charge, payment_intent: paymentIntent, amount: 6900, currency: 'gbp', reason: 'fraudulent', status })
  const T0 = Math.floor(NOW.getTime() / 1000)

  describe('a card dispute', () => {
    it('on a subscription payment makes the syndicate read-only at once, with its own sentence, and raises an alert naming IDs only', async () => {
      charges.set('ch_sub_1', { id: 'ch_sub_1', customer: await customerA() } as Stripe.Charge)
      assert.equal(await deliver({ id: 'evt_dispute_1', type: 'charge.dispute.created', data: { object: dispute('dp_1', 'ch_sub_1', 'pi_sub_1') } }), 200)

      const row = await syndicateA()
      assert.ok(row.disputeOpenedAt)
      assert.equal(row.stripeSubscriptionStatus, 'ACTIVE')
      const before = await snapshot(prisma)
      const refused = await call(server, `/api/shoots/${data.a.shoot.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { locationName: 'Moved' } })
      assert.equal(refused.status, 402)
      assert.equal(refused.json.error, DISPUTED_CAPTAIN_MESSAGE)
      assert.equal(await snapshot(prisma), before)
      // Reading still works, and the browser is told why it is read-only.
      const status = await call(server, `/api/subscriptions/status/${data.a.syndicate.id}`, { as: CAPTAIN_A })
      assert.deepEqual([status.json.isActive, status.json.reason, status.json.status], [false, 'dispute', 'ACTIVE'])
      const me = await call(server, '/api/me', { as: CAPTAIN_A })
      assert.equal(me.json.syndicates.find((s: { id: string }) => s.id === data.a.syndicate.id).subscription.reason, 'dispute')

      assert.equal(server.alerts.length, 1)
      assert.equal(server.alerts[0].kind, 'dispute')
      assert.deepEqual(server.alerts[0].details, { syndicate: data.a.syndicate.id, dispute: 'dp_1', amount: 6900, reason: 'fraudulent' })
      assert.equal(JSON.stringify(server.alerts).includes('example.com'), false)
    })

    it('is stamped with when Stripe says it opened, and a redelivery keeps the first opening time', async () => {
      charges.set('ch_sub_1', { id: 'ch_sub_1', customer: await customerA() } as Stripe.Charge)
      await deliver({ id: 'evt_dispute_1', created: T0 - 3600, type: 'charge.dispute.created', data: { object: dispute('dp_1', 'ch_sub_1', 'pi_sub_1') } })
      assert.equal((await syndicateA()).disputeOpenedAt?.getTime(), (T0 - 3600) * 1000)
      await deliver({ id: 'evt_dispute_1', created: T0 - 3600, type: 'charge.dispute.created', data: { object: dispute('dp_1', 'ch_sub_1', 'pi_sub_1') } })
      assert.equal((await syndicateA()).disputeOpenedAt?.getTime(), (T0 - 3600) * 1000)
    })

    it('a "created" delivery retried after the dispute has closed does not lock the syndicate again', async () => {
      charges.set('ch_sub_1', { id: 'ch_sub_1', customer: await customerA() } as Stripe.Charge)
      disputes.set('dp_1', { id: 'dp_1', status: 'warning_closed' } as Stripe.Dispute)
      assert.equal(await deliver({ id: 'evt_dispute_1', type: 'charge.dispute.created', data: { object: dispute('dp_1', 'ch_sub_1', 'pi_sub_1') } }), 200)
      assert.equal((await syndicateA()).disputeOpenedAt, null)
      assert.equal(server.alerts.length, 0)
    })

    it('on a guest’s day fee is an alert for the captain, and the syndicate carries on', async () => {
      await prisma.guestGun.update({ where: { id: data.a.guest.id }, data: { paymentStatus: 'PAID', stripePaymentId: 'pi_guest_1' } })
      assert.equal(await deliver({ id: 'evt_dispute_g', type: 'charge.dispute.created', data: { object: dispute('dp_g', 'ch_guest_1', 'pi_guest_1') } }), 200)
      assert.equal((await syndicateA()).disputeOpenedAt, null)
      assert.equal(server.alerts.length, 1)
      assert.equal(server.alerts[0].kind, 'dispute')
      assert.deepEqual(server.alerts[0].details, { guest: data.a.guest.id, shoot: data.a.shoot.id, dispute: 'dp_g', amount: 6900, reason: 'fraudulent' })
      assert.equal((await call(server, `/api/shoots/${data.a.shoot.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { locationName: 'Moved' } })).status, 200)
    })

    it('that matches nothing is still an alert, never silently dropped', async () => {
      assert.equal(await deliver({ id: 'evt_dispute_x', type: 'charge.dispute.created', data: { object: dispute('dp_x', 'ch_unknown', 'pi_unknown') } }), 200)
      assert.equal(server.alerts.length, 1)
      assert.match(server.alerts[0].message, /cannot match/)
    })

    it('won: the hold ends; lost: it stays until a payment arrives', async () => {
      charges.set('ch_sub_1', { id: 'ch_sub_1', customer: await customerA() } as Stripe.Charge)
      await deliver({ id: 'evt_dispute_1', type: 'charge.dispute.created', data: { object: dispute('dp_1', 'ch_sub_1', 'pi_sub_1') } })
      assert.equal(await deliver({ id: 'evt_lost', type: 'charge.dispute.closed', data: { object: dispute('dp_1', 'ch_sub_1', 'pi_sub_1', 'lost') } }), 200)
      assert.ok((await syndicateA()).disputeOpenedAt)
      assert.match(server.alerts.at(-1)?.message ?? '', /lost/)

      assert.equal(await deliver({ id: 'evt_won', created: T0 + 60, type: 'charge.dispute.closed', data: { object: dispute('dp_1', 'ch_sub_1', 'pi_sub_1', 'won') } }), 200)
      assert.equal((await syndicateA()).disputeOpenedAt, null)
      assert.equal((await call(server, `/api/shoots/${data.a.shoot.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { locationName: 'Moved' } })).status, 200)
    })

    it('a paid invoice opens the syndicate again: real money, paid after the dispute opened', async () => {
      await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { disputeOpenedAt: NOW } })
      const customer = await customerA()
      // A £0 invoice (a proration, a trial) is not a payment.
      assert.equal(await deliver({ id: 'evt_paid_0', created: T0 + 60, type: 'invoice.paid', data: { object: { id: 'in_0', object: 'invoice', customer, amount_paid: 0 } } }), 200)
      assert.ok((await syndicateA()).disputeOpenedAt)
      // Nor is a late redelivery of the very invoice that was charged back.
      assert.equal(await deliver({ id: 'evt_paid_old', created: T0 - 60, type: 'invoice.paid', data: { object: { id: 'in_old', object: 'invoice', customer, amount_paid: 6900 } } }), 200)
      assert.ok((await syndicateA()).disputeOpenedAt)
      assert.equal(server.alerts.length, 0)

      assert.equal(await deliver({ id: 'evt_paid', created: T0 + 60, type: 'invoice.paid', data: { object: { id: 'in_1', object: 'invoice', customer, amount_paid: 6900 } } }), 200)
      assert.equal((await syndicateA()).disputeOpenedAt, null)
      assert.equal(server.alerts.length, 1)
      assert.match(server.alerts[0].message, /paid again/)
      // A paid invoice for a syndicate with nothing open is not an alert.
      assert.equal(await deliver({ id: 'evt_paid_2', created: T0 + 120, type: 'invoice.paid', data: { object: { id: 'in_2', object: 'invoice', customer, amount_paid: 6900 } } }), 200)
      assert.equal(server.alerts.length, 1)
    })

    it('a new plan paid for by checkout opens it again too', async () => {
      await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { disputeOpenedAt: NOW, stripeSubscriptionId: null } })
      subscriptions.set('sub_new', { id: 'sub_new', status: 'active', current_period_end: 1_800_000_000, items: { data: [{ price: { id: 'price_standard_test' } }] }, metadata: { syndicateId: data.a.syndicate.id, planTier: 'STANDARD' } } as unknown as Stripe.Subscription)
      assert.equal(await deliver({ id: 'evt_checkout', type: 'checkout.session.completed', data: { object: { id: 'cs_new', object: 'checkout.session', mode: 'subscription', subscription: 'sub_new', metadata: { syndicateId: data.a.syndicate.id, planTier: 'STANDARD' } } } }), 200)
      assert.equal((await syndicateA()).disputeOpenedAt, null)
    })
  })

  describe('a refund', () => {
    it('of a guest’s day fee in full is recorded against the guest', async () => {
      await prisma.guestGun.update({ where: { id: data.a.guest.id }, data: { paymentStatus: 'PAID', stripePaymentId: 'pi_guest_1' } })
      const charge = { id: 'ch_guest_1', object: 'charge', payment_intent: 'pi_guest_1', customer: null, refunded: true, amount: 5000, amount_refunded: 5000 }
      assert.equal(await deliver({ id: 'evt_refund', type: 'charge.refunded', data: { object: charge } }), 200)
      assert.equal((await prisma.guestGun.findUniqueOrThrow({ where: { id: data.a.guest.id } })).paymentStatus, 'REFUNDED')
      assert.equal(server.alerts[0]?.kind, 'money')
      assert.equal(server.alerts[0]?.details.guest, data.a.guest.id)
      // Redelivered: nothing new to say.
      assert.equal(await deliver({ id: 'evt_refund', type: 'charge.refunded', data: { object: charge } }), 200)
      assert.equal(server.alerts.length, 1)
    })

    it('in part leaves the guest paid and says so', async () => {
      await prisma.guestGun.update({ where: { id: data.a.guest.id }, data: { paymentStatus: 'PAID', stripePaymentId: 'pi_guest_1' } })
      const charge = { id: 'ch_guest_1', object: 'charge', payment_intent: 'pi_guest_1', customer: null, refunded: false, amount: 5000, amount_refunded: 1000 }
      assert.equal(await deliver({ id: 'evt_refund_part', type: 'charge.refunded', data: { object: charge } }), 200)
      assert.equal((await prisma.guestGun.findUniqueOrThrow({ where: { id: data.a.guest.id } })).paymentStatus, 'PAID')
      assert.match(server.alerts[0]?.message ?? '', /partly refunded; the guest is still recorded as paid/)
      assert.equal(server.alerts[0]?.details.guest, data.a.guest.id)
    })

    it('of a subscription payment names the syndicate', async () => {
      const charge = { id: 'ch_sub_1', object: 'charge', payment_intent: 'pi_sub_1', customer: await customerA(), refunded: true, amount: 6900, amount_refunded: 6900 }
      assert.equal(await deliver({ id: 'evt_refund_sub', type: 'charge.refunded', data: { object: charge } }), 200)
      assert.equal(server.alerts[0]?.details.syndicate, data.a.syndicate.id)
    })
  })

  describe('a failed card', () => {
    const pastDue = (daysSinceFailed: number) =>
      prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionStatus: 'PAST_DUE', pastDueSince: new Date(NOW.getTime() - daysSinceFailed * DAY), subscriptionCurrentPeriodEnd: new Date(NOW.getTime() + 20 * DAY) } })

    const subscriptionEvent = (id: string, status: string) => {
      subscriptions.set(id, { id, status, current_period_end: T0 + 20 * 86_400, items: { data: [{ price: { id: 'price_standard_test' } }] }, metadata: { syndicateId: data.a.syndicate.id, planTier: 'STANDARD' } } as unknown as Stripe.Subscription)
      return { id: `evt_${id}_${status}`, type: 'customer.subscription.updated', data: { object: { id, object: 'subscription', status } } }
    }

    it('the moment the card first fails is recorded from Stripe’s event, kept through retries, and cleared when the plan is paid', async () => {
      await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionId: 'sub_a' } })
      assert.equal(await deliver(subscriptionEvent('sub_a', 'past_due')), 200)
      const first = (await syndicateA()).pastDueSince
      assert.ok(first)
      // Stripe retries and sends past_due again days later: the clock does not restart.
      const earlier = new Date(first.getTime() - 5 * DAY)
      await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { pastDueSince: earlier } })
      assert.equal(await deliver(subscriptionEvent('sub_a', 'past_due')), 200)
      assert.equal((await syndicateA()).pastDueSince?.getTime(), earlier.getTime())
      const status = await call(server, `/api/subscriptions/status/${data.a.syndicate.id}`, { as: CAPTAIN_A })
      assert.equal(new Date(status.json.readOnlyFrom).getTime(), earlier.getTime() + 14 * DAY)
      // Paid: the episode ends, so the next failure gets its own two weeks.
      assert.equal(await deliver(subscriptionEvent('sub_a', 'active')), 200)
      assert.equal((await syndicateA()).pastDueSince, null)
    })

    it('keeps everything working for two weeks after the card first failed, and says when that ends', async () => {
      await pastDue(13)
      assert.equal((await call(server, `/api/shoots/${data.a.shoot.id}`, { method: 'PATCH', as: CAPTAIN_A, body: { locationName: 'Moved' } })).status, 200)
      const status = await call(server, `/api/subscriptions/status/${data.a.syndicate.id}`, { as: CAPTAIN_A })
      assert.equal(status.json.isActive, true)
      assert.equal(new Date(status.json.readOnlyFrom).toISOString(), new Date(NOW.getTime() + 1 * DAY).toISOString())
    })

    for (const testCase of CASES.filter((c) => c.method !== 'GET' && !c.allowLapsed)) {
      it(`${testCase.name}: refused once two weeks have passed, and nothing changes`, async () => {
        await pastDue(14)
        const before = await snapshot(prisma)
        const res = await call(server, testCase.path(data.a), { method: testCase.method, as: CAPTAIN_A, body: testCase.body?.(data.a) })
        assert.equal(res.status, 402, JSON.stringify(res.json))
        assert.equal(res.json.error, OVERDUE_CAPTAIN_MESSAGE)
        assert.equal(await snapshot(prisma), before)
      })
    }

    it('reading still works, the ways back stay open, and a gun is told about the captain', async () => {
      await pastDue(30)
      assert.equal((await call(server, `/api/shoots/${data.a.shoot.id}`, { as: CAPTAIN_A })).status, 200)
      assert.equal((await call(server, '/api/subscriptions/portal', { method: 'POST', as: CAPTAIN_A, body: { syndicateId: data.a.syndicate.id } })).status, 200)
      const gun = await call(server, '/api/bags', { method: 'POST', as: GUN_A, body: { shootId: data.a.shoot.id, driveNumber: 2, pheasant: 7 } })
      assert.equal(gun.status, 402)
      assert.equal(gun.json.error, 'This syndicate is read-only until its captain renews the plan.')
    })
  })

  describe('an unexpected failure', () => {
    it('gives the user a reference, reports it with the same reference, and names the route pattern, not the record', async () => {
      // A Stripe fake that fails unexpectedly when the billing page is opened.
      const broken = createTestStripe()
      ;(broken.stripe.billingPortal.sessions as unknown as Record<string, unknown>).create = async () => { throw new Error('boom: a surprise') }
      const other = await startTestServer(prisma, broken.stripe)
      try {
        const res = await call(other, '/api/subscriptions/portal', { method: 'POST', as: CAPTAIN_A, body: { syndicateId: data.a.syndicate.id } })
        assert.equal(res.status, 500)
        assert.match(res.json.error, /ShootSync had a problem with that\. Try again in a moment; if it keeps happening, email hello@shootsync\.co\.uk quoting SS-[A-Z2-9]{6}\./)
        assert.equal(res.json.reference, /SS-[A-Z2-9]{6}/.exec(res.json.error)?.[0])
        assert.equal(JSON.stringify(res.json).includes('boom'), false)
        // The report is the same reference, the route pattern (no IDs), and nothing personal.
        assert.equal(other.reports.length, 1)
        assert.equal(other.reports[0].reference, res.json.reference)
        assert.equal(other.reports[0].context, 'POST /api/subscriptions/portal')
        assert.equal(JSON.stringify(other.reports).includes(data.a.syndicate.id), false)
      } finally {
        await other.close()
      }
    })

    it('names the route pattern, never the record in the address', async () => {
      // A clock that fails: completing a shoot day asks what day it is.
      const broken = await startTestServer(prisma, stripe, testVerifier, () => { throw new Error('no clock') })
      try {
        const res = await call(broken, `/api/shoots/${data.a.shoot.id}/complete`, { method: 'POST', as: CAPTAIN_A })
        assert.equal(res.status, 500)
        assert.equal(broken.reports[0]?.context, 'POST /api/shoots/:id/complete')
        assert.equal(JSON.stringify(broken.reports[0]?.context).includes(data.a.shoot.id), false)
      } finally {
        await broken.close()
      }
    })
  })

  describe('when the sign-in service cannot be reached', () => {
    it('the user is told to try again in a moment (503), not that they are signed out', async () => {
      const flaky = await startTestServer(prisma, stripe, async (token) => {
        if (token === 'test-token.user_captainA') throw Object.assign(new Error('Failed to load JWKS'), { reason: 'jwk-remote-failed-to-load' })
        return testVerifier(token)
      })
      try {
        const res = await call(flaky, '/api/me', { as: CAPTAIN_A })
        assert.equal(res.status, 503)
        assert.match(res.json.error, /couldn’t check your sign-in just now/)
        assert.equal(res.json.code, undefined)
        assert.equal((await call(flaky, '/api/me', { as: GUN_A })).status, 200)
      } finally {
        await flaky.close()
      }
    })
  })
})

describe('browser error reports carry nothing personal', () => {
  it('headers, cookies, bodies, query strings and the user are stripped; the page URL is cut to its path', async () => {
    const { scrubEvent, pathOnly } = await import('../src/utils/errorTracking.js')
    const event = scrubEvent({
      request: { url: 'https://shootsync.co.uk/guest/abc?token=secret#x', headers: { cookie: 'a' }, cookies: { s: 1 }, data: 'body', query_string: 'token=secret' },
      user: { email: 'someone@example.com' },
      message: 'kept',
    })
    assert.deepEqual(event, { request: { url: '/guest/abc' }, message: 'kept' })
    assert.equal(pathOnly('/shoots/1?x=1'), '/shoots/1')
    assert.equal(pathOnly('not a url'), '/not%20a%20url')
    // An invite token is a credential: masked wherever a path carries it.
    assert.equal(pathOnly(`https://shootsync.co.uk/guest/accept/${'b'.repeat(64)}`), '/guest/accept/:token')
    assert.equal(scrubEvent({ transaction: `/guest/accept/${'b'.repeat(64)}` }).transaction, '/guest/accept/:token')
  })
})

describe('content security policy', () => {
  let prisma: PrismaClient
  let server: TestServer

  before(async () => {
    prisma = createTestPrisma()
    server = await startTestServer(prisma, createTestStripe().stripe)
  })

  after(async () => {
    await server.close()
    await prisma.$disconnect()
  })

  it('is sent in report-only mode on every response, allowing only the origins the app uses, and reports come back here', async () => {
    const res = await fetch(`${server.baseUrl}/api/health`)
    assert.equal(res.headers.get('content-security-policy'), null)
    const policy = res.headers.get('content-security-policy-report-only') ?? ''
    assert.match(policy, /default-src 'self'/)
    assert.match(policy, /script-src 'self' https:\/\/clerk\.shootsync\.co\.uk https:\/\/\*\.clerk\.accounts\.dev https:\/\/challenges\.cloudflare\.com/)
    assert.match(policy, /frame-ancestors 'none'/)
    // Clerk: its bot protection origin everywhere it is used, and its session worker from a blob URL.
    for (const directive of ['script-src', 'connect-src', 'frame-src']) assert.match(policy, new RegExp(`${directive} [^;]*https://\\*\\.protect\\.clerk\\.com`), directive)
    assert.match(policy, /worker-src 'self' blob:/)
    assert.match(policy, /connect-src [^;]*https:\/\/\*\.ingest\.us\.sentry\.io/)
    assert.match(policy, /object-src 'none'/)
    assert.match(policy, /report-uri \/api\/csp-report/)
    assert.doesNotMatch(policy, /unsafe-eval/)
  })

  it('a browser’s report is accepted without signing in, logged as one line with no personal data, and never read back', async (t) => {
    const warned: string[] = []
    t.mock.method(console, 'warn', (...args: unknown[]) => { warned.push(args.join(' ')) })
    const report = { 'csp-report': { 'document-uri': 'https://shootsync.co.uk/shoots/abc?token=secret', 'effective-directive': 'script-src', 'blocked-uri': 'https://evil.example/x.js?who=someone@example.com', 'original-policy': 'long' } }
    const res = await fetch(`${server.baseUrl}/api/csp-report`, { method: 'POST', headers: { 'Content-Type': 'application/csp-report' }, body: JSON.stringify(report) })
    assert.equal(res.status, 204)
    assert.deepEqual(warned, ['[csp] script-src blocked https://evil.example on /shoots/abc'])
    // Rubbish is dropped quietly.
    const junk = await fetch(`${server.baseUrl}/api/csp-report`, { method: 'POST', headers: { 'Content-Type': 'application/csp-report' }, body: '{"x":1}' })
    assert.equal(junk.status, 204)
    assert.equal(warned.length, 1)
    // A report is untrusted input: it can't write its own lines into the log, or very long ones,
    // and the page's path never carries an invite token.
    const hostile = { 'csp-report': { 'document-uri': `https://shootsync.co.uk/guest/accept/${'c'.repeat(64)}`, 'effective-directive': 'script-src\n[alert] fake line ' + 'x'.repeat(500), 'blocked-uri': 'inline' } }
    await fetch(`${server.baseUrl}/api/csp-report`, { method: 'POST', headers: { 'Content-Type': 'application/csp-report' }, body: JSON.stringify(hostile) })
    assert.equal(warned.length, 2)
    assert.equal(warned[1].includes('\n'), false)
    assert.ok(warned[1].length < 200, warned[1])
    assert.equal(warned[1].includes('c'.repeat(64)), false)
    assert.match(warned[1], /on \/guest\/accept\/:token$/)
  })
})
