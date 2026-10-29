/**
 * Authentication gate, response shaping, the public guest flow and the Stripe webhook.
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import type Stripe from 'stripe'
import { PUBLIC_ROUTES } from '../server/auth.js'
import { REQUIRED_MIGRATION } from '../server/schemaVersion.js'
import {
  CAPTAIN_A,
  CAPTAIN_B,
  GUN_A,
  INVITE_TOKEN_A,
  TEST_WEBHOOK_SECRET,
  call,
  createTestPrisma,
  createTestStripe,
  resetDatabase,
  seed,
  startTestServer,
  testConfig,
  concrete,
  registeredRoutes,
  tokenFor,
  type StripeCalls,
  type TestServer,
} from './helpers.js'

type Seeded = Awaited<ReturnType<typeof seed>>

describe('API', () => {
  let prisma: PrismaClient
  let server: TestServer
  let stripe: Stripe
  let stripeCalls: StripeCalls
  let subscriptions: Map<string, Stripe.Subscription>
  let data: Seeded

  before(async () => {
    prisma = createTestPrisma()
    const testStripe = createTestStripe()
    stripe = testStripe.stripe
    stripeCalls = testStripe.calls
    subscriptions = testStripe.subscriptions
    server = await startTestServer(prisma, stripe)
  })

  after(async () => {
    await server.close()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await resetDatabase(prisma)
    data = await seed(prisma)
    stripeCalls.checkoutCreates.length = 0
    stripeCalls.checkoutIdempotencyKeys.length = 0
    stripeCalls.customersCreated.length = 0
    stripeCalls.openSessions = []
    stripeCalls.expired.length = 0
    stripeCalls.expireFails = false
    subscriptions.clear()
  })

  describe('authentication gate', () => {
    it('finds the routes it is checking (guards the route walker itself)', () => {
      const routes = registeredRoutes(prisma, stripe)
      assert.ok(routes.length >= 45, `only found ${routes.length} routes`)
      assert.ok(routes.some((r) => r.method === 'PATCH' && r.path === '/api/members/:id/status'))
    })

    it('every non-public route refuses a request with no token', async () => {
      const failures: string[] = []
      for (const route of registeredRoutes(prisma, stripe)) {
        const path = concrete(route.path)
        const isPublic = PUBLIC_ROUTES.some((p) => p.method === route.method && p.path.test(path.replace(/^\/api/, '')))
        if (isPublic || route.path === '/api/health' || route.path.endsWith('/webhook')) continue
        const res = await call(server, path, { method: route.method, body: route.method === 'GET' ? undefined : {} })
        if (res.status !== 401) failures.push(`${route.method} ${route.path} → ${res.status}`)
      }
      assert.deepEqual(failures, [])
    })

    it('every non-public route refuses an invalid token', async () => {
      const failures: string[] = []
      for (const route of registeredRoutes(prisma, stripe)) {
        const path = concrete(route.path)
        const isPublic = PUBLIC_ROUTES.some((p) => p.method === route.method && p.path.test(path.replace(/^\/api/, '')))
        if (isPublic || route.path === '/api/health' || route.path.endsWith('/webhook')) continue
        const res = await call(server, path, { method: route.method, rawToken: 'forged.token.value' })
        if (res.status !== 401) failures.push(`${route.method} ${route.path} → ${res.status}`)
      }
      assert.deepEqual(failures, [])
    })

    it('a token in the query string or a cookie is not accepted', async () => {
      const viaCookie = await call(server, '/api/syndicates', { headers: { Cookie: `__session=${tokenFor(CAPTAIN_A)}` } })
      assert.equal(viaCookie.status, 401)
      const viaQuery = await call(server, `/api/syndicates?token=${tokenFor(CAPTAIN_A)}`)
      assert.equal(viaQuery.status, 401)
    })

    it('the public route list is exactly what was reviewed', () => {
      assert.deepEqual(
        PUBLIC_ROUTES.map((r) => `${r.method} ${r.path.source}`),
        [
          'GET ^\\/health$',
          'POST ^\\/stripe\\/webhook$',
          'POST ^\\/subscriptions\\/webhook$',
          'GET ^\\/guests\\/token\\/[a-f0-9]{64}$',
          'POST ^\\/guests\\/token\\/[a-f0-9]{64}\\/(accept|decline)$',
        ]
      )
    })

    it('health is public', async () => {
      await prisma.$executeRawUnsafe(`INSERT INTO schema_migrations (id) VALUES ('${REQUIRED_MIGRATION}') ON CONFLICT DO NOTHING`)
      const res = await call(server, '/api/health')
      assert.equal(res.status, 200)
      await prisma.$executeRawUnsafe(`DELETE FROM schema_migrations WHERE id = '${REQUIRED_MIGRATION}'`)
    })

    it('unknown API paths return JSON 404, not the web page', async () => {
      const res = await call(server, '/api/nothing-here', { as: CAPTAIN_A })
      assert.equal(res.status, 404)
      assert.deepEqual(res.json, { error: 'That could not be found. It may have been removed.' })
    })

    it('API responses are never cached', async () => {
      const res = await call(server, '/api/syndicates', { as: CAPTAIN_A })
      assert.equal(res.headers.get('cache-control'), 'no-store')
    })
  })

  describe('syndicates', () => {
    it("lists only the signed-in captain's syndicates, whatever captainClerkId is asked for", async () => {
      const res = await call(server, `/api/syndicates?captainClerkId=${CAPTAIN_B}`, { as: CAPTAIN_A })
      assert.equal(res.status, 200)
      assert.deepEqual(res.json.map((s: any) => s.id), [data.a.syndicate.id])
    })

    it('makes the signed-in user captain, ignoring a captainClerkId in the body', async () => {
      const res = await call(server, '/api/syndicates', {
        method: 'POST',
        as: CAPTAIN_A,
        body: { name: 'Hilltop', seasonStart: '2026-10-01', seasonEnd: '2027-02-01', captainClerkId: CAPTAIN_B },
      })
      assert.equal(res.status, 201)
      assert.equal(res.json.captainClerkId, CAPTAIN_A)
    })

    it('refuses a season that ends before it starts', async () => {
      const res = await call(server, '/api/syndicates', {
        method: 'POST', as: CAPTAIN_A, body: { name: 'Backwards', seasonStart: '2027-02-01', seasonEnd: '2026-10-01' },
      })
      assert.equal(res.status, 400)
    })

    it('a captain cannot hand their syndicate to someone else', async () => {
      await call(server, `/api/syndicates/${data.a.syndicate.id}`, {
        method: 'PATCH', as: CAPTAIN_A, body: { captainClerkId: CAPTAIN_B },
      })
      const row = await prisma.syndicate.findUnique({ where: { id: data.a.syndicate.id } })
      assert.equal(row?.captainClerkId, CAPTAIN_A)
    })

    it('never sends Stripe customer or subscription IDs to the browser', async () => {
      const list = await call(server, '/api/syndicates', { as: CAPTAIN_A })
      const one = await call(server, `/api/syndicates/${data.a.syndicate.id}`, { as: CAPTAIN_A })
      for (const body of [list.json[0], one.json]) {
        assert.equal('stripeCustomerId' in body, false)
        assert.equal('stripeSubscriptionId' in body, false)
        assert.equal('stripePriceId' in body, false)
      }
    })
  })

  describe('beater bank details', () => {
    it('are masked in the beater list and detail', async () => {
      const list = await call(server, `/api/beaters?syndicateId=${data.a.syndicate.id}`, { as: CAPTAIN_A })
      const one = await call(server, `/api/beaters/${data.a.beater.id}`, { as: CAPTAIN_A })
      for (const beater of [list.json[0], one.json]) {
        assert.equal('bankAccountNumber' in beater, false)
        assert.equal('bankSortCode' in beater, false)
        assert.equal(beater.bankDetailsOnFile, true)
        assert.equal(beater.bankAccountLast4, '5678')
      }
      assert.ok(!JSON.stringify(list.json).includes('12345678'))
      assert.ok(!JSON.stringify(one.json).includes('12345678'))
    })

    it("are in full only in the captain's payments summary", async () => {
      const res = await call(server, `/api/beaters/payments/summary?syndicateId=${data.a.syndicate.id}`, { as: CAPTAIN_A })
      assert.equal(res.status, 200)
      assert.equal(res.json.beaters[0].bankAccountNumber, '12345678')
    })
  })

  describe('members', () => {
    it('an invited member gets a server-made placeholder ID, never one from the browser', async () => {
      const res = await call(server, '/api/members', {
        method: 'POST', as: CAPTAIN_A,
        body: { syndicateId: data.a.syndicate.id, email: 'n@example.com', name: 'New', clerkUserId: CAPTAIN_B },
      })
      assert.equal(res.status, 201)
      assert.match(res.json.clerkUserId, /^pending_[0-9a-f-]{36}$/)
    })

    it('a member added by the captain is active straight away, as a gun', async () => {
      const res = await call(server, '/api/members', {
        method: 'POST', as: CAPTAIN_A,
        body: { syndicateId: data.a.syndicate.id, email: 'n@example.com', name: 'New' },
      })
      assert.equal(res.status, 201)
      assert.equal(res.json.status, 'ACTIVE')
      assert.equal(res.json.role, 'GUN')
    })

    it('a member cannot be added as a beater: beaters are kept on the Beaters page', async () => {
      const res = await call(server, '/api/members', {
        method: 'POST', as: CAPTAIN_A,
        body: { syndicateId: data.a.syndicate.id, email: 'b@example.com', name: 'Beater', role: 'BEATER' },
      })
      assert.equal(res.status, 400)
      assert.equal(res.json.error, 'Role is not one of the allowed choices.')
    })

    it('the old membership lookup and self-accept routes are gone', async () => {
      const byClerk = await call(server, `/api/members/by-clerk/${CAPTAIN_A}`, { as: CAPTAIN_A })
      assert.equal(byClerk.status, 404)
      assert.deepEqual(byClerk.json, { error: 'That could not be found. It may have been removed.' })
      const accept = await call(server, `/api/members/${data.a.gun.id}/accept`, { method: 'POST', as: GUN_A })
      assert.equal(accept.status, 404)
    })
  })

  describe('what a gun can and cannot do', () => {
    it("a gun's guest always carries the standard day fee, whatever fee is sent", async () => {
      const res = await call(server, '/api/guests', {
        method: 'POST', as: GUN_A,
        body: { shootId: data.a.shoot.id, invitedByMemberId: data.a.gun.id, name: 'Free Loader', email: 'f@example.com', dayFee: 0 },
      })
      assert.equal(res.status, 201)
      assert.equal(res.json.dayFee, 5000)
    })

    it('a guest is always an active gun’s guest', async () => {
      const invite = (invitedByMemberId: string) => call(server, '/api/guests', {
        method: 'POST', as: CAPTAIN_A, body: { shootId: data.a.shoot.id, invitedByMemberId, name: 'G', email: 'g@example.com' },
      })
      const beaterRole = await prisma.member.findFirstOrThrow({ where: { syndicateId: data.a.syndicate.id, role: 'BEATER' } })
      const asBeater = await invite(beaterRole.id)
      assert.equal(asBeater.status, 400)
      assert.equal(asBeater.json.error, 'A guest has to be the guest of an active gun.')

      await prisma.member.update({ where: { id: data.a.gun.id }, data: { status: 'INACTIVE' } })
      assert.equal((await invite(data.a.gun.id)).status, 400)
      assert.equal((await invite(data.a.captainMember.id)).status, 201)
    })

    it('a day fee over the limit is refused in pounds, the unit the captain typed', async () => {
      const res = await call(server, '/api/guests', {
        method: 'POST', as: CAPTAIN_A,
        body: { shootId: data.a.shoot.id, invitedByMemberId: data.a.gun.id, name: 'G', email: 'g@example.com', dayFee: 150_000 },
      })
      assert.equal(res.status, 400)
      assert.equal(res.json.error, 'Day fee must be £1,000 or less.')
    })

    it('the captain can set a guest day fee', async () => {
      const res = await call(server, '/api/guests', {
        method: 'POST', as: CAPTAIN_A,
        body: { shootId: data.a.shoot.id, invitedByMemberId: data.a.gun.id, name: 'Family', email: 'fam@example.com', dayFee: 0 },
      })
      assert.equal(res.status, 201)
      assert.equal(res.json.dayFee, 0)
    })

    it("a gun cannot change a bag someone else recorded", async () => {
      const othersBag = await prisma.bagRecord.create({
        data: { shootId: data.a.shoot.id, driveNumber: 3, pheasant: 20, recordedByMemberId: data.a.captainMember.id },
      })
      const res = await call(server, `/api/bags/${othersBag.id}`, { method: 'PATCH', as: GUN_A, body: { pheasant: 0 } })
      assert.equal(res.status, 404)
      const row = await prisma.bagRecord.findUnique({ where: { id: othersBag.id } })
      assert.equal(row?.pheasant, 20)
    })

    it("a gun does not see the captain's notes, beater list or account ID", async () => {
      const shoots = await call(server, `/api/shoots?syndicateId=${data.a.syndicate.id}`, { as: GUN_A })
      assert.equal(shoots.status, 200)
      assert.equal('captainNotes' in shoots.json[0], false)
      assert.equal('weatherNotes' in shoots.json[0], false)

      const syndicate = await call(server, `/api/syndicates/${data.a.syndicate.id}`, { as: GUN_A })
      assert.equal(syndicate.status, 200)
      assert.equal('beaters' in syndicate.json, false)
      assert.equal('captainClerkId' in syndicate.json, false)
      assert.ok(!JSON.stringify(syndicate.json).includes('captain-only notes'))
    })

    it('the captain does see their own notes', async () => {
      const shoots = await call(server, `/api/shoots?syndicateId=${data.a.syndicate.id}`, { as: CAPTAIN_A })
      assert.equal(shoots.json[0].captainNotes, 'A captain-only notes')
    })
  })

  describe('guest invite (public, by token)', () => {
    const base = `/api/guests/token/${INVITE_TOKEN_A}`

    it('shows the guest their invite and nothing else', async () => {
      const res = await call(server, base)
      assert.equal(res.status, 200)
      assert.equal(res.json.name, 'A Guest')
      assert.equal('id' in res.json, false)
      assert.equal('inviteToken' in res.json, false)
      assert.equal('invitedByMemberId' in res.json, false)
      assert.deepEqual(res.json.invitedByMember, { name: 'A Gun' })
    })

    it('an unknown or malformed token is a 404', async () => {
      assert.equal((await call(server, `/api/guests/token/${'c'.repeat(64)}`)).status, 404)
      assert.equal((await call(server, '/api/guests/token/short')).status, 401)
    })

    it('the old guest-ID routes are no longer public', async () => {
      const res = await call(server, `/api/guests/${data.a.guest.id}/accept`, {
        method: 'POST', body: { emergencyContactName: 'x', emergencyContactPhone: '0123456789', waiverAccepted: true },
      })
      assert.equal(res.status, 401)
    })

    it('accepting requires the waiver', async () => {
      const res = await call(server, `${base}/accept`, {
        method: 'POST', body: { emergencyContactName: 'Jo', emergencyContactPhone: '07700900000', waiverAccepted: false },
      })
      assert.equal(res.status, 400)
    })

    it('accepting confirms the guest; ShootSync no longer starts a card payment for the day fee', async () => {
      const accepted = await call(server, `${base}/accept`, {
        method: 'POST', body: { emergencyContactName: 'Jo', emergencyContactPhone: '07700900000', waiverAccepted: true },
      })
      assert.equal(accepted.status, 200)
      assert.equal(accepted.json.rsvpStatus, 'CONFIRMED')
      assert.equal(accepted.json.paymentStatus, 'PENDING')

      // The old public card-payment route is gone: not public, and not there for a signed-in user either.
      assert.equal((await call(server, '/api/stripe/create-checkout-session', { method: 'POST', body: { token: INVITE_TOKEN_A } })).status, 401)
      assert.equal((await call(server, '/api/stripe/create-checkout-session', { method: 'POST', as: CAPTAIN_A, body: { token: INVITE_TOKEN_A } })).status, 404)
      assert.equal(stripeCalls.checkoutCreates.length, 0)
    })

    it('the old card-payment pages are gone: not public, and not there for a signed-in user either', async () => {
      assert.equal((await call(server, '/api/stripe/session/cs_test_guestpaymentabcdef')).status, 401)
      assert.equal((await call(server, '/api/stripe/session/cs_test_guestpaymentabcdef', { as: CAPTAIN_A })).status, 404)
    })
  })

  describe('plan checkout', () => {
    // These start from a syndicate that has never had a plan (the seed is paid up).
    beforeEach(async () => {
      await prisma.syndicate.updateMany({ data: { stripeSubscriptionStatus: null, planTier: null, stripeSubscriptionId: null } })
    })

    it('is idempotent, so a double-click cannot start two subscriptions', async () => {
      await call(server, '/api/subscriptions/create-checkout', {
        method: 'POST', as: CAPTAIN_A, body: { syndicateId: data.a.syndicate.id, planTier: 'STANDARD', email: 'a@example.com' },
      })
      assert.match(stripeCalls.checkoutIdempotencyKeys[0] ?? '', new RegExp(`^shootsync-plan-checkout-${data.a.syndicate.id}-STANDARD-\\d+$`))
    })

    it('uses the configured price and the signed-in user, not the request', async () => {
      const res = await call(server, '/api/subscriptions/create-checkout', {
        method: 'POST', as: CAPTAIN_A,
        body: { syndicateId: data.a.syndicate.id, planTier: 'STARTER', email: 'a@example.com', clerkUserId: CAPTAIN_B },
      })
      assert.equal(res.status, 200)
      assert.equal(stripeCalls.checkoutCreates[0].line_items?.[0].price, 'price_starter_test')
    })

    const startCheckout = (planTier = 'STANDARD') => call(server, '/api/subscriptions/create-checkout', {
      method: 'POST', as: CAPTAIN_A, body: { syndicateId: data.a.syndicate.id, planTier, email: 'a@example.com' },
    })

    it('refuses a second plan when Stripe has one our record has not caught up with yet', async () => {
      subscriptions.set('sub_live', { id: 'sub_live', status: 'incomplete', customer: 'cus_secret_A', items: { data: [] }, metadata: {} } as unknown as Stripe.Subscription)
      assert.equal((await startCheckout()).status, 409)
      assert.equal(stripeCalls.checkoutCreates.length, 0)
      // An ended subscription doesn't count.
      subscriptions.set('sub_live', { id: 'sub_live', status: 'canceled', customer: 'cus_secret_A', items: { data: [] }, metadata: {} } as unknown as Stripe.Subscription)
      assert.equal((await startCheckout()).status, 200)
    })

    it('sends a captain whose payment failed to update their card, not to buy a second plan', async () => {
      for (const status of ['PAST_DUE', 'UNPAID'] as const) {
        await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionStatus: status } })
        const res = await startCheckout()
        assert.equal(res.status, 409, status)
        assert.match(res.json.error, /Update your card/, status)
      }
      assert.equal(stripeCalls.checkoutCreates.length, 0)
    })

    it('closes any other plan checkout page, so two plans can never both be paid for', async () => {
      stripeCalls.openSessions = [
        { id: 'cs_other_tab', mode: 'subscription', customer: 'cus_secret_A' },
        { id: 'cs_guest_fee', mode: 'payment', customer: 'cus_secret_A' },
      ]
      const res = await startCheckout('STARTER')
      assert.equal(res.status, 200)
      assert.deepEqual(stripeCalls.expired, ['cs_other_tab'])
    })

    it('changing plan and back again never hands the captain a closed page', async () => {
      const urls: string[] = []
      for (const tier of ['STANDARD', 'STARTER', 'STANDARD']) {
        // Each new page closes the others, as Stripe would see them.
        stripeCalls.openSessions = stripeCalls.checkoutCreates.map((_, i) => ({ id: `cs_test_${i + 1}abcdefghij`, mode: 'subscription', customer: 'cus_secret_A' }))
          .filter((x) => !stripeCalls.expired.includes(x.id))
        const res = await startCheckout(tier)
        assert.equal(res.status, 200)
        urls.push(res.json.url)
      }
      const last = urls[2].split('/').pop() ?? ''
      assert.ok(!stripeCalls.expired.includes(last), 'the page given out has been closed')
      assert.equal(stripeCalls.checkoutCreates.length, 3)
    })

    it("if another page can't be closed (it is being paid for), no second page is offered", async () => {
      stripeCalls.openSessions = [{ id: 'cs_being_paid', mode: 'subscription', customer: 'cus_secret_A' }]
      stripeCalls.expireFails = true
      const res = await startCheckout()
      assert.equal(res.status, 409)
      assert.deepEqual(stripeCalls.expired, ['cs_test_1abcdefghij'])
    })

    it('refuses an unknown plan', async () => {
      const res = await call(server, '/api/subscriptions/create-checkout', {
        method: 'POST', as: CAPTAIN_A, body: { syndicateId: data.a.syndicate.id, planTier: 'FREE', email: 'a@example.com' },
      })
      assert.equal(res.status, 400)
    })
  })

  describe('Stripe webhook', () => {
    // These start from a syndicate that has never had a plan (the seed is paid up).
    beforeEach(async () => {
      await prisma.syndicate.updateMany({ data: { stripeSubscriptionStatus: null, planTier: null, stripeSubscriptionId: null } })
    })

    function signed(payload: object) {
      const body = JSON.stringify(payload)
      const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: TEST_WEBHOOK_SECRET })
      return { body, signature }
    }

    async function post(path: string, body: string, signature?: string) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (signature) headers['Stripe-Signature'] = signature
      const res = await fetch(`${server.baseUrl}${path}`, { method: 'POST', headers, body })
      return res.status
    }

    const guestPaid = (guestId: string) => ({
      id: 'evt_test_guest',
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_x', object: 'checkout.session', mode: 'payment', payment_status: 'paid', payment_intent: 'pi_test_1', amount_total: 5000, currency: 'gbp', metadata: { type: 'guest_day_fee', guestId } } },
    })

    it('rejects an unsigned or wrongly signed event and changes nothing', async () => {
      const { body } = signed(guestPaid(data.a.guest.id))
      assert.equal(await post('/api/stripe/webhook', body), 400)
      assert.equal(await post('/api/stripe/webhook', body, 't=1,v1=deadbeef'), 400)
      const guest = await prisma.guestGun.findUnique({ where: { id: data.a.guest.id } })
      assert.equal(guest?.paymentStatus, 'PENDING')
    })

    for (const path of ['/api/stripe/webhook', '/api/subscriptions/webhook']) {
      it(`${path} records a guest payment`, async () => {
        const { body, signature } = signed(guestPaid(data.a.guest.id))
        assert.equal(await post(path, body, signature), 200)
        const guest = await prisma.guestGun.findUnique({ where: { id: data.a.guest.id } })
        assert.equal(guest?.paymentStatus, 'PAID')
      })

      it(`${path} activates a plan subscription`, async () => {
        subscriptions.set('sub_test_1', {
          id: 'sub_test_1',
          status: 'active',
          current_period_end: 1_800_000_000,
          items: { data: [{ price: { id: 'price_standard_test' } }] },
          metadata: { syndicateId: data.a.syndicate.id, planTier: 'STANDARD' },
        } as unknown as Stripe.Subscription)

        const { body, signature } = signed({
          id: 'evt_test_sub',
          object: 'event',
          type: 'checkout.session.completed',
          data: { object: { id: 'cs_test_y', object: 'checkout.session', mode: 'subscription', subscription: 'sub_test_1', metadata: { syndicateId: data.a.syndicate.id, planTier: 'STANDARD' } } },
        })
        assert.equal(await post(path, body, signature), 200)

        const status = await call(server, `/api/subscriptions/status/${data.a.syndicate.id}`, { as: CAPTAIN_A })
        assert.equal(status.json.isActive, true)
        assert.equal(status.json.planTier, 'STANDARD')
      })
    }

    // Shaped like the live endpoint's events (API 2025-12-15.clover): the renewal date is on the
    // items, not the subscription. The app must fetch the subscription rather than read this.
    const cloverEvent = (type: string, subscriptionId: string, status: string) => ({
      id: `evt_test_${type}_${subscriptionId}`,
      object: 'event',
      api_version: '2025-12-15.clover',
      type,
      data: { object: { id: subscriptionId, object: 'subscription', status, items: { data: [{ current_period_end: 1_700_000_000, price: { id: 'price_starter_test' } }] }, metadata: { syndicateId: data.a.syndicate.id } } },
    })
    const stripeSub = (id: string, status: string, extra: Record<string, unknown> = {}) =>
      subscriptions.set(id, {
        id, status, current_period_end: 1_800_000_000,
        items: { data: [{ price: { id: 'price_standard_test' } }] },
        metadata: { syndicateId: data.a.syndicate.id, planTier: 'STANDARD' },
        ...extra,
      } as unknown as Stripe.Subscription)
    const syndicateA = () => prisma.syndicate.findUnique({ where: { id: data.a.syndicate.id } })

    it('records a cancellation of the plan the syndicate is on', async () => {
      await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionId: 'sub_test_2', stripeSubscriptionStatus: 'ACTIVE' } })
      stripeSub('sub_test_2', 'canceled')
      const { body, signature } = signed(cloverEvent('customer.subscription.deleted', 'sub_test_2', 'canceled'))
      assert.equal(await post('/api/stripe/webhook', body, signature), 200)
      const row = await syndicateA()
      assert.equal(row?.stripeSubscriptionStatus, 'CANCELLED')
      const status = await call(server, `/api/subscriptions/status/${data.a.syndicate.id}`, { as: CAPTAIN_A })
      assert.equal(status.json.isActive, false)
    })

    it('a captain who cancelled can subscribe again', async () => {
      await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionId: 'sub_old', stripeSubscriptionStatus: 'CANCELLED' } })
      stripeSub('sub_again', 'active')
      // The new subscription's own event can arrive before the checkout: it's held back...
      const early = signed(cloverEvent('customer.subscription.updated', 'sub_again', 'active'))
      assert.equal(await post('/api/stripe/webhook', early.body, early.signature), 200)
      assert.equal((await syndicateA())?.stripeSubscriptionId, 'sub_old')
      // ...and the checkout then moves the syndicate on to it.
      const checkout = signed({
        id: 'evt_test_again', object: 'event', type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_again', object: 'checkout.session', mode: 'subscription', subscription: 'sub_again', metadata: { syndicateId: data.a.syndicate.id, planTier: 'STANDARD' } } },
      })
      assert.equal(await post('/api/stripe/webhook', checkout.body, checkout.signature), 200)
      const row = await syndicateA()
      assert.deepEqual([row?.stripeSubscriptionId, row?.stripeSubscriptionStatus], ['sub_again', 'ACTIVE'])
    })

    it('the plan follows the price the subscription is on, so a change made in Stripe is seen', async () => {
      stripeSub('sub_changed', 'active', { items: { data: [{ price: { id: 'price_starter_test' } }] } }) // metadata still says STANDARD
      const { body, signature } = signed(cloverEvent('customer.subscription.updated', 'sub_changed', 'active'))
      assert.equal(await post('/api/stripe/webhook', body, signature), 200)
      assert.equal((await syndicateA())?.planTier, 'STARTER')
    })

    it("records Stripe's current state, not the event's: renewal date and status from the fetched subscription", async () => {
      // The event says active, but by the time it arrives Stripe says past due.
      stripeSub('sub_test_3', 'past_due')
      const { body, signature } = signed(cloverEvent('customer.subscription.updated', 'sub_test_3', 'active'))
      assert.equal(await post('/api/subscriptions/webhook', body, signature), 200)
      const row = await syndicateA()
      assert.equal(row?.stripeSubscriptionStatus, 'PAST_DUE')
      assert.equal(row?.subscriptionCurrentPeriodEnd?.getTime(), 1_800_000_000_000)
      assert.equal(row?.stripePriceId, 'price_standard_test')
    })

    it("records Stripe's 'unpaid' (retries over) as UNPAID, apart from 'past_due' (still retrying)", async () => {
      stripeSub('sub_unpaid', 'unpaid')
      const { body, signature } = signed(cloverEvent('customer.subscription.updated', 'sub_unpaid', 'unpaid'))
      assert.equal(await post('/api/stripe/webhook', body, signature), 200)
      assert.equal((await syndicateA())?.stripeSubscriptionStatus, 'UNPAID')
    })

    it('reads the renewal date from the items when the subscription has none, and never saves an invalid date', async () => {
      stripeSub('sub_test_4', 'active', { current_period_end: undefined, items: { data: [{ current_period_end: 1_850_000_000, price: { id: 'price_standard_test' } }] } })
      const first = signed(cloverEvent('customer.subscription.updated', 'sub_test_4', 'active'))
      assert.equal(await post('/api/stripe/webhook', first.body, first.signature), 200)
      assert.equal((await syndicateA())?.subscriptionCurrentPeriodEnd?.getTime(), 1_850_000_000_000)

      // No date anywhere: the status is still recorded and the last known date is kept.
      stripeSub('sub_test_4', 'past_due', { current_period_end: undefined, items: { data: [{ price: { id: 'price_standard_test' } }] } })
      const second = signed({ ...cloverEvent('customer.subscription.updated', 'sub_test_4', 'past_due'), id: 'evt_test_nodate' })
      assert.equal(await post('/api/stripe/webhook', second.body, second.signature), 200)
      const row = await syndicateA()
      assert.equal(row?.stripeSubscriptionStatus, 'PAST_DUE')
      assert.equal(row?.subscriptionCurrentPeriodEnd?.getTime(), 1_850_000_000_000)
    })

    it('if a second plan is ever paid for, it says so loudly, naming the one to refund', async (t) => {
      const errors = t.mock.method(console, 'error', () => undefined)
      await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionId: 'sub_first', stripeSubscriptionStatus: 'ACTIVE' } })
      // A redelivered checkout for the plan it's already on is not an alarm.
      stripeSub('sub_first', 'active')
      const again = signed({
        id: 'evt_test_first_again', object: 'event', type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_first', object: 'checkout.session', mode: 'subscription', subscription: 'sub_first', metadata: { syndicateId: data.a.syndicate.id, planTier: 'STANDARD' } } },
      })
      assert.equal(await post('/api/stripe/webhook', again.body, again.signature), 200)
      assert.equal(errors.mock.callCount(), 0)

      stripeSub('sub_second', 'active')
      const { body, signature } = signed({
        id: 'evt_test_second', object: 'event', type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_second', object: 'checkout.session', mode: 'subscription', subscription: 'sub_second', metadata: { syndicateId: data.a.syndicate.id, planTier: 'STANDARD' } } },
      })
      assert.equal(await post('/api/stripe/webhook', body, signature), 200)
      assert.ok(errors.mock.calls.some((c) => String(c.arguments[0]).includes('Cancel and refund sub_first')))
      assert.equal((await syndicateA())?.stripeSubscriptionId, 'sub_second')
    })

    it("a late event about an old subscription can't cancel the syndicate's new one", async () => {
      await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionId: 'sub_new', stripeSubscriptionStatus: 'ACTIVE' } })
      stripeSub('sub_old', 'canceled')
      const late = signed(cloverEvent('customer.subscription.deleted', 'sub_old', 'canceled'))
      assert.equal(await post('/api/stripe/webhook', late.body, late.signature), 200)
      // Nor can a redelivered checkout for that old subscription.
      const oldCheckout = signed({
        id: 'evt_test_old_checkout', object: 'event', type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_old', object: 'checkout.session', mode: 'subscription', subscription: 'sub_old', metadata: { syndicateId: data.a.syndicate.id, planTier: 'STANDARD' } } },
      })
      assert.equal(await post('/api/stripe/webhook', oldCheckout.body, oldCheckout.signature), 200)
      const row = await syndicateA()
      assert.deepEqual([row?.stripeSubscriptionId, row?.stripeSubscriptionStatus], ['sub_new', 'ACTIVE'])
    })

    it("if Stripe can't be reached the delivery fails, so Stripe sends it again, and nothing is changed", async () => {
      const { body, signature } = signed(cloverEvent('customer.subscription.deleted', 'sub_network_down', 'canceled'))
      assert.equal(await post('/api/stripe/webhook', body, signature), 500)
      assert.equal((await syndicateA())?.stripeSubscriptionStatus, null)
    })

    it("an event for a subscription Stripe doesn't have is acknowledged, not retried for days, and changes nothing", async () => {
      const gone = signed(cloverEvent('customer.subscription.deleted', 'sub_deleted', 'canceled'))
      assert.equal(await post('/api/stripe/webhook', gone.body, gone.signature), 200)
      const goneCheckout = signed({
        id: 'evt_test_gone_checkout', object: 'event', type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_gone', object: 'checkout.session', mode: 'subscription', subscription: 'sub_deleted', metadata: { syndicateId: data.a.syndicate.id } } },
      })
      assert.equal(await post('/api/stripe/webhook', goneCheckout.body, goneCheckout.signature), 200)
      assert.equal((await syndicateA())?.stripeSubscriptionStatus, null)
    })
  })
})
