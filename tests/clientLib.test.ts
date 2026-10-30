/**
 * The browser's own logic, tested without a browser: how the API client reports problems,
 * which syndicate the app shows, the next shoot day, a new syndicate's suggested season,
 * and the server's plain-English validation messages.
 */

import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { OFFLINE_MESSAGE, PLAN_CHANGED_EVENT, SESSION_ENDED_EVENT, apiPath, apiRequest, errorMessageFrom } from '../src/lib/api.js'
import { chooseSyndicate, parseMemberships, planNotice, type Membership } from '../src/lib/membership.js'
import { nextShootFrom } from '../src/lib/shootDays.js'
import { SESSION_CLOCK, formatCountdown, sessionClock, shouldPing, signedOutReason } from '../src/lib/sessionClock.js'
import { newSyndicateForm, newSyndicatePayload, suggestedSeason, validateSettings } from '../src/utils/syndicateSettings.js'
import { emptyShootDraft, newShootPayload, validateShoot } from '../src/utils/shootForm.js'
import { fieldLabel, friendlyMessage } from '../server/validation.js'

describe('API client', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  const respond = (status: number, body: string | null) => {
    globalThis.fetch = (async () => new Response(body, { status, headers: { 'Content-Type': 'application/json' } })) as typeof fetch
  }

  it('shows the server’s own words when it gave some', () => {
    assert.equal(errorMessageFrom(400, { error: 'Season end must be after season start' }), 'Season end must be after season start')
    assert.equal(errorMessageFrom(400, { details: [{ message: 'Location is required.' }] }), 'Location is required.')
  })

  it('otherwise says what went wrong in words, never a bare status code', () => {
    assert.match(errorMessageFrom(401, null), /Sign in again/)
    assert.match(errorMessageFrom(404, null), /could not be found/)
    assert.match(errorMessageFrom(429, 'not json'), /Too many requests/)
    assert.match(errorMessageFrom(502, null), /problem/)
    assert.equal(errorMessageFrom(418, {}), 'Something went wrong (418). Try again.')
  })

  it('returns the data on success, and the message on failure', async () => {
    respond(200, JSON.stringify({ a: 1 }))
    assert.deepEqual(await apiRequest('/api/x'), { ok: true, data: { a: 1 }, status: 200 })
    respond(409, JSON.stringify({ error: 'Already paid' }))
    assert.deepEqual(await apiRequest('/api/x', { method: 'POST', body: {} }), { ok: false, error: 'Already paid', status: 409 })
  })

  it('survives a reply that is not JSON, and an empty one', async () => {
    respond(500, '<html>Bad gateway</html>')
    const failed = await apiRequest('/api/x')
    assert.equal(failed.ok, false)
    respond(204, null)
    assert.deepEqual(await apiRequest('/api/x', { method: 'DELETE' }), { ok: true, data: null, status: 204 })
  })

  it('a lapsed-plan refusal (402) tells the app to look at the plan again; other failures do not', async () => {
    const target = new EventTarget()
    const heard: string[] = []
    target.addEventListener(PLAN_CHANGED_EVENT, (e) => heard.push(e.type))
    const g = globalThis as { window?: unknown }
    g.window = target
    try {
      respond(409, JSON.stringify({ error: 'Already paid' }))
      await apiRequest('/api/x', { method: 'POST', body: {} })
      assert.deepEqual(heard, [])
      respond(402, JSON.stringify({ error: 'This syndicate is read-only until its plan is active.' }))
      const res = await apiRequest('/api/x', { method: 'POST', body: {} })
      assert.equal(res.ok, false)
      assert.deepEqual(heard, [PLAN_CHANGED_EVENT])
    } finally {
      delete g.window
    }
  })

  it('a session the server has ended tells the app to sign out, with the reason; other 401s do not', async () => {
    const target = new EventTarget()
    const heard: unknown[] = []
    target.addEventListener(SESSION_ENDED_EVENT, (e) => heard.push((e as CustomEvent).detail))
    const g = globalThis as { window?: unknown }
    g.window = target
    try {
      respond(401, JSON.stringify({ error: 'Sign in required' }))
      await apiRequest('/api/x')
      assert.deepEqual(heard, [])
      respond(401, JSON.stringify({ error: 'x', code: 'session_ended', reason: 'absolute' }))
      const res = await apiRequest('/api/x')
      assert.equal(res.ok, false)
      respond(401, JSON.stringify({ error: 'x', code: 'session_ended', reason: 'idle' }))
      await apiRequest('/api/x')
      assert.deepEqual(heard, [{ reason: 'absolute' }, { reason: 'idle' }])
    } finally {
      delete g.window
    }
  })

  it('no signal is reported as no signal, and says nothing was saved', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    assert.deepEqual(await apiRequest('/api/x'), { ok: false, error: OFFLINE_MESSAGE, status: 0 })
    assert.match(OFFLINE_MESSAGE, /nothing was saved/)
  })

  it('sends JSON only when there is a body', async () => {
    const seen: RequestInit[] = []
    globalThis.fetch = (async (_: unknown, init?: RequestInit) => {
      seen.push(init ?? {})
      return new Response('{}', { status: 200 })
    }) as typeof fetch
    await apiRequest('/api/x')
    await apiRequest('/api/x', { method: 'PATCH', body: { name: 'A' } })
    assert.equal(seen[0].body, undefined)
    assert.equal(seen[0].headers, undefined)
    assert.equal(seen[1].body, '{"name":"A"}')
    assert.deepEqual(seen[1].headers, { 'Content-Type': 'application/json' })
  })

  it('builds query strings safely, leaving out empty values', () => {
    assert.equal(apiPath('/api/shoots', { syndicateId: 'a&b=c', status: undefined, upcoming: '' }), '/api/shoots?syndicateId=a%26b%3Dc')
    assert.equal(apiPath('/api/me'), '/api/me')
  })
})

describe('which syndicate is on show', () => {
  const m = (id: string, role: Membership['role']): Membership => ({
    id, name: id, role, memberId: null, seasonStart: '2026-10-01', seasonEnd: '2027-02-01',
    defaultBeaterRate: 40, pegRotationRule: 'FAIR_ROTATION',
    subscription: { status: null, planTier: null, isActive: false, reason: 'lapsed', currentPeriodEnd: null, readOnlyFrom: null },
  })

  it('the one chosen last time, if the user still belongs to it', () => {
    assert.equal(chooseSyndicate([m('a', 'CAPTAIN'), m('b', 'GUN')], 'b')?.id, 'b')
  })

  it('otherwise the first one they captain, then the first they shoot in, then none', () => {
    assert.equal(chooseSyndicate([m('g', 'GUN'), m('c', 'CAPTAIN')], 'gone')?.id, 'c')
    assert.equal(chooseSyndicate([m('g', 'GUN')], null)?.id, 'g')
    assert.equal(chooseSyndicate([], 'a'), null)
  })

  it('refuses an answer it cannot trust, rather than guessing a role', () => {
    assert.deepEqual(parseMemberships({ syndicates: [m('a', 'CAPTAIN')] }), [m('a', 'CAPTAIN')])
    assert.equal(parseMemberships({ syndicates: [{ ...m('a', 'CAPTAIN'), role: 'OWNER' }] }), null)
    assert.equal(parseMemberships({ syndicates: [{ id: 'a' }] }), null)
    assert.equal(parseMemberships({}), null)
    assert.equal(parseMemberships(null), null)
  })
})

describe('what the captain is told about the plan', () => {
  const s = (status: string | null, extra: Partial<Membership['subscription']> = {}): Membership => {
    const isActive = ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(status ?? '') && !extra.reason
    return {
      id: 'a', name: 'Beatrice', role: 'CAPTAIN', memberId: null, seasonStart: '', seasonEnd: '',
      defaultBeaterRate: 40, pegRotationRule: 'FAIR_ROTATION',
      subscription: { status, planTier: null, isActive, reason: isActive ? null : 'lapsed', currentPeriodEnd: null, readOnlyFrom: null, ...extra },
    }
  }

  it('nothing while the plan is in good standing', () => {
    assert.equal(planNotice(s('ACTIVE')), null)
    assert.equal(planNotice(s('TRIALING')), null)
  })

  it('a failed payment Stripe is still retrying is a warning, not read-only', () => {
    const notice = planNotice(s('PAST_DUE'))
    assert.equal(notice?.tone, 'warning')
    assert.equal(notice?.action, 'Update payment')
    assert.match(notice?.text ?? '', /Beatrice didn’t go through\. Everything still works for now while Stripe/)
    const dated = planNotice(s('PAST_DUE', { readOnlyFrom: '2026-12-01T12:00:00.000Z' }))
    assert.match(dated?.text ?? '', /Everything still works until 1 December 2026 while Stripe/)
  })

  it('a failed payment two weeks past the paid-up date is read-only, with the way back', () => {
    const notice = planNotice(s('PAST_DUE', { reason: 'overdue' }))
    assert.equal(notice?.tone, 'read-only')
    assert.equal(notice?.action, 'Update payment')
    assert.match(notice?.text ?? '', /more than two weeks overdue, so it’s read-only/)
  })

  it('a disputed payment is read-only whatever Stripe says the status is', () => {
    const notice = planNotice(s('ACTIVE', { reason: 'dispute' }))
    assert.equal(notice?.tone, 'read-only')
    assert.match(notice?.text ?? '', /disputed with the card issuer/)
  })

  it('every other state is read-only, names the syndicate and gives the one thing to do', () => {
    const expected: Array<[string | null, string, RegExp]> = [
      [null, 'Choose a plan', /^Choose a plan to start using Beatrice\./],
      ['UNPAID', 'Update payment', /Stripe has stopped trying/],
      ['INCOMPLETE', 'Update payment', /first payment for Beatrice/],
      ['CANCELLED', 'Choose a plan', /still here to view and export/],
    ]
    for (const [status, action, text] of expected) {
      const notice = planNotice(s(status))
      assert.equal(notice?.tone, 'read-only', String(status))
      assert.equal(notice?.action, action, String(status))
      assert.match(notice?.text ?? '', text, String(status))
    }
  })

  it('read-only exactly when the server refuses changes', () => {
    for (const status of [null, 'ACTIVE', 'TRIALING', 'PAST_DUE', 'UNPAID', 'INCOMPLETE', 'CANCELLED']) {
      const syndicate = s(status)
      assert.equal(planNotice(syndicate)?.tone === 'read-only', !syndicate.subscription.isActive, String(status))
    }
  })
})

describe('the next shoot day', () => {
  const day = (date: string, status = 'SCHEDULED') => ({ date: `${date}T00:00:00.000Z`, status })

  it('today’s shoot is still the next one until the day is over', () => {
    assert.equal(nextShootFrom([day('2026-11-14'), day('2026-11-21')], '2026-11-14')?.date.slice(0, 10), '2026-11-14')
  })

  it('skips days that have been, and days that are done or cancelled, whatever the list order', () => {
    const shoots = [day('2026-12-05'), day('2026-11-07'), day('2026-11-21', 'CANCELLED'), day('2026-11-28', 'COMPLETED'), day('2026-11-30')]
    assert.equal(nextShootFrom(shoots, '2026-11-15')?.date.slice(0, 10), '2026-11-30')
    assert.equal(nextShootFrom([day('2026-11-07')], '2026-11-15'), null)
  })
})

describe('a new syndicate', () => {
  it('suggests the pheasant season under way, or the next one once the last has closed', () => {
    assert.deepEqual(suggestedSeason('2026-10-29'), { seasonStart: '2026-10-01', seasonEnd: '2027-02-01' })
    assert.deepEqual(suggestedSeason('2027-01-15'), { seasonStart: '2026-10-01', seasonEnd: '2027-02-01' })
    assert.deepEqual(suggestedSeason('2027-02-01'), { seasonStart: '2026-10-01', seasonEnd: '2027-02-01' })
    assert.deepEqual(suggestedSeason('2027-02-02'), { seasonStart: '2027-10-01', seasonEnd: '2028-02-01' })
    assert.deepEqual(suggestedSeason('2027-07-01'), { seasonStart: '2027-10-01', seasonEnd: '2028-02-01' })
  })

  it('needs only a name; sends whole pounds and the usual defaults', () => {
    const form = newSyndicateForm('2026-10-29')
    assert.deepEqual(Object.keys(validateSettings(form)), ['name'])
    assert.deepEqual(newSyndicatePayload({ ...form, name: '  Beatrice  ' }), {
      name: 'Beatrice', seasonStart: '2026-10-01', seasonEnd: '2027-02-01',
      subscriptionAmount: 0, subscriptionType: 'ANNUAL', defaultBeaterRate: 40, pegRotationRule: 'FAIR_ROTATION',
    })
  })
})

describe('a new shoot day', () => {
  it('starts with the usual meet time and drives, and needs a date and a place', () => {
    assert.deepEqual(Object.keys(validateShoot(emptyShootDraft())).sort(), ['date', 'locationName'])
  })

  it('leaves blank optional fields out (the create route does not take nulls)', () => {
    const payload = newShootPayload('syn1', { ...emptyShootDraft(), date: '2026-12-05', locationName: ' Wood ', locationPostcode: 'ox15 4hb' })
    assert.deepEqual(payload, { syndicateId: 'syn1', date: '2026-12-05', locationName: 'Wood', locationPostcode: 'OX15 4HB', meetTime: '08:30', drivesPlanned: 4 })
  })
})

describe('validation messages', () => {
  it('labels fields the way the screens do', () => {
    assert.equal(fieldLabel(['locationPostcode']), 'Postcode')
    assert.equal(fieldLabel(['allocations', 0, 'pegNumber']), 'Peg number')
    assert.equal(fieldLabel(['someNewField']), 'Some new field')
    assert.equal(fieldLabel([]), 'This')
  })

  it('turns each kind of problem into a sentence', () => {
    const at = { path: ['name'] }
    assert.equal(friendlyMessage({ ...at, code: 'invalid_type', input: undefined }), 'Name is required.')
    assert.equal(friendlyMessage({ ...at, code: 'too_small', origin: 'string', minimum: 1 }), 'Name is required.')
    assert.equal(friendlyMessage({ ...at, code: 'too_big', origin: 'string', maximum: 100 }), 'Name must be 100 characters or fewer.')
    assert.equal(friendlyMessage({ path: ['dayRate'], code: 'too_big', origin: 'number', maximum: 1000, inclusive: true }), 'Day rate must be 1000 or less.')
    assert.equal(friendlyMessage({ path: ['email'], code: 'invalid_format', format: 'email' }), 'Email must be a valid email address.')
    assert.equal(friendlyMessage({ path: ['memberIds'], code: 'too_small', origin: 'array', minimum: 1 }), 'Guns: choose at least one.')
    assert.equal(friendlyMessage({ path: ['status'], code: 'invalid_value' }), 'Status is not one of the allowed choices.')
  })
})

describe('the session clock (12 hours from sign-in, 10 minutes idle)', () => {
  const min = 60_000
  const signedIn = 1_000_000

  it('counts down to whichever limit comes first', () => {
    const fresh = sessionClock(signedIn, signedIn, signedIn)
    assert.deepEqual([fresh.reason, fresh.msLeft, fresh.warn, fresh.ended], ['idle', 10 * min, false, false])
    // Busy all day: 3 minutes before the 12 hours are up, the absolute limit is the nearer one.
    const busy = sessionClock(signedIn + 717 * min, signedIn, signedIn + 717 * min)
    assert.deepEqual([busy.reason, busy.msLeft], ['absolute', 3 * min])
  })

  it('warns in the last minute, and ends at the limit', () => {
    assert.equal(sessionClock(signedIn + 9 * min - 1, signedIn, signedIn).warn, false)
    const warned = sessionClock(signedIn + 9 * min, signedIn, signedIn)
    assert.deepEqual([warned.warn, warned.ended, warned.msLeft], [true, false, min])
    const ended = sessionClock(signedIn + 11 * min, signedIn, signedIn)
    assert.deepEqual([ended.ended, ended.msLeft, ended.reason], [true, 0, 'idle'])
    const absolute = sessionClock(signedIn + 720 * min, signedIn, signedIn + 720 * min)
    assert.deepEqual([absolute.ended, absolute.reason], [true, 'absolute'])
  })

  it('tells the server a busy user is still there at most every couple of minutes', () => {
    assert.equal(shouldPing(signedIn + SESSION_CLOCK.pingEveryMs - 1, signedIn), false)
    assert.equal(shouldPing(signedIn + SESSION_CLOCK.pingEveryMs, signedIn), true)
  })

  it('shows the time left as m:ss, and reads only known reasons from the sign-in link', () => {
    assert.equal(formatCountdown(60_000), '1:00')
    assert.equal(formatCountdown(44_001), '0:45')
    assert.equal(formatCountdown(0), '0:00')
    assert.equal(signedOutReason('idle'), 'idle')
    assert.equal(signedOutReason('absolute'), 'absolute')
    assert.equal(signedOutReason('<script>'), null)
    assert.equal(signedOutReason(null), null)
  })
})
