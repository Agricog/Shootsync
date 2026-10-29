/**
 * Session limits, on the server: 12 hours from sign-in, 10 minutes
 * idle (the server allows the browser's ping interval on top, so it never refuses someone the
 * browser still counts as active). The browser's clock runs on the same numbers.
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { CAPTAIN_A, CAPTAIN_B, call, createTestPrisma, createTestStripe, resetDatabase, seed, startTestServer, tokenFor, type TestServer } from './helpers.js'
import { KEEP_SESSION_ROWS_DAYS, SERVER_IDLE_MINUTES, SESSION_ENDED_MESSAGES, SESSION_LIMITS, absoluteLimitReached } from '../server/sessionPolicy.js'
import { sessionFromClaims } from '../server/auth.js'

/** The absolute limit, in minutes. */
const LIMIT = SESSION_LIMITS.absoluteMinutes
import { SESSION_CLOCK, SESSION_ENDED_TEXT } from '../src/lib/sessionClock.js'

describe('reading a Clerk session token', () => {
  const now = 1_800_000_000

  it('takes the user, the session, and how long since sign-in to the second', () => {
    assert.deepEqual(sessionFromClaims({ sub: 'user_x', sid: 'sess_x', fva: [3, -1], iat: now - 20 }, now), { userId: 'user_x', sessionId: 'sess_x', secondsSinceSignIn: 200 })
  })

  it('counts the token’s own age, so a token issued a minute before the limit is refused once the limit has passed', () => {
    const at = (age: number) => sessionFromClaims({ sub: 'user_x', sid: 'sess_x', fva: [LIMIT - 1, -1], iat: now - age }, now)
    assert.equal(absoluteLimitReached(at(59)), false)
    assert.equal(absoluteLimitReached(at(60)), true)
  })

  it('refuses a token without a user or a session', () => {
    assert.throws(() => sessionFromClaims({ sid: 'sess_x', fva: [3, -1], iat: now }, now))
    assert.throws(() => sessionFromClaims({ sub: 'user_x', fva: [3, -1], iat: now }, now))
  })

  it('a token that doesn’t say when the user signed in is not refused for that: the server’s own record covers it', () => {
    for (const claims of [{}, { fva: [] }, { fva: ['3', -1] }, { fva: [-1, -1] }, { fva: [3, -1], iat: 'x' }]) {
      const session = sessionFromClaims({ sub: 'user_x', sid: 'sess_x', iat: now, ...claims }, now)
      assert.equal(session.secondsSinceSignIn, null, JSON.stringify(claims))
      assert.equal(absoluteLimitReached(session), false)
    }
  })
})

describe('the browser and the server keep the same limits', () => {
  it('12 hours absolute, 10 minutes idle, the same sentences, and the server allows one ping gap more', () => {
    assert.equal(SESSION_CLOCK.absoluteMs, SESSION_LIMITS.absoluteMinutes * 60_000)
    assert.equal(SESSION_CLOCK.idleMs, SESSION_LIMITS.idleMinutes * 60_000)
    assert.equal(SESSION_CLOCK.pingEveryMs, SESSION_LIMITS.pingEveryMinutes * 60_000)
    assert.equal(SERVER_IDLE_MINUTES, SESSION_LIMITS.idleMinutes + SESSION_LIMITS.pingEveryMinutes)
    assert.deepEqual(SESSION_ENDED_TEXT, SESSION_ENDED_MESSAGES)
    assert.deepEqual([SESSION_LIMITS.absoluteMinutes, SESSION_LIMITS.idleMinutes], [12 * 60, 10])
    // A refused session's row must outlive anything Clerk could still issue tokens for (7 days by
    // default), or the session could come back looking new.
    assert.ok(KEEP_SESSION_ROWS_DAYS > 7)
  })
})

describe('session limits on the server', () => {
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

  beforeEach(async () => {
    await resetDatabase(prisma)
    await seed(prisma)
  })

  const asMinutes = (minutes: number, user = CAPTAIN_A) => call(server, '/api/me', { rawToken: tokenFor(user, minutes) })
  const startedAgo = (minutes: number, user = CAPTAIN_A) =>
    prisma.$executeRaw`UPDATE "session_activity" SET "first_seen_at" = (now() AT TIME ZONE 'UTC') - make_interval(mins => ${minutes}::int) WHERE "session_id" = ${`sess_${user}`}`
  const quietFor = (minutes: number, user = CAPTAIN_A) =>
    prisma.$executeRaw`UPDATE "session_activity" SET "last_seen_at" = (now() AT TIME ZONE 'UTC') - make_interval(mins => ${minutes}::int) WHERE "session_id" = ${`sess_${user}`}`

  it('up to a minute before the limit, requests are answered', async () => {
    assert.equal((await asMinutes(0)).status, 200)
    assert.equal((await asMinutes(LIMIT - 1)).status, 200)
  })

  it('from the limit on, every request is refused with the reason, and the browser is told to sign out', async () => {
    for (const minutes of [LIMIT, LIMIT * 2]) {
      const res = await asMinutes(minutes)
      assert.equal(res.status, 401)
      assert.deepEqual(res.json, { error: SESSION_ENDED_MESSAGES.absolute, code: 'session_ended', reason: 'absolute' })
    }
  })

  it('the limit after the server first saw the session, it ends, even if the token says the user just verified again', async () => {
    assert.equal((await asMinutes(0)).status, 200)
    await startedAgo(LIMIT - 1)
    assert.equal((await asMinutes(0)).status, 200)
    await startedAgo(LIMIT)
    const res = await asMinutes(0)
    assert.equal(res.status, 401)
    assert.equal(res.json.reason, 'absolute')
  })

  it('a token without a sign-in age still gets the absolute limit, from the server’s record', async () => {
    const plain = () => call(server, '/api/me', { rawToken: tokenFor(CAPTAIN_A, 'nofva') })
    assert.equal((await plain()).status, 200)
    await startedAgo(LIMIT)
    assert.equal((await plain()).json.reason, 'absolute')
  })

  it(`a session quiet for longer than ${SERVER_IDLE_MINUTES} minutes is refused, and stays refused`, async () => {
    assert.equal((await asMinutes(1)).status, 200)
    await quietFor(SERVER_IDLE_MINUTES + 1)
    const res = await asMinutes(2)
    assert.equal(res.status, 401)
    assert.deepEqual(res.json, { error: SESSION_ENDED_MESSAGES.idle, code: 'session_ended', reason: 'idle' })
    assert.equal((await asMinutes(2)).status, 401, 'a refused session is not revived by trying again')
  })

  it('quiet for just under the limit is fine, and the request counts as activity', async () => {
    assert.equal((await asMinutes(1)).status, 200)
    await quietFor(SERVER_IDLE_MINUTES - 1)
    assert.equal((await asMinutes(2)).status, 200)
    const [row] = await prisma.$queryRaw<Array<{ quiet: number }>>`SELECT EXTRACT(EPOCH FROM ((now() AT TIME ZONE 'UTC') - "last_seen_at"))::float AS quiet FROM "session_activity" WHERE "session_id" = ${`sess_${CAPTAIN_A}`}`
    assert.ok(row.quiet < 5, `last seen ${row.quiet}s ago`)
  })

  it('the ping keeps a busy session alive without changing anything else', async () => {
    assert.equal((await asMinutes(1)).status, 200)
    await quietFor(SERVER_IDLE_MINUTES - 1)
    const ping = await call(server, '/api/session/ping', { method: 'POST', rawToken: tokenFor(CAPTAIN_A, 3) })
    assert.equal(ping.status, 204)
    await quietFor(1)
    assert.equal((await asMinutes(4)).status, 200)
  })

  it('the ping needs a signed-in session, and is refused like anything else once it has ended', async () => {
    assert.equal((await call(server, '/api/session/ping', { method: 'POST' })).status, 401)
    assert.equal((await call(server, '/api/session/ping', { method: 'POST', rawToken: tokenFor(CAPTAIN_A, LIMIT) })).status, 401)
  })

  it("one user's idle session doesn't end another's", async () => {
    assert.equal((await asMinutes(1)).status, 200)
    assert.equal((await asMinutes(1, CAPTAIN_B)).status, 200)
    await quietFor(SERVER_IDLE_MINUTES + 1)
    assert.equal((await asMinutes(2)).status, 401)
    assert.equal((await asMinutes(2, CAPTAIN_B)).status, 200)
  })

  it(`rows for sessions started more than ${KEEP_SESSION_ROWS_DAYS} days ago (longer than Clerk keeps a session) are cleared when a new session starts`, async () => {
    await prisma.$executeRaw`INSERT INTO "session_activity" ("session_id", "first_seen_at", "last_seen_at") VALUES
      ('sess_old', (now() AT TIME ZONE 'UTC') - make_interval(days => ${KEEP_SESSION_ROWS_DAYS + 1}::int), (now() AT TIME ZONE 'UTC') - interval '8 days'),
      ('sess_recent', (now() AT TIME ZONE 'UTC') - make_interval(days => ${KEEP_SESSION_ROWS_DAYS - 1}::int), (now() AT TIME ZONE 'UTC') - interval '6 days')`
    assert.equal((await asMinutes(1)).status, 200)
    const ids = (await prisma.$queryRaw<Array<{ session_id: string }>>`SELECT "session_id" FROM "session_activity" `).map((r) => r.session_id).sort()
    assert.deepEqual(ids, ['sess_recent', `sess_${CAPTAIN_A}`].sort())
  })

  it('public routes are untouched by session limits', async () => {
    const res = await call(server, '/api/guests/token/' + 'a'.repeat(64))
    assert.equal(res.status, 200)
  })
})
