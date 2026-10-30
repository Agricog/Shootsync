/**
 * Bank details at rest (batch 9d): sealed with AES-256-GCM, bound to their beater, rotatable,
 * and sealed at boot if any older row still holds them readable.
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { CAPTAIN_A, call, createTestPrisma, createTestStripe, resetDatabase, seed, startTestServer, testConfig, testVerifier, type TestServer } from './helpers.js'
import { BankDetailsUnreadable, keyId, last4, openBankNumbers, parseBankKey, sealBankNumbers, sealedKeyId } from '../server/bankCrypto.js'
import { sealOutstandingBankDetails, wrongKey } from '../server/bankBackfill.js'
import { createApp } from '../server/app.js'
import { consoleAlerts } from '../server/alerts.js'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

const KEY = Buffer.alloc(32, 1)
const OTHER = Buffer.alloc(32, 2)
const numbers = { sortCode: '12-34-56', accountNumber: '01234567' }

describe('sealing', () => {
  it('opens for the same beater with the same key, and holds nothing readable', () => {
    const sealed = sealBankNumbers(numbers, 'beater-1', KEY)
    assert.match(sealed, /^v1\.[0-9a-f]{8}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    assert.equal(sealed.includes('01234567'), false)
    assert.equal(sealed.includes('123456'), false)
    assert.deepEqual(openBankNumbers(sealed, 'beater-1', { current: KEY, previous: null }), numbers)
    // A fresh IV each time: the same numbers never seal to the same text.
    assert.notEqual(sealBankNumbers(numbers, 'beater-1', KEY), sealed)
  })

  it('will not open for another beater, with another key, or once altered', () => {
    const sealed = sealBankNumbers(numbers, 'beater-1', KEY)
    assert.throws(() => openBankNumbers(sealed, 'beater-2', { current: KEY, previous: null }), BankDetailsUnreadable)
    assert.throws(() => openBankNumbers(sealed, 'beater-1', { current: OTHER, previous: null }), /a key this server does not have/)
    const parts = sealed.split('.')
    const flipped = parts[4][0] === 'A' ? 'B' + parts[4].slice(1) : 'A' + parts[4].slice(1)
    assert.throws(() => openBankNumbers([...parts.slice(0, 4), flipped].join('.'), 'beater-1', { current: KEY, previous: null }), BankDetailsUnreadable)
    assert.throws(() => openBankNumbers('12-34-56', 'beater-1', { current: KEY, previous: null }), /unknown format/)
  })

  it('a rotated key still opens what the previous one sealed', () => {
    const sealed = sealBankNumbers(numbers, 'beater-1', KEY)
    assert.equal(sealedKeyId(sealed), keyId(KEY))
    assert.deepEqual(openBankNumbers(sealed, 'beater-1', { current: OTHER, previous: KEY }), numbers)
  })

  it('keys are read as 64 hex characters or 44 base64 characters, and nothing else', () => {
    assert.deepEqual(parseBankKey('01'.repeat(32)), Buffer.alloc(32, 1))
    assert.deepEqual(parseBankKey(Buffer.alloc(32, 9).toString('base64')), Buffer.alloc(32, 9))
    assert.equal(parseBankKey(''), null)
    assert.equal(parseBankKey(undefined), null)
    assert.throws(() => parseBankKey('short'), /32 bytes/)
    // Base64 with stray characters is refused, not quietly trimmed.
    assert.throws(() => parseBankKey(Buffer.alloc(32, 9).toString('base64').replace('C', '!')), /32 bytes/)
    assert.throws(() => parseBankKey('A'.repeat(64) + '==='), /32 bytes/)
    assert.equal(last4('0123 4567'), '4567')
  })
})

describe('bank details in use', () => {
  let prisma: PrismaClient
  let server: TestServer
  let data: Awaited<ReturnType<typeof seed>>

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
    data = await seed(prisma)
  })

  it('rows from before 0006 are sealed at boot and their readable numbers emptied; running again changes nothing', async () => {
    const legacy = await prisma.beater.create({ data: { syndicateId: data.a.syndicate.id, name: 'Old', bankSortCode: '20-00-00', bankAccountNumber: '55667788' } })
    const half = await prisma.beater.create({ data: { syndicateId: data.a.syndicate.id, name: 'Half', bankSortCode: '20-00-00' } })
    const first = await sealOutstandingBankDetails(prisma, testConfig.bankKeys!)
    assert.deepEqual(first, { sealed: 1, resealed: 0, halfCleared: 1, unreadable: [], sealedTotal: 3 })
    const row = await prisma.beater.findUniqueOrThrow({ where: { id: legacy.id } })
    assert.deepEqual([row.bankSortCode, row.bankAccountNumber, row.bankAccountLast4], [null, null, '7788'])
    assert.deepEqual(openBankNumbers(row.bankDetailsSealed!, legacy.id, testConfig.bankKeys!), { sortCode: '20-00-00', accountNumber: '55667788' })
    // Half a pair could never be paid to: cleared, not sealed.
    const halfRow = await prisma.beater.findUniqueOrThrow({ where: { id: half.id } })
    assert.deepEqual([halfRow.bankSortCode, halfRow.bankDetailsSealed], [null, null])
    assert.deepEqual(await sealOutstandingBankDetails(prisma, testConfig.bankKeys!), { sealed: 0, resealed: 0, halfCleared: 0, unreadable: [], sealedTotal: 3 })
    assert.equal((await prisma.beater.findUniqueOrThrow({ where: { id: legacy.id } })).bankDetailsSealed, row.bankDetailsSealed)
  })

  it('after a key rotation everything is moved to the new key; anything no key opens is reported, not lost', async () => {
    const rotated = { current: OTHER, previous: testConfig.bankKeys!.current }
    const lost = await prisma.beater.create({ data: { syndicateId: data.a.syndicate.id, name: 'Lost', bankDetailsSealed: sealBankNumbers(numbers, 'x', KEY) } })
    const result = await sealOutstandingBankDetails(prisma, rotated)
    assert.deepEqual(result, { sealed: 0, resealed: 2, halfCleared: 0, unreadable: [lost.id], sealedTotal: 3 })
    const moved = await prisma.beater.findUniqueOrThrow({ where: { id: data.a.beater.id } })
    assert.equal(sealedKeyId(moved.bankDetailsSealed!), keyId(OTHER))
    assert.deepEqual(openBankNumbers(moved.bankDetailsSealed!, moved.id, { current: OTHER, previous: null }), { sortCode: '12-34-56', accountNumber: '12345678' })
    // The unreadable one is left exactly as it was, for the right key to open later.
    assert.equal((await prisma.beater.findUniqueOrThrow({ where: { id: lost.id } })).bankDetailsSealed?.startsWith(`v1.${keyId(KEY)}.`), true)
  })

  it('a wrong key is told apart from one damaged row', () => {
    assert.equal(wrongKey({ sealedTotal: 3, unreadable: ['a', 'b', 'c'] }), true)
    assert.equal(wrongKey({ sealedTotal: 3, unreadable: ['a'] }), false)
    assert.equal(wrongKey({ sealedTotal: 0, unreadable: [] }), false)
  })

  it('one beater’s details that won’t open never stop everyone else being exported for paying', async () => {
    const other = await prisma.beater.create({ data: { syndicateId: data.a.syndicate.id, name: 'Damaged', bankDetailsSealed: sealBankNumbers(numbers, 'someone-else', testConfig.bankKeys!.current) } })
    await prisma.beaterPayment.create({ data: { syndicateId: data.a.syndicate.id, beaterId: other.id, shootId: data.a.shoot.id, amount: 4000 } })
    const res = await call(server, '/api/beaters/payments/bank-export', { method: 'POST', as: CAPTAIN_A, body: { syndicateId: data.a.syndicate.id } })
    assert.equal(res.status, 200)
    const byName = Object.fromEntries(res.json.rows.map((r: { name: string }) => [r.name, r]))
    assert.deepEqual([byName['A Beater'].accountNumber, byName['A Beater'].unreadable], ['12345678', false])
    assert.deepEqual([byName.Damaged.accountNumber, byName.Damaged.unreadable], [null, true])
  })

  it('numbers written readable by older code during a deploy are sealed, and win over what was sealed before', async () => {
    await prisma.beater.update({ where: { id: data.a.beater.id }, data: { bankSortCode: '40-11-22', bankAccountNumber: '99887766' } })
    await sealOutstandingBankDetails(prisma, testConfig.bankKeys!)
    const row = await prisma.beater.findUniqueOrThrow({ where: { id: data.a.beater.id } })
    assert.deepEqual([row.bankSortCode, row.bankAccountNumber, row.bankAccountLast4], [null, null, '7766'])
    assert.deepEqual(openBankNumbers(row.bankDetailsSealed!, row.id, testConfig.bankKeys!), { sortCode: '40-11-22', accountNumber: '99887766' })
  })

  it('a value moved onto another beater’s row will not open', async () => {
    const other = await prisma.beater.create({ data: { syndicateId: data.a.syndicate.id, name: 'Other' } })
    const stolen = (await prisma.beater.findUniqueOrThrow({ where: { id: data.a.beater.id } })).bankDetailsSealed
    await prisma.beater.update({ where: { id: other.id }, data: { bankDetailsSealed: stolen } })
    const res = await call(server, `/api/beaters/${other.id}/bank-details/reveal`, { method: 'POST', as: CAPTAIN_A })
    assert.equal(res.status, 409)
    assert.match(res.json.error, /can’t be opened\. Ask the beater for them again/)
    assert.equal(JSON.stringify(res.json).includes('12345678'), false)
    assert.deepEqual(server.alerts.at(-1)?.details, { beater: other.id })
  })

  it('without a key, bank details are refused, never saved readable; everything else still saves', async () => {
    const app = createApp({ prisma, stripe: createTestStripe().stripe, config: { ...testConfig, bankKeys: null }, verifyToken: testVerifier, alerts: consoleAlerts(), today: () => '2026-11-14' })
    const keyless: Server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
    const base = `http://127.0.0.1:${(keyless.address() as AddressInfo).port}`
    try {
      const before = await prisma.beater.count()
      const refused = await fetch(`${base}/api/beaters`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token.user_captainA' }, body: JSON.stringify({ syndicateId: data.a.syndicate.id, name: 'New', bankSortCode: '123456', bankAccountNumber: '12345678' }) })
      assert.equal(refused.status, 503)
      assert.match(((await refused.json()) as { error: string }).error, /no key to protect them/)
      assert.equal(await prisma.beater.count(), before)
      const plain = await fetch(`${base}/api/beaters`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token.user_captainA' }, body: JSON.stringify({ syndicateId: data.a.syndicate.id, name: 'New' }) })
      assert.equal(plain.status, 201)
    } finally {
      await new Promise((resolve) => keyless.close(resolve))
    }
  })
})
