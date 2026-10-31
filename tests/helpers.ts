/**
 * Test harness - runs the real Express app against a real Postgres test database.
 *
 * The only stand-ins are at the edges: a token verifier (so tests can sign in as
 * any user without a live Clerk call) and Stripe's network calls. Every
 * authorisation decision under test is the production code path.
 */

import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'
import { createApp } from '../server/app.js'
import type { AppConfig } from '../server/config.js'
import { refusal, sessionFromClaims, type TokenVerifier } from '../server/auth.js'
import { waiverHash, waiverText } from '../server/waiver.js'
import { sealBankNumbers } from '../server/bankCrypto.js'
import { consoleAlerts, type AlertKind } from '../server/alerts.js'
import { hashInviteToken } from '../server/inviteTokens.js'

export const TEST_WEBHOOK_SECRET = 'whsec_test_shootsync'
/** The key test bank details are sealed with. Never a real key. */
export const TEST_BANK_KEY = Buffer.alloc(32, 7)

export const testConfig: AppConfig = {
  isProduction: false,
  frontendUrl: 'https://shootsync.test',
  allowedOrigins: ['https://shootsync.test'],
  clerkSecretKey: 'sk_test_unused',
  stripeSecretKey: 'sk_test_unused',
  stripeWebhookSecret: TEST_WEBHOOK_SECRET,
  stripePriceIds: { STARTER: 'price_starter_test', STANDARD: 'price_standard_test' },
  sentryDsn: null,
  release: 'test',
  bankKeys: { current: TEST_BANK_KEY, previous: null },
  resendApiKey: null,
}

/** Alerts raised by the server under test, so a test can assert that a human would be told. */
export type RecordedAlert = { kind: AlertKind; message: string; details: Record<string, unknown> }
export type RecordedReport = { reference: string; context: string; details: Record<string, unknown>; error: unknown }

/**
 * "test-token.<userId>" signs in as <userId>, in session sess_<userId>, signed in a minute ago.
 * "test-token.<userId>.<minutes>" says how many minutes ago, and "test-token.<userId>.nofva"
 * carries no sign-in age at all. Anything else is rejected, like a bad Clerk token. The claims go
 * through the same reader as Clerk's (sessionFromClaims), issued now.
 */
export const testVerifier: TokenVerifier = async (token) => {
  const match = /^test-token\.(user_[A-Za-z0-9_]+)(?:\.(\d+|nofva))?$/.exec(token)
  if (!match) throw refusal('invalid token')
  const iat = Math.floor(Date.now() / 1000)
  const fva = match[2] === 'nofva' ? undefined : [match[2] === undefined ? 1 : Number(match[2]), -1]
  return sessionFromClaims({ sub: match[1], sid: `sess_${match[1]}`, fva, iat }, iat)
}

/** What a guest sends to accept: an emergency contact and the hash of the acknowledgement they were shown. */
export function acceptBody(waiverExtra: string | null = null, contact = { emergencyContactName: 'Jo', emergencyContactPhone: '07700900000' }) {
  return { ...contact, waiverAccepted: true, waiverTextHash: waiverHash(waiverText(waiverExtra)) }
}

export const tokenFor = (userId: string, minutesSinceSignIn?: number | 'nofva') =>
  minutesSinceSignIn === undefined ? `test-token.${userId}` : `test-token.${userId}.${minutesSinceSignIn}`

/** A client for the disposable test database, or for another database on the same server. */
export function createTestPrisma(databaseUrl = process.env.DATABASE_URL): PrismaClient {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must point at a disposable test database')
  }
  return new PrismaClient({ datasourceUrl: databaseUrl })
}

/** The test database's address with a different database name (same server, same user). */
export function databaseUrlFor(name: string): string {
  const url = new URL(process.env.DATABASE_URL!)
  url.pathname = `/${name}`
  return url.toString()
}

export interface StripeCalls {
  checkoutCreates: Stripe.Checkout.SessionCreateParams[]
  checkoutIdempotencyKeys: Array<string | undefined>
  customersCreated: Stripe.CustomerCreateParams[]
  /** Checkout sessions the test says are open in Stripe; `expire` removes them (or fails if `expireFails`). */
  openSessions: Array<{ id: string; mode: string; customer: string }>
  expired: string[]
  expireFails: boolean
}

/** What the Stripe SDK throws for an object that doesn't exist. */
export const stripeMissing = (what: string) => Object.assign(new Error(`No such ${what}`), { type: 'StripeInvalidRequestError', code: 'resource_missing' })

/** A real Stripe SDK instance (so webhook signatures are verified for real) with its network calls stubbed. */
export function createTestStripe(): { stripe: Stripe; calls: StripeCalls; subscriptions: Map<string, Stripe.Subscription>; charges: Map<string, Stripe.Charge>; disputes: Map<string, Stripe.Dispute> } {
  const stripe = new Stripe('sk_test_unused', { apiVersion: '2023-10-16' })
  const calls: StripeCalls = { checkoutCreates: [], checkoutIdempotencyKeys: [], customersCreated: [], openSessions: [], expired: [], expireFails: false }
  const subscriptions = new Map<string, Stripe.Subscription>()
  const charges = new Map<string, Stripe.Charge>()
  // Disputes Stripe knows about; one not listed is "missing", so the handler falls back to the event.
  const disputes = new Map<string, Stripe.Dispute>()
  const disputesApi = stripe.disputes as unknown as Record<string, unknown>
  disputesApi.retrieve = async (id: string) => {
    const dispute = disputes.get(id)
    if (!dispute) throw stripeMissing('dispute')
    return dispute
  }
  const chargesApi = stripe.charges as unknown as Record<string, unknown>
  chargesApi.retrieve = async (id: string) => {
    const charge = charges.get(id)
    if (!charge) throw stripeMissing('charge')
    return charge
  }

  const sessions = stripe.checkout.sessions as unknown as Record<string, unknown>
  // Like Stripe, a repeated idempotency key returns the session made the first time, as it is now.
  const byKey = new Map<string, string>()
  sessions.create = async (params: Stripe.Checkout.SessionCreateParams, options?: Stripe.RequestOptions) => {
    calls.checkoutIdempotencyKeys.push(options?.idempotencyKey)
    const replayed = options?.idempotencyKey ? byKey.get(options.idempotencyKey) : undefined
    const id = replayed ?? `cs_test_${calls.checkoutCreates.length + 1}abcdefghij`
    if (!replayed) {
      calls.checkoutCreates.push(params)
      if (options?.idempotencyKey) byKey.set(options.idempotencyKey, id)
    }
    return { id, url: `https://checkout.stripe.test/${id}`, status: calls.expired.includes(id) ? 'expired' : 'open' }
  }
  sessions.retrieve = async (id: string) => {
    if (id === 'cs_test_guestpaymentabcdef') {
      return { id, payment_status: 'paid', customer_email: 'guest@example.com', amount_total: 5000, metadata: { type: 'guest_day_fee' } }
    }
    if (id === 'cs_test_othersessionabcdef') {
      return { id, payment_status: 'paid', customer_email: 'someone@example.com', amount_total: 99900, metadata: {} }
    }
    throw new Error('No such checkout session')
  }
  sessions.list = async (params: { customer?: string; status?: string }) => ({
    data: calls.openSessions.filter((x) => x.customer === params.customer && params.status === 'open'),
  })
  sessions.expire = async (id: string) => {
    if (calls.expireFails && calls.openSessions.some((x) => x.id === id)) throw new Error('This Checkout Session is not open')
    calls.expired.push(id)
    calls.openSessions = calls.openSessions.filter((x) => x.id !== id)
    return { id, status: 'expired' }
  }

  const customers = stripe.customers as unknown as Record<string, unknown>
  customers.create = async (params: Stripe.CustomerCreateParams) => {
    calls.customersCreated.push(params)
    return { id: `cus_test_${calls.customersCreated.length}` }
  }

  const portal = stripe.billingPortal.sessions as unknown as Record<string, unknown>
  portal.create = async () => ({ url: 'https://billing.stripe.test/session' })

  const subs = stripe.subscriptions as unknown as Record<string, unknown>
  subs.retrieve = async (id: string) => {
    if (id === 'sub_network_down') throw Object.assign(new Error('An error occurred with our connection to Stripe'), { type: 'StripeConnectionError' })
    const sub = subscriptions.get(id)
    if (!sub) throw stripeMissing('subscription')
    return sub
  }
  subs.list = async (params: { customer?: string }) => ({
    data: [...subscriptions.values()].filter((x) => (x as unknown as { customer?: string }).customer === params.customer),
  })

  return { stripe, calls, subscriptions, charges, disputes }
}

export interface TestServer {
  baseUrl: string
  /** Every alert the server raised: what a human would have been told. */
  alerts: RecordedAlert[]
  /** Every unexpected failure the server reported, with the reference its user was given. */
  reports: RecordedReport[]
  close: () => Promise<void>
}

/**
 * The date the test server believes it is: the seeded shoot days' own date (14 Nov 2026), so
 * whenever the tests run a guest can still accept, and the day can be completed. Tests about
 * dates pass their own.
 */
export const TEST_TODAY = '2026-11-14'

export async function startTestServer(prisma: PrismaClient, stripe: Stripe, verifyToken: TokenVerifier = testVerifier, today: () => string = () => TEST_TODAY): Promise<TestServer> {
  const alerts: RecordedAlert[] = []
  const reports: RecordedReport[] = []
  const app = createApp({ prisma, stripe, config: testConfig, verifyToken, today, alerts: consoleAlerts(alerts, reports) })
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  const { port } = server.address() as AddressInfo
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    alerts,
    reports,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  }
}

export interface CallOptions {
  method?: string
  as?: string | null
  body?: unknown
  rawToken?: string
  headers?: Record<string, string>
}

export async function call(server: TestServer, path: string, options: CallOptions = {}) {
  const headers: Record<string, string> = { ...(options.headers ?? {}) }
  if (options.as) headers.Authorization = `Bearer ${tokenFor(options.as)}`
  if (options.rawToken) headers.Authorization = `Bearer ${options.rawToken}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${server.baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  const text = await response.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { status: response.status, json, headers: response.headers }
}

const TABLES = [
  'deletion_warnings',
  'activity_logs',
  'bag_records',
  'beater_bookings',
  'beater_payments',
  'member_payments',
  'guest_guns',
  'shoot_attendances',
  'shoot_days',
  'beaters',
  'members',
  'syndicates',
  'session_activity',
]

export async function resetDatabase(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} CASCADE`)
}

export const CAPTAIN_A = 'user_captainA'
export const CAPTAIN_B = 'user_captainB'
export const GUN_A = 'user_gunA'
export const STRANGER = 'user_stranger'
export const BEATER_ROLE_A = 'user_captainA_beaterRole'

export const INVITE_TOKEN_A = 'a'.repeat(64)

/** Two complete, separate syndicates. Every test proves B can't reach A and A can. */
export async function seed(prisma: PrismaClient) {
  const makeSyndicate = async (captain: string, label: string, gunClerkId: string | null, inviteToken: string) => {
    const syndicate = await prisma.syndicate.create({
      data: {
        name: `${label} Syndicate`,
        captainClerkId: captain,
        seasonStart: new Date('2026-10-01'),
        seasonEnd: new Date('2027-02-01'),
        subscriptionAmount: 800,
        stripeCustomerId: `cus_secret_${label}`,
        // Paid up, on the plan with room to spare: tests about lapsed plans and limits say so themselves.
        stripeSubscriptionStatus: 'ACTIVE',
        planTier: 'STANDARD',
      },
    })
    const captainMember = await prisma.member.create({
      data: { syndicateId: syndicate.id, clerkUserId: captain, email: `${label}captain@example.com`, name: `${label} Captain`, role: 'CAPTAIN', status: 'ACTIVE' },
    })
    const gun = await prisma.member.create({
      data: {
        syndicateId: syndicate.id,
        clerkUserId: gunClerkId ?? `pending_${label}`,
        email: `${label}gun@example.com`,
        name: `${label} Gun`,
        role: 'GUN',
        status: 'ACTIVE',
        emergencyContactName: `${label} Next of kin`,
      },
    })
    // Bank details sealed, as the server stores them (server/bankCrypto.ts).
    const created = await prisma.beater.create({ data: { syndicateId: syndicate.id, name: `${label} Beater`, bankName: 'Bank' } })
    const beater = await prisma.beater.update({
      where: { id: created.id },
      data: { bankDetailsSealed: sealBankNumbers({ sortCode: '12-34-56', accountNumber: '12345678' }, created.id, TEST_BANK_KEY), bankAccountLast4: '5678' },
    })
    // A member with the BEATER role: signed in, active, but not a gun.
    await prisma.member.create({
      data: { syndicateId: syndicate.id, clerkUserId: `${captain}_beaterRole`, email: `${label}beaterrole@example.com`, name: `${label} Beater Member`, role: 'BEATER', status: 'ACTIVE' },
    })
    const shoot = await prisma.shootDay.create({
      data: { syndicateId: syndicate.id, date: new Date('2026-11-14'), locationName: `${label} Farm`, captainNotes: `${label} captain-only notes`, weatherNotes: 'Windy' },
    })
    await prisma.shootAttendance.create({ data: { shootId: shoot.id, memberId: gun.id, pegNumber: 3 } })
    const bag = await prisma.bagRecord.create({ data: { shootId: shoot.id, driveNumber: 1, pheasant: 12, recordedByMemberId: gun.id } })
    const booking = await prisma.beaterBooking.create({
      data: { syndicateId: syndicate.id, beaterId: beater.id, shootId: shoot.id, dayRatePence: 4000, status: 'CONFIRMED' },
    })
    const payment = await prisma.beaterPayment.create({
      data: { syndicateId: syndicate.id, beaterId: beater.id, shootId: shoot.id, amount: 4000 },
    })
    const guest = await prisma.guestGun.create({
      // The link's token is what the tests use; the row holds its hash, as production does (0007).
      data: { shootId: shoot.id, invitedByMemberId: gun.id, name: `${label} Guest`, email: `${label}guest@example.com`, dayFee: 5000, inviteToken: hashInviteToken(inviteToken) },
    })
    return { syndicate, captainMember, gun, beater, shoot, bag, booking, payment, guest }
  }

  const a = await makeSyndicate(CAPTAIN_A, 'A', GUN_A, INVITE_TOKEN_A)
  const b = await makeSyndicate(CAPTAIN_B, 'B', null, 'b'.repeat(64))
  return { a, b }
}

/** Every route registered on the app, read from Express itself, so a new route can't be missed. */
export function registeredRoutes(prisma: PrismaClient, stripe: Stripe): Array<{ method: string; path: string }> {
  const app = createApp({ prisma, stripe, config: testConfig, verifyToken: testVerifier, alerts: consoleAlerts() })
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
export function concrete(path: string): string {
  return path.replace(/:[A-Za-z]+/g, 'cl0000000000000000000000')
}
