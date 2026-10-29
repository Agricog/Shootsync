/**
 * The browser's own logic, tested without a browser: how the API client reports problems,
 * which syndicate the app shows, the next shoot day, a new syndicate's suggested season,
 * and the server's plain-English validation messages.
 */

import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { OFFLINE_MESSAGE, PLAN_CHANGED_EVENT, apiPath, apiRequest, errorMessageFrom } from '../src/lib/api.js'
import { chooseSyndicate, parseMemberships, readOnlyReason, type Membership } from '../src/lib/membership.js'
import { nextShootFrom } from '../src/lib/shootDays.js'
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
    subscription: { status: null, planTier: null, isActive: false, currentPeriodEnd: null },
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

describe('why a syndicate is read-only', () => {
  const s = (status: string | null): Membership => ({
    id: 'a', name: 'Beatrice', role: 'CAPTAIN', memberId: null, seasonStart: '', seasonEnd: '',
    defaultBeaterRate: 40, pegRotationRule: 'FAIR_ROTATION',
    subscription: { status, planTier: null, isActive: false, currentPeriodEnd: null },
  })

  it('names the syndicate, the reason and the one thing to do', () => {
    assert.deepEqual(readOnlyReason(s(null)).action, 'Choose a plan')
    assert.match(readOnlyReason(s(null)).text, /^Choose a plan to start using Beatrice\./)
    assert.deepEqual(readOnlyReason(s('PAST_DUE')).action, 'Update payment')
    assert.match(readOnlyReason(s('PAST_DUE')).text, /didn’t go through/)
    assert.deepEqual(readOnlyReason(s('INCOMPLETE')).action, 'Update payment')
    assert.match(readOnlyReason(s('INCOMPLETE')).text, /first payment/)
    for (const status of ['CANCELLED']) {
      assert.match(readOnlyReason(s(status)).text, /still here to view and export/)
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
