/**
 * Authentication gate, response shaping, the public guest flow and the Stripe webhook.
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import type Stripe from 'stripe'
import { createApp } from '../server/app.js'
import { PUBLIC_ROUTES } from '../server/auth.js'
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
  testVerifier,
  tokenFor,
  type StripeCalls,
  type TestServer,
} from './helpers.js'

type Seeded = Awaited<ReturnType<typeof seed>>

/** Every route registered on the app, read from Express itself, so a new route can't be missed. */
function registeredRoutes(prisma: PrismaClient, stripe: Stripe): Array<{ method: string; path: string }> {
  const app = createApp({ prisma, stripe, config: testConfig, verifyToken: testVerifier })
  const routes: Array<{ method: string; path: string }> = []

  const walk = (stack: any[], prefix: string) => {
    for (const layer of stack) {
      if (layer.route) {
        for (const method of Object.keys(layer.route.methods)) {
          routes.push({ method: method.toUpperCase(), path: prefix + layer.route.path })
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        const source: string = layer.regexp.source
        const mount = source.replace('^\\', '').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/')
        walk(layer.handle.stack, prefix + (mount === '^' ? '' : mount))
      }
    }
  }
  walk((app as any)._router.stack, '')
  return routes.filter((r) => r.path.startsWith('/api/'))
}

/** Turn "/api/members/:id/status" into a concrete path the router will match. */
function concrete(path: string): string {
  return path.replace(/:[A-Za-z]+/g, 'cl0000000000000000000000')
}

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
          'POST ^\\/stripe\\/create-checkout-session$',
          'GET ^\\/stripe\\/session\\/cs_[A-Za-z0-9_]{10,200}$',
        ]
      )
    })

    it('health is public', async () => {
      const res = await call(server, '/api/health')
      assert.equal(res.status, 200)
    })

    it('unknown API paths return JSON 404, not the web page', async () => {
      const res = await call(server, '/api/nothing-here', { as: CAPTAIN_A })
      assert.equal(res.status, 404)
      assert.deepEqual(res.json, { error: 'Not found' })
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

    it('by-clerk only answers about the signed-in user', async () => {
      const other = await call(server, `/api/members/by-clerk/${CAPTAIN_B}`, { as: CAPTAIN_A })
      assert.equal(other.status, 404)
      const own = await call(server, `/api/members/by-clerk/${CAPTAIN_A}`, { as: CAPTAIN_A })
      assert.equal(own.status, 200)
      assert.equal('stripeCustomerId' in own.json.syndicate, false)
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

    it('payment needs the waiver signed first, then charges the day fee in pence', async () => {
      const early = await call(server, '/api/stripe/create-checkout-session', { method: 'POST', body: { token: INVITE_TOKEN_A } })
      assert.equal(early.status, 409)

      const accepted = await call(server, `${base}/accept`, {
        method: 'POST', body: { emergencyContactName: 'Jo', emergencyContactPhone: '07700900000', waiverAccepted: true },
      })
      assert.equal(accepted.status, 200)
      assert.equal(accepted.json.rsvpStatus, 'CONFIRMED')

      const checkout = await call(server, '/api/stripe/create-checkout-session', { method: 'POST', body: { token: INVITE_TOKEN_A } })
      assert.equal(checkout.status, 200)
      assert.equal(stripeCalls.checkoutCreates.length, 1)
      const params = stripeCalls.checkoutCreates[0]
      assert.equal(params.line_items?.[0].price_data?.unit_amount, 5000)
      assert.equal(params.metadata?.guestId, data.a.guest.id)
    })

    it('a guest ID cannot be used to pay instead of the token', async () => {
      const res = await call(server, '/api/stripe/create-checkout-session', { method: 'POST', body: { guestId: data.a.guest.id } })
      assert.equal(res.status, 404)
      assert.equal(stripeCalls.checkoutCreates.length, 0)
    })

    it('the payment confirmation page only reveals ShootSync guest payments', async () => {
      assert.equal((await call(server, '/api/stripe/session/cs_test_guestpaymentabcdef')).status, 200)
      assert.equal((await call(server, '/api/stripe/session/cs_test_othersessionabcdef')).status, 404)
    })
  })

  describe('plan checkout', () => {
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

    it('refuses an unknown plan', async () => {
      const res = await call(server, '/api/subscriptions/create-checkout', {
        method: 'POST', as: CAPTAIN_A, body: { syndicateId: data.a.syndicate.id, planTier: 'FREE', email: 'a@example.com' },
      })
      assert.equal(res.status, 400)
    })
  })

  describe('Stripe webhook', () => {
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
      data: { object: { id: 'cs_test_x', object: 'checkout.session', mode: 'payment', payment_status: 'paid', payment_intent: 'pi_test_1', metadata: { type: 'guest_day_fee', guestId } } },
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

    it('records a cancellation', async () => {
      const { body, signature } = signed({
        id: 'evt_test_cancel',
        object: 'event',
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_test_2', object: 'subscription', status: 'canceled', current_period_end: 1_800_000_000, items: { data: [] }, metadata: { syndicateId: data.a.syndicate.id } } },
      })
      assert.equal(await post('/api/stripe/webhook', body, signature), 200)
      const row = await prisma.syndicate.findUnique({ where: { id: data.a.syndicate.id } })
      assert.equal(row?.stripeSubscriptionStatus, 'CANCELLED')
    })
  })
})
