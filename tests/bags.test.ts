/**
 * The game book: reading the bag from speech, one record per drive, nothing recorded on a
 * cancelled day, and season totals that are this season's and nothing else.
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { parseBagSpeech, wordsToNumber } from '../src/utils/bagSpeech.js'
import { CAPTAIN_A, GUN_A, call, createTestPrisma, createTestStripe, resetDatabase, seed, startTestServer, type TestServer } from './helpers.js'

describe('reading the bag from speech', () => {
  const counts = (text: string) => parseBagSpeech(text)
  it('reads digits and words, with or without plurals', () => {
    assert.deepEqual(counts('34 pheasants 12 partridge 5 duck'), { counts: { pheasant: 34, partridge: 12, duck: 5 }, unclear: false })
    assert.deepEqual(counts('thirty four pheasants, twelve partridges and five ducks').counts, { pheasant: 34, partridge: 12, duck: 5 })
    assert.deepEqual(counts('Two woodcock and one other').counts, { woodcock: 2, other: 1 })
    assert.deepEqual(counts('a pheasant and no duck').counts, { pheasant: 1, duck: 0 })
  })

  it('understands hundreds and old-style numbers', () => {
    assert.deepEqual(counts('a hundred and twelve pheasant and nine duck').counts, { pheasant: 112, duck: 9 })
    assert.equal(wordsToNumber(['one', 'hundred', 'and', 'five']), 105)
    assert.equal(wordsToNumber(['one', 'hundred', 'twenty']), 120)
    assert.equal(wordsToNumber(['five', 'and', 'twenty']), 25)
    assert.equal(wordsToNumber(['twenty', 'one']), 21)
  })

  it('a drive number said first is the drive, not added to the birds', () => {
    assert.deepEqual(counts('drive two thirty four pheasants'), { counts: { pheasant: 34 }, drive: 2, unclear: false })
    assert.deepEqual(counts('Drive 3, 34 pheasants'), { counts: { pheasant: 34 }, drive: 3, unclear: false })
  })

  it('never fills in a number it cannot be sure of', () => {
    for (const text of [
      'pheasant 34 partridge 12', // species before number
      'pheasant 34 partridge', // species before number, nothing left over
      '34 12 partridge', // two numbers run together
      'twenty twenty pheasant',
      'one thousand two hundred pheasants',
      '5 pheasant 3 pheasant', // same bird twice
      '12 duck 7', // a number left over
      'drive twenty one thirty pheasants',
    ]) {
      assert.deepEqual(counts(text).counts, {}, text)
      assert.equal(counts(text).unclear, true, text)
    }
    assert.deepEqual(counts('lots of pheasants'), { counts: {}, unclear: false })
  })
})

describe('game book API', () => {
  let prisma: PrismaClient
  let server: TestServer
  let data: Awaited<ReturnType<typeof seed>>

  before(async () => {
    prisma = createTestPrisma()
    const { stripe } = createTestStripe()
    server = await startTestServer(prisma, stripe)
  })

  after(async () => {
    await server.close()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await resetDatabase(prisma)
    data = await seed(prisma)
  })

  const as = (method: string, path: string, body?: unknown, who = CAPTAIN_A) => call(server, path, { method, as: who, body })
  // The exact shape the page sends: every species, and blank text fields as null.
  const record = (driveNumber: number, extra: Record<string, unknown> = {}, shootId = data.a.shoot.id) =>
    as('POST', '/api/bags', { shootId, driveNumber, pheasant: 10, partridge: 0, duck: 0, woodcock: 0, other: 0, otherDescription: null, notes: null, ...extra })

  it('each drive number is recorded once per day, even when two people save at the same moment', async () => {
    // Seed: drive 1 is already recorded on A's shoot.
    assert.equal((await record(1)).status, 409)
    // The race is on the first save of a drive: fire it from many places at once, on fresh days.
    for (let round = 0; round < 6; round++) {
      const day = await prisma.shootDay.create({ data: { syndicateId: data.a.syndicate.id, date: new Date('2026-12-12'), locationName: `Race ${round}` } })
      const results = await Promise.all(Array.from({ length: 12 }, () => record(1, {}, day.id)))
      assert.equal(results.filter((r) => r.status === 201).length, 1, `round ${round}`)
      assert.equal(await prisma.bagRecord.count({ where: { shootId: day.id } }), 1, `round ${round}`)
    }
  })

  it('a drive can be corrected, but not renumbered onto a drive already recorded', async () => {
    const second = await record(2)
    assert.equal((await as('PATCH', `/api/bags/${second.json.id}`, { driveNumber: 1 })).status, 409)
    const fixed = await as('PATCH', `/api/bags/${second.json.id}`, { driveNumber: 3, pheasant: 14, notes: null })
    assert.equal(fixed.status, 200)
    assert.deepEqual([fixed.json.driveNumber, fixed.json.pheasant, fixed.json.notes], [3, 14, null])
  })

  it('nothing can be recorded or changed on a cancelled day', async () => {
    await prisma.shootDay.update({ where: { id: data.a.shoot.id }, data: { status: 'CANCELLED' } })
    assert.equal((await record(5)).status, 400)
    assert.equal((await as('PATCH', `/api/bags/${data.a.bag.id}`, { pheasant: 99 })).status, 400)
  })

  it('records made before the one-per-drive rule can still be corrected without renumbering', async () => {
    const twin = await prisma.bagRecord.create({ data: { shootId: data.a.shoot.id, driveNumber: 1, pheasant: 5 } })
    assert.equal((await as('PATCH', `/api/bags/${twin.id}`, { driveNumber: 1, pheasant: 6 })).status, 200)
  })

  it('a gun cannot correct a drive someone else recorded', async () => {
    const captains = await record(7)
    assert.equal((await as('PATCH', `/api/bags/${captains.json.id}`, { pheasant: 1 }, GUN_A)).status, 404)
  })

  it('the last day of the season counts in full, and days outside the season are flagged, not lost', async () => {
    const a = data.a // season ends 1 Feb 2027
    const lastDay = await prisma.shootDay.create({ data: { syndicateId: a.syndicate.id, date: new Date('2027-02-01T14:00:00Z'), locationName: 'Last day' } })
    await prisma.bagRecord.create({ data: { shootId: lastDay.id, driveNumber: 1, pheasant: 7 } })
    const nextSeason = await prisma.shootDay.create({ data: { syndicateId: a.syndicate.id, date: new Date('2027-10-09'), locationName: 'Next season' } })
    await prisma.bagRecord.create({ data: { shootId: nextSeason.id, driveNumber: 1, pheasant: 40 } })
    const res = await as('GET', `/api/bags/season?syndicateId=${a.syndicate.id}`)
    assert.deepEqual([res.json.pheasant, res.json.outsideSeason], [19, 1])
  })

  it("the dashboard's owed figure is just a number: no names or bank details", async () => {
    const res = await as('GET', `/api/beaters/payments/owed?syndicateId=${data.a.syndicate.id}`)
    assert.deepEqual(res.json, { totalOutstanding: 4000 })
  })

  it('the season game book counts this season only, leaves out cancelled days, and lists each day', async () => {
    const a = data.a // season 1 Oct 2026 to 1 Feb 2027; seed shoot 14 Nov has 12 pheasant
    const lastSeason = await prisma.shootDay.create({ data: { syndicateId: a.syndicate.id, date: new Date('2026-01-10'), locationName: 'Last year', status: 'COMPLETED' } })
    await prisma.bagRecord.create({ data: { shootId: lastSeason.id, driveNumber: 1, pheasant: 500 } })
    const cancelled = await prisma.shootDay.create({ data: { syndicateId: a.syndicate.id, date: new Date('2026-11-28'), locationName: 'Called off', status: 'CANCELLED' } })
    await prisma.bagRecord.create({ data: { shootId: cancelled.id, driveNumber: 1, pheasant: 300 } })
    const later = await prisma.shootDay.create({ data: { syndicateId: a.syndicate.id, date: new Date('2026-12-05'), locationName: 'Top Wood', status: 'COMPLETED' } })
    await prisma.bagRecord.create({ data: { shootId: later.id, driveNumber: 1, pheasant: 20, duck: 3 } })

    const res = await as('GET', `/api/bags/season?syndicateId=${a.syndicate.id}`)
    assert.equal(res.status, 200)
    assert.deepEqual([res.json.pheasant, res.json.duck, res.json.total, res.json.shootsCompleted], [32, 3, 35, 1])
    assert.deepEqual(res.json.days.map((d: { locationName: string; total: number }) => [d.locationName, d.total]), [['A Farm', 12], ['Top Wood', 23]])
  })

  it('a gun can still read the season and record a drive, but not delete one', async () => {
    assert.equal((await as('GET', `/api/bags/season?syndicateId=${data.a.syndicate.id}`, undefined, GUN_A)).status, 200)
    const gunRecorded = await as('POST', '/api/bags', { shootId: data.a.shoot.id, driveNumber: 6, pheasant: 2 }, GUN_A)
    assert.equal(gunRecorded.status, 201)
    assert.equal((await as('DELETE', `/api/bags/${gunRecorded.json.id}`, undefined, GUN_A)).status, 404)
  })
})
