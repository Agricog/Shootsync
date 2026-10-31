/**
 * Deletion warnings (batch 10a): a captain is emailed 30, 7 and 1 day before their syndicate's
 * records are deleted, each warning once, never a pile of them, never to a live plan, and never
 * twice however many servers run the job or wherever one stops. The email goes through Resend
 * exactly as Resend expects, and nothing about the captain reaches an alert or the activity log.
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { CAPTAIN_A, createTestPrisma, resetDatabase, seed } from './helpers.js'
import { consoleAlerts } from '../server/alerts.js'
import { CLAIM_LEASE_MS, clerkCaptainEmail, daysLeft, deletionDays, idempotencyKey, oneLine, runDeletionWarnings, warningDue, warningEmail, type CaptainEmail } from '../server/deletionWarnings.js'
import { MAIL_FROM, MAIL_REPLY_TO, MailError, isResendKey, resendMailer, type Mailer, type OutgoingEmail } from '../server/mailer.js'
import { RETENTION, deleteSyndicate, syndicateDeletionDate } from '../server/retention.js'
import { HIDDEN_CHARACTERS } from '../server/validation.js'
import { RETENTION as STATED, deletionWarningText } from '../src/config/retention.js'

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
const SITE = 'https://shootsync.test'
const ch = (...codes: number[]) => String.fromCodePoint(...codes)
/** Resend-shaped, built here so secret scanning never sees key-shaped text in the file. */
const FAKE_RESEND_KEY = ['re', 'Abc123', 'Def456ghi789JKL'].join('_')

const fakeFetch = (status: number, body: unknown, seen: Array<{ url: string; init: RequestInit }> = []) =>
  (async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), init: init ?? {} })
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

describe('when a warning is due', () => {
  it('counts days left rounded up, so a deletion 29 days and an hour away is 30 days away', () => {
    const deletion = new Date('2027-01-28T10:00:00Z')
    assert.equal(daysLeft(deletion, new Date(deletion.getTime() - 30 * DAY)), 30)
    assert.equal(daysLeft(deletion, new Date(deletion.getTime() - 29 * DAY - HOUR)), 30)
    assert.equal(daysLeft(deletion, new Date(deletion.getTime() - 29 * DAY)), 29)
    assert.equal(daysLeft(deletion, new Date(deletion.getTime() - 1)), 1)
    assert.equal(daysLeft(deletion, deletion), 0)
  })

  it('the most urgent warning whose time has come, and none outside 1 to 30 days', () => {
    const cases: Array<[number, number | null]> = [[31, null], [30, 30], [8, 30], [7, 7], [2, 7], [1, 1], [0, null], [-3, null]]
    for (const [days, stage] of cases) assert.equal(warningDue(days), stage, `${days} days left`)
  })

  it('the pages state the schedule the server keeps', () => {
    assert.deepEqual(STATED.deletionWarningDays, RETENTION.deletionWarningDays)
    assert.equal(deletionWarningText(), '30, 7 and 1 day')
    assert.equal(deletionWarningText([14, 2]), '14 and 2 days')
    assert.equal(deletionWarningText([3]), '3 days')
  })
})

describe('the warning email', () => {
  const deletionDate = new Date('2027-01-28T10:00:00Z')

  it('says what goes, on which day, the day to act by, and the two ways to act, in plain text and HTML', () => {
    const email = warningEmail({ syndicateName: 'Beatrice', deletionDate, stage: 30, archived: false, siteUrl: SITE })
    assert.equal(email.subject, 'Beatrice: records will be deleted on Thursday 28 January 2027')
    assert.match(email.text, /no active ShootSync plan/)
    assert.match(email.text, /deleted for good on Thursday 28 January 2027\. To be safe, act by Wednesday 27 January 2027\./)
    assert.match(email.text, /choose a plan: https:\/\/shootsync\.test\/settings/)
    assert.match(email.text, /Download everything under Settings, Your records/)
    assert.match(email.text, /HMRC/)
    assert.match(email.html, /<a href="https:\/\/shootsync\.test\/settings">/)
    assert.equal(warningEmail({ syndicateName: 'Beatrice', deletionDate, stage: 1, archived: false, siteUrl: SITE }).subject, 'Beatrice: final notice, records will be deleted on Thursday 28 January 2027')
  })

  it('names dates, never a count of days, so it is right whenever it arrives and a resend is the same email', () => {
    for (const stage of [30, 7, 1]) {
      const email = warningEmail({ syndicateName: 'Beatrice', deletionDate, stage, archived: false, siteUrl: SITE })
      assert.doesNotMatch(email.subject + email.text, /\bin \d+ days?\b|tomorrow/)
      assert.deepEqual(email, warningEmail({ syndicateName: 'Beatrice', deletionDate, stage, archived: false, siteUrl: SITE }))
    }
  })

  it('the day is the UK day, through midnight and the clock changes', () => {
    assert.deepEqual(deletionDays(new Date('2027-01-28T10:00:00Z')), { on: 'Thursday 28 January 2027', dayBefore: 'Wednesday 27 January 2027' })
    // 23:30 UTC in summer is 00:30 the next day in the UK.
    assert.deepEqual(deletionDays(new Date('2027-06-30T23:30:00Z')), { on: 'Thursday 1 July 2027', dayBefore: 'Wednesday 30 June 2027' })
    // The clocks went forward on Sunday 28 March 2027: 00:30 on Monday is 23:30 UTC on Sunday.
    assert.deepEqual(deletionDays(new Date('2027-03-28T23:30:00Z')), { on: 'Monday 29 March 2027', dayBefore: 'Sunday 28 March 2027' })
    // And back on Sunday 31 October 2027.
    assert.deepEqual(deletionDays(new Date('2027-11-01T00:30:00Z')), { on: 'Monday 1 November 2027', dayBefore: 'Sunday 31 October 2027' })
  })

  it('an archived syndicate is gone from the app, so the way to a copy is to reply', () => {
    const email = warningEmail({ syndicateName: 'Beatrice', deletionDate, stage: 7, archived: true, siteUrl: SITE })
    assert.match(email.text, /You archived Beatrice/)
    assert.match(email.text, /If you meant to leave, there is nothing to do/)
    assert.match(email.text, /reply to this email as soon as you can, and before Wednesday 27 January 2027/)
    // It can't be reopened or downloaded, so nothing is offered that the app can't do.
    assert.doesNotMatch(email.text, /choose a plan|Download everything|send you (one|a copy)/)
  })

  it('a syndicate name can never inject HTML', () => {
    const email = warningEmail({ syndicateName: '<script>x</script> & "Co"', deletionDate, stage: 7, archived: false, siteUrl: SITE })
    assert.doesNotMatch(email.html, /<script>/)
    assert.match(email.html, /&lt;script&gt;x&lt;\/script&gt; &amp; &quot;Co&quot;/)
  })

  it('a name saved with a line break or a hidden character still makes a one-line subject', () => {
    const name = `Beatrice${ch(10)}Bcc: x${ch(0x2028, 0x202e)}Farm${ch(0x200b)}`
    const email = warningEmail({ syndicateName: name, deletionDate, stage: 7, archived: false, siteUrl: SITE })
    assert.equal(email.subject, 'Beatrice Bcc: x Farm: records will be deleted on Thursday 28 January 2027')
    assert.equal(HIDDEN_CHARACTERS.test(email.subject + email.text.replace(/\n/g, ' ')), false)
    // Flags and joined emoji are not hidden characters, and stay as they are.
    const wales = ch(0x1f3f4, 0xe0067, 0xe0062, 0xe0077, 0xe006c, 0xe0073, 0xe007f)
    const family = ch(0x1f468, 0x200d, 0x1f466)
    assert.equal(oneLine(`Dragon ${wales} ${family}`), `Dragon ${wales} ${family}`)
  })
})

describe('sending through Resend', () => {
  const message: OutgoingEmail = { to: 'captain@example.com', subject: 'S', text: 'T', html: '<p>T</p>', idempotencyKey: 'deletion-warning/s1/2027-01-28T10:00:00.000Z/30' }

  it('posts exactly what Resend expects: the key, the idempotency key, from ShootSync, replies to hello@', async () => {
    const seen: Array<{ url: string; init: RequestInit }> = []
    const result = await resendMailer(FAKE_RESEND_KEY, fakeFetch(200, { id: 'email_123' }, seen)).send(message)
    assert.deepEqual(result, { id: 'email_123' })
    assert.equal(seen.length, 1)
    assert.equal(seen[0].url, 'https://api.resend.com/emails')
    assert.equal(seen[0].init.method, 'POST')
    const headers = seen[0].init.headers as Record<string, string>
    assert.equal(headers.Authorization, `Bearer ${FAKE_RESEND_KEY}`)
    assert.equal(headers['Idempotency-Key'], message.idempotencyKey)
    assert.equal(headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(String(seen[0].init.body)), { from: MAIL_FROM, to: ['captain@example.com'], reply_to: MAIL_REPLY_TO, subject: 'S', text: 'T', html: '<p>T</p>' })
    assert.equal(MAIL_FROM, 'ShootSync <notices@shootsync.co.uk>')
    assert.ok(seen[0].init.signal, 'a timeout, so a hung connection can never hold the job')
  })

  it('a refusal says the status and Resend’s error code, never Resend’s wording (it can quote an address)', async () => {
    const quoting = { name: 'validation_error', message: 'You can only send testing emails to your own email address (owner@example.com).' }
    await assert.rejects(resendMailer('re_x', fakeFetch(403, quoting)).send(message), (err: unknown) => {
      assert.ok(err instanceof MailError)
      assert.equal(err.message, 'Resend refused the email (HTTP 403, validation_error)')
      assert.deepEqual([err.status, err.code], [403, 'validation_error'])
      return true
    })
    await assert.rejects(resendMailer('re_x', fakeFetch(500, 'gateway down')).send(message), (err: unknown) => err instanceof MailError && err.message === 'Resend refused the email (HTTP 500)' && err.code === null)
    await assert.rejects(resendMailer('re_x', fakeFetch(422, { name: 'Not A Code <x@y>' })).send(message), (err: unknown) => err instanceof MailError && err.message === 'Resend refused the email (HTTP 422)')
    await assert.rejects(resendMailer('re_x', fakeFetch(200, { nothing: true })).send(message), MailError)
    await assert.rejects(resendMailer('re_x', fakeFetch(409, { id: 'email_stale', name: 'invalid_idempotent_request' })).send(message), (err: unknown) => err instanceof MailError && err.status === 409, 'an error status is an error even if the body carries an id')
    const down = (async () => { throw new TypeError('fetch failed') }) as typeof fetch
    await assert.rejects(resendMailer('re_x', down).send(message), (err: unknown) => err instanceof MailError && err.status === null && /could not be reached/.test(err.message))
  })

  it('recognises a Resend key, and not a paste gone wrong', () => {
    assert.equal(isResendKey(FAKE_RESEND_KEY), true)
    for (const bad of ['', 're_', 're_short', ['sk', 'live', 'x'.repeat(24)].join('_') /* a Stripe-shaped value, built here so no key-shaped text is in the file */, ` ${FAKE_RESEND_KEY}`, FAKE_RESEND_KEY.replace('_D', ' D')]) assert.equal(isResendKey(bad), false, bad)
  })

  it('the captain’s address comes from Clerk; a deleted account has none', async () => {
    const lookup = clerkCaptainEmail(async (id) => {
      if (id === 'user_gone') throw Object.assign(new Error('Not Found'), { status: 404 })
      if (id === 'user_blank') return { primaryEmailAddress: null }
      if (id === 'user_down') throw Object.assign(new Error('Service Unavailable'), { status: 503 })
      return { primaryEmailAddress: { emailAddress: 'captain@example.com' } }
    })
    assert.equal(await lookup('user_ok'), 'captain@example.com')
    assert.equal(await lookup('user_gone'), null)
    assert.equal(await lookup('user_blank'), null)
    await assert.rejects(lookup('user_down'), /Service Unavailable/)
  })

  it('a lookup that hangs gives up, so the run can carry on', async () => {
    const hung = clerkCaptainEmail(() => new Promise(() => {}), 50)
    await assert.rejects(hung('user_x'), (err: unknown) => (err as Error).name === 'TimeoutError')
  })

  it('the key names the warning and the exact email: the same email the same key, a changed one a new key', () => {
    const email = { to: 'captain@example.com', subject: 'S', text: 'T', html: '<p>T</p>' }
    const date = new Date('2027-01-28T10:00:00Z')
    const k = idempotencyKey('syn1', date, 7, email)
    assert.match(k, /^deletion-warning\/syn1\/2027-01-28T10:00:00\.000Z\/7\/[0-9a-f]{16}$/)
    assert.equal(idempotencyKey('syn1', date, 7, { ...email }), k)
    for (const changed of [{ to: 'new@example.com' }, { subject: 'S2' }, { text: 'T2' }, { html: '<p>T2</p>' }]) assert.notEqual(idempotencyKey('syn1', date, 7, { ...email, ...changed }), k)
    assert.ok(k.length <= 256, 'within Resend’s limit')
  })
})

describe('the hourly run', () => {
  let prisma: PrismaClient
  let data: Awaited<ReturnType<typeof seed>>
  /** Every email handed to the mailer, accepted or not. */
  let attempts: OutgoingEmail[]
  /** The emails accepted. */
  let sent: OutgoingEmail[]
  let alerts: Array<{ kind: string; message: string; details: Record<string, unknown> }>
  let reports: Array<{ context: string; details: Record<string, unknown> }>
  let mailer: Mailer
  let addresses: Record<string, string | null>
  let lookups: number
  let beforeLookup: (() => Promise<void>) | null
  const captainEmail: CaptainEmail = async (id) => {
    lookups++
    if (beforeLookup) await beforeLookup()
    if (!(id in addresses)) throw new Error('lookup failed')
    return addresses[id]
  }
  // Syndicate A's plan ended on this date: everything is deleted 90 days later.
  const ENDED = new Date('2026-10-30T16:14:41Z')
  const DELETION = new Date(ENDED.getTime() + 90 * DAY)
  const at = (daysBeforeDeletion: number) => new Date(DELETION.getTime() - daysBeforeDeletion * DAY)
  const later = (date: Date, ms: number) => new Date(date.getTime() + ms)
  const accepting: Mailer = { send: async (email) => { attempts.push(email); sent.push(email); return { id: `email_${sent.length}` } } }
  const run = (now: Date, overrides: Partial<{ mailer: Mailer; captainEmail: CaptainEmail }> = {}) =>
    runDeletionWarnings(prisma, { mailer: overrides.mailer ?? mailer, captainEmail: overrides.captainEmail ?? captainEmail, alerts: consoleAlerts(alerts as never, reports as never), siteUrl: SITE, now })
  const rows = () => prisma.deletionWarning.findMany({ where: { syndicateId: data.a.syndicate.id }, orderBy: { daysBefore: 'desc' }, select: { daysBefore: true, outcome: true, deletionDueAt: true, sentAt: true } })
  const logged = () => prisma.activityLog.count({ where: { syndicateId: data.a.syndicate.id, action: 'Deletion warning emailed' } })
  /** Which warning an email was, read from its key. */
  const stageOf = (email: OutgoingEmail) => {
    const [kind, syndicate, date, stage] = email.idempotencyKey.split('/')
    assert.deepEqual([kind, syndicate, date], ['deletion-warning', data.a.syndicate.id, DELETION.toISOString()])
    return Number(stage)
  }

  before(() => {
    prisma = createTestPrisma()
  })

  after(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await resetDatabase(prisma)
    data = await seed(prisma)
    // A: the plan has ended. B stays on its live plan throughout.
    await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionStatus: 'CANCELLED', planEndedAt: ENDED } })
    attempts = []
    sent = []
    alerts = []
    reports = []
    mailer = accepting
    addresses = { [CAPTAIN_A]: 'captaina@example.com' }
    lookups = 0
    beforeLookup = null
  })

  it('works from the same deletion date the retention job deletes on', async () => {
    const a = await prisma.syndicate.findUniqueOrThrow({ where: { id: data.a.syndicate.id } })
    assert.equal(syndicateDeletionDate(a)?.toISOString(), DELETION.toISOString())
  })

  it('nothing with 31 days left; the 30-day warning at 30, once however often the job runs', async () => {
    assert.deepEqual(await run(at(31)), { sent: 0, noEmail: 0, failed: 0 })
    assert.equal(sent.length, 0)

    assert.deepEqual(await run(at(30)), { sent: 1, noEmail: 0, failed: 0 })
    assert.equal(sent.length, 1)
    assert.equal(sent[0].to, 'captaina@example.com')
    assert.equal(sent[0].subject, 'A Syndicate: records will be deleted on Thursday 28 January 2027')
    const { idempotencyKey: sentKey, ...body } = sent[0]
    assert.equal(sentKey, idempotencyKey(data.a.syndicate.id, DELETION, 30, body))

    for (const hours of [1, 2, 24]) await run(later(at(30), hours * HOUR))
    assert.equal(sent.length, 1, 'never twice')
    assert.equal(lookups, 1, 'the sign-in service is not asked again every hour once the warning has gone')
    const [row] = await rows()
    assert.deepEqual([row.daysBefore, row.outcome, row.sentAt?.toISOString()], [30, 'sent', at(30).toISOString()])
    assert.equal(await logged(), 1)
  })

  it('then the 7-day and the final warnings, each once', async () => {
    for (const now of [at(30), at(8), at(7), at(6), at(1), later(at(1), HOUR)]) await run(now)
    assert.deepEqual(sent.map(stageOf), [30, 7, 1])
    assert.match(sent[2].subject, /final notice/)
    assert.deepEqual((await rows()).map((r) => [r.daysBefore, r.outcome]), [[30, 'sent'], [7, 'sent'], [1, 'sent']])
  })

  it('a job that was down sends only the most urgent warning, not a pile of them', async () => {
    await run(at(5))
    assert.deepEqual(sent.map(stageOf), [7])
    await run(at(3))
    assert.equal(sent.length, 1, 'the 30-day warning is not sent late')
    assert.equal(lookups, 1, 'nor is the address looked up for it')
    await run(later(at(1), 30 * 60 * 1000))
    assert.deepEqual(sent.map(stageOf), [7, 1])
  })

  it('never to a syndicate on a live plan, nor once the deletion date has passed', async () => {
    for (const status of ['ACTIVE', 'TRIALING', 'PAST_DUE'] as const) {
      await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionStatus: status } })
      await run(at(7))
    }
    await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionStatus: 'CANCELLED' } })
    await run(later(DELETION, HOUR))
    assert.equal(sent.length, 0)
  })

  it('a plan started while the run is under way wins: nothing is sent or recorded', async () => {
    beforeLookup = async () => {
      await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionStatus: 'ACTIVE', planEndedAt: null } })
    }
    assert.deepEqual(await run(at(30)), { sent: 0, noEmail: 0, failed: 0 })
    assert.equal(sent.length, 0)
    assert.equal((await rows()).length, 0)
  })

  it('a plan whose status turns live mid-run wins, even before its end date is cleared', async () => {
    beforeLookup = async () => {
      await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionStatus: 'ACTIVE' } })
    }
    await run(at(30))
    assert.equal(sent.length, 0)
    assert.equal((await rows()).length, 0)
  })

  it('a deletion date that moves mid-run is not warned about at the old date', async () => {
    beforeLookup = async () => {
      await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { planEndedAt: later(ENDED, 10 * DAY) } })
    }
    await run(at(30))
    assert.equal(sent.length, 0)
    assert.equal((await rows()).length, 0)
  })

  it('waits for a Stripe update that is part-way through, and then sees the plan has started', async () => {
    let release!: () => void
    const held = new Promise<void>((resolve) => { release = resolve })
    let locked!: () => void
    const isLocked = new Promise<void>((resolve) => { locked = resolve })
    const webhook = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "syndicates" WHERE "id" = ${data.a.syndicate.id} FOR UPDATE`
      await tx.syndicate.update({ where: { id: data.a.syndicate.id }, data: { stripeSubscriptionStatus: 'ACTIVE' } })
      locked()
      await held
    }, { timeout: 10_000 })
    await isLocked
    const running = run(at(30))
    await new Promise((r) => setTimeout(r, 300))
    release()
    await webhook
    assert.deepEqual(await running, { sent: 0, noEmail: 0, failed: 0 })
    assert.equal(sent.length, 0)
  })

  it('two servers taking over the same stopped claim send it once', async () => {
    await prisma.deletionWarning.create({ data: { syndicateId: data.a.syndicate.id, deletionDueAt: DELETION, daysBefore: 30, outcome: 'pending', claimedAt: at(30) } })
    let calls = 0
    const slow: Mailer = { send: async (email) => { calls++; await new Promise((r) => setTimeout(r, 300)); sent.push(email); return { id: 'email_slow' } } }
    const now = later(at(30), CLAIM_LEASE_MS + 1000)
    const [first, second] = await Promise.all([run(now, { mailer: slow }), run(now, { mailer: slow })])
    assert.equal(calls, 1)
    assert.equal(first.sent + second.sent, 1)
    assert.equal(await logged(), 1)
  })

  it('a claim taken from under a slow send is not marked sent, nor logged, by the slow one', async () => {
    const overtaken: Mailer = {
      send: async (email) => {
        sent.push(email)
        // Meanwhile a more urgent warning replaced this claim.
        await prisma.deletionWarning.updateMany({ where: { syndicateId: data.a.syndicate.id }, data: { outcome: 'superseded' } })
        return { id: 'email_slow' }
      },
    }
    await run(at(30), { mailer: overtaken })
    assert.deepEqual((await rows()).map((r) => r.outcome), ['superseded'])
    assert.equal(await logged(), 0)
  })

  it('a syndicate that never chose a plan is warned 30 days before its 90 days from set-up are up', async () => {
    const created = new Date('2026-09-01T09:00:00Z')
    const never = await prisma.syndicate.create({ data: { name: 'Never Paid', captainClerkId: CAPTAIN_A, seasonStart: new Date('2026-10-01'), seasonEnd: new Date('2027-02-01'), createdAt: created } })
    await run(later(created, 60 * DAY))
    assert.deepEqual(sent.map((e) => e.subject), ['Never Paid: records will be deleted on Monday 30 November 2026'])
    assert.equal(await prisma.deletionWarning.count({ where: { syndicateId: never.id } }), 1)
  })

  it('a refused send is alerted without Resend’s wording, and goes next hour as exactly the same email', async () => {
    mailer = { send: (email) => { attempts.push(email); return resendMailer('re_x', fakeFetch(403, { name: 'validation_error', message: 'Only to your own address (owner@example.com).' })).send(email) } }
    assert.deepEqual(await run(at(30)), { sent: 0, noEmail: 0, failed: 1 })
    assert.deepEqual((await rows()).map((r) => [r.daysBefore, r.outcome, r.sentAt]), [[30, 'pending', null]])
    assert.equal(await logged(), 0)
    assert.equal(alerts.length, 1)
    assert.equal(alerts[0].kind, 'email')
    assert.deepEqual(alerts[0].details, { syndicate: data.a.syndicate.id, daysBefore: 30, deletionDate: DELETION.toISOString().slice(0, 10), error: 'Resend refused the email (HTTP 403, validation_error)' })
    assert.equal(JSON.stringify(alerts).includes('@'), false, 'no address in an alert')

    mailer = accepting
    await run(later(at(30), 10 * 60 * 1000))
    assert.equal(sent.length, 0, 'not while the first try still holds its claim')
    await run(later(at(29), HOUR))
    assert.equal(sent.length, 1)
    assert.deepEqual(sent[0], attempts[0], 'the same key and the same email, a day later')
    assert.deepEqual((await rows()).map((r) => [r.daysBefore, r.outcome]), [[30, 'sent']])
    assert.equal(await logged(), 1)
  })

  it('a send that went but was never confirmed (a timeout, a server stopped) is sent again with the same key and email, and logged once', async () => {
    // Resend accepted it, but the answer never came back.
    mailer = { send: async (email) => { attempts.push(email); throw new MailError('Resend could not be reached: TimeoutError', null) } }
    await run(at(7))
    mailer = accepting
    await run(later(at(7), CLAIM_LEASE_MS + 1000))
    assert.equal(attempts.length, 2)
    assert.deepEqual(attempts[1], attempts[0], 'Resend sees the same key and the same email, so sends it once')
    assert.equal(stageOf(attempts[1]), 7)
    assert.deepEqual((await rows()).map((r) => r.outcome), ['sent'])
    assert.equal(await logged(), 1)
  })

  it('an email that changed between tries (the captain archived, or changed address) goes under a new key, never refused every hour', async () => {
    mailer = { send: async (email) => { attempts.push(email); throw new MailError('Resend could not be reached: TimeoutError', null) } }
    await run(at(7))
    await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { status: 'ARCHIVED' } })
    addresses[CAPTAIN_A] = 'captaina.new@example.com'
    mailer = accepting
    await run(later(at(7), HOUR))
    assert.equal(attempts.length, 2)
    assert.notEqual(attempts[1].idempotencyKey, attempts[0].idempotencyKey)
    assert.deepEqual([attempts[1].to, /You archived/.test(attempts[1].text)], ['captaina.new@example.com', true])
    assert.deepEqual((await rows()).map((r) => r.outcome), ['sent'])
  })

  it('claims and sends are stamped with the time they happen, not when the run began', async () => {
    let t = at(30).getTime()
    const ticking = () => new Date((t += 20 * 60 * 1000))
    await runDeletionWarnings(prisma, { mailer, captainEmail, alerts: consoleAlerts(alerts as never, reports as never), siteUrl: SITE, now: at(30), clock: ticking })
    const row = await prisma.deletionWarning.findFirstOrThrow({ where: { syndicateId: data.a.syndicate.id } })
    assert.ok(row.claimedAt.getTime() > at(30).getTime() + CLAIM_LEASE_MS, 'a long run’s claim is not born already past its lease')
    assert.ok(row.sentAt!.getTime() > row.claimedAt.getTime())
  })

  it('a claim another server is still sending is left alone; one from a server that stopped is taken over', async () => {
    const stuck = await prisma.deletionWarning.create({ data: { syndicateId: data.a.syndicate.id, deletionDueAt: DELETION, daysBefore: 30, outcome: 'pending', claimedAt: at(30) } })
    await run(later(at(30), CLAIM_LEASE_MS - 1000))
    assert.equal(sent.length, 0)
    await run(later(at(30), CLAIM_LEASE_MS))
    assert.equal(sent.length, 1)
    const row = await prisma.deletionWarning.findUniqueOrThrow({ where: { id: stuck.id } })
    assert.deepEqual([row.outcome, row.claimedAt.toISOString()], ['sent', later(at(30), CLAIM_LEASE_MS).toISOString()])
  })

  it('a warning never confirmed is marked superseded when a more urgent one replaces it', async () => {
    mailer = { send: async () => { throw new MailError('Resend refused the email (HTTP 422, validation_error)', 422, 'validation_error') } }
    await run(at(30))
    mailer = accepting
    await run(at(7))
    assert.deepEqual(sent.map(stageOf), [7])
    assert.deepEqual((await rows()).map((r) => [r.daysBefore, r.outcome]), [[30, 'superseded'], [7, 'sent']])
  })

  it('a captain whose account has no address: recorded, alerted, not tried every hour', async () => {
    addresses = { [CAPTAIN_A]: null }
    assert.deepEqual(await run(at(30)), { sent: 0, noEmail: 1, failed: 0 })
    await run(later(at(30), HOUR))
    assert.deepEqual((await rows()).map((r) => [r.daysBefore, r.outcome]), [[30, 'no_email']])
    assert.equal(alerts.length, 1)
    assert.match(alerts[0].message, /no email address/)
  })

  it('a lookup that fails is tried again next hour, and the owner is told', async () => {
    addresses = {}
    assert.deepEqual(await run(at(30)), { sent: 0, noEmail: 0, failed: 1 })
    assert.equal((await rows()).length, 0)
    assert.match(alerts[0].message, /could not be looked up/)
    assert.equal(alerts[0].details.error, 'Error')
    addresses = { [CAPTAIN_A]: 'captaina@example.com' }
    await run(later(at(30), HOUR))
    assert.equal(sent.length, 1)
  })

  it('a plan started and ended again gives a fresh deletion date, and fresh warnings', async () => {
    await run(at(30))
    const endedAgain = later(ENDED, 20 * DAY)
    await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { planEndedAt: endedAgain } })
    const newDeletion = later(endedAgain, 90 * DAY)
    await run(new Date(newDeletion.getTime() - 30 * DAY))
    assert.equal(sent.length, 2)
    assert.deepEqual((await rows()).map((r) => r.deletionDueAt.toISOString()).sort(), [DELETION.toISOString(), newDeletion.toISOString()].sort())
  })

  it('an archived syndicate gets the archived wording', async () => {
    await prisma.syndicate.update({ where: { id: data.a.syndicate.id }, data: { status: 'ARCHIVED' } })
    await run(at(7))
    assert.match(sent[0].text, /You archived A Syndicate/)
  })

  it('each warning is in the activity log, without the address', async () => {
    await run(at(30))
    const entry = await prisma.activityLog.findFirstOrThrow({ where: { syndicateId: data.a.syndicate.id, action: 'Deletion warning emailed' } })
    assert.deepEqual([entry.actorRole, entry.actorUserId, entry.targetType, entry.targetId], ['system', 'system', 'syndicate', data.a.syndicate.id])
    assert.deepEqual(entry.details, { daysBefore: 30, deletionDate: DELETION.toISOString().slice(0, 10) })
    assert.equal(JSON.stringify(entry).includes('@'), false)
  })

  it('two servers running at the same moment send it once', async () => {
    let calls = 0
    const slow: Mailer = { send: async (email) => { calls++; await new Promise((r) => setTimeout(r, 300)); sent.push(email); return { id: 'email_slow' } } }
    const [first, second] = await Promise.all([run(at(30), { mailer: slow }), run(at(30), { mailer: slow })])
    assert.equal(calls, 1, 'the second server never got as far as sending')
    assert.equal(first.sent + second.sent, 1)
    assert.equal(first.failed + second.failed, 0)
    assert.deepEqual((await rows()).map((r) => r.outcome), ['sent'])
  })

  it('a database failure for one syndicate is reported and never stops the others', async () => {
    const other = await prisma.syndicate.create({ data: { name: 'Other', captainClerkId: 'user_other', seasonStart: new Date('2026-10-01'), seasonEnd: new Date('2027-02-01'), stripeSubscriptionStatus: 'CANCELLED', planEndedAt: ENDED } })
    addresses.user_other = 'other@example.com'
    // A's claim can't be written; Other's can.
    await prisma.$executeRawUnsafe(`ALTER TABLE "deletion_warnings" ADD CONSTRAINT "t_refuse_a" CHECK ("syndicate_id" <> '${data.a.syndicate.id}') NOT VALID`)
    try {
      assert.deepEqual(await run(at(30)), { sent: 1, noEmail: 0, failed: 1 })
      assert.deepEqual(sent.map((e) => e.to), ['other@example.com'])
      assert.equal(reports.length, 1)
      assert.equal(reports[0].context, 'deletion warning')
      assert.equal(reports[0].details.syndicate, data.a.syndicate.id)
      assert.equal(await prisma.deletionWarning.count({ where: { syndicateId: other.id, outcome: 'sent' } }), 1)
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE "deletion_warnings" DROP CONSTRAINT IF EXISTS "t_refuse_a"')
    }
  })

  it('the warnings go with the syndicate when it is deleted', async () => {
    await run(at(30))
    await prisma.$transaction(async (tx) => deleteSyndicate(tx, data.a.syndicate.id))
    assert.equal(await prisma.deletionWarning.count({ where: { syndicateId: data.a.syndicate.id } }), 0)
  })
})
