/**
 * Peg draw: the algorithm (no database) and the API against the real test database.
 *
 * The algorithm is checked against brute force on small cases: the fair draw must
 * find an allocation with the fewest possible repeats, every time.
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { fairDraw, hungarian, randomDraw, repeatCost, type PegAllocation, type PegHistoryEntry, type Rng } from '../server/pegDraw.js'
import { CAPTAIN_A, call, createTestPrisma, createTestStripe, resetDatabase, seed, startTestServer, type TestServer } from './helpers.js'

/** Repeatable random numbers (mulberry32), so a failing case can be replayed. */
function seeded(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function* permutations(items: number[], size: number, prefix: number[] = []): Generator<number[]> {
  if (prefix.length === size) {
    yield prefix
    return
  }
  for (const item of items) if (!prefix.includes(item)) yield* permutations(items, size, [...prefix, item])
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `gun${i + 1}`)

function assertValid(allocations: PegAllocation[], memberIds: string[], numberOfPegs: number) {
  assert.deepEqual(allocations.map((a) => a.memberId).sort(), [...memberIds].sort(), 'every gun gets exactly one peg')
  const pegs = allocations.map((a) => a.pegNumber)
  assert.equal(new Set(pegs).size, pegs.length, 'no two guns share a peg')
  for (const peg of pegs) assert.ok(Number.isInteger(peg) && peg >= 1 && peg <= numberOfPegs, `peg ${peg} out of range`)
}

describe('peg draw algorithm', () => {
  it('the assignment solver finds the true minimum (checked by brute force)', () => {
    const rng = seeded(1)
    for (let trial = 0; trial < 200; trial++) {
      const rows = 1 + Math.floor(rng() * 5)
      const cols = rows + Math.floor(rng() * 3)
      const cost = Array.from({ length: rows }, () => Array.from({ length: cols }, () => Math.floor(rng() * 20)))
      const assignment = hungarian(cost)
      assert.equal(new Set(assignment).size, rows)
      const got = assignment.reduce((sum, col, row) => sum + cost[row][col], 0)
      let best = Infinity
      for (const perm of permutations([...Array(cols).keys()], rows)) {
        best = Math.min(best, perm.reduce((sum, col, row) => sum + cost[row][col], 0))
      }
      assert.equal(got, best, `trial ${trial}`)
    }
  })

  it('the fair draw always has the fewest repeats possible (checked by brute force)', () => {
    const rng = seeded(2)
    for (let trial = 0; trial < 150; trial++) {
      const guns = 2 + Math.floor(rng() * 4)
      const pegCount = guns + Math.floor(rng() * 2)
      const memberIds = ids(guns)
      const history: PegHistoryEntry[] = Array.from({ length: Math.floor(rng() * 15) }, () => ({
        memberId: memberIds[Math.floor(rng() * guns)],
        pegNumber: 1 + Math.floor(rng() * pegCount),
      }))
      const drawn = fairDraw(memberIds, pegCount, history, seeded(trial))
      assertValid(drawn, memberIds, pegCount)
      let best = Infinity
      for (const perm of permutations([...Array(pegCount).keys()].map((i) => i + 1), guns)) {
        best = Math.min(best, repeatCost(memberIds.map((memberId, i) => ({ memberId, pegNumber: perm[i] })), history))
      }
      assert.equal(repeatCost(drawn, history), best, `trial ${trial}`)
    }
  })

  it('over a season with as many shoots as pegs, every gun stands on every peg exactly once', () => {
    for (const size of [4, 8, 10]) {
      const memberIds = ids(size)
      const history: PegHistoryEntry[] = []
      for (let shoot = 0; shoot < size; shoot++) {
        const drawn = fairDraw(memberIds, size, history, seeded(100 + shoot))
        assertValid(drawn, memberIds, size)
        history.push(...drawn)
      }
      for (const memberId of memberIds) {
        const pegs = history.filter((h) => h.memberId === memberId).map((h) => h.pegNumber).sort((a, b) => a - b)
        assert.deepEqual(pegs, [...Array(size).keys()].map((i) => i + 1), `${memberId} with ${size} guns`)
      }
    }
  })

  it('a gun is kept off a peg they keep getting when another peg is free', () => {
    const history = [1, 1, 1].map((pegNumber) => ({ memberId: 'gun1', pegNumber }))
    for (let s = 0; s < 50; s++) {
      const drawn = fairDraw(['gun1', 'gun2'], 2, history, seeded(s))
      assert.equal(drawn.find((a) => a.memberId === 'gun1')?.pegNumber, 2)
    }
  })

  it('with no history the fair draw is a genuine draw, not the same order every time', () => {
    const firstGunPegs = new Set<number>()
    for (let s = 0; s < 40; s++) firstGunPegs.add(fairDraw(ids(6), 6, [], seeded(s)).find((a) => a.memberId === 'gun1')!.pegNumber)
    assert.ok(firstGunPegs.size >= 4, `gun1 only ever drew ${[...firstGunPegs]}`)
  })

  it('a random draw can use every peg, not just the first few', () => {
    const used = new Set<number>()
    for (let s = 0; s < 60; s++) {
      const drawn = randomDraw(ids(3), 8, seeded(s))
      assertValid(drawn, ids(3), 8)
      drawn.forEach((a) => used.add(a.pegNumber))
    }
    assert.equal(used.size, 8)
  })

  it('refuses more guns than pegs, or the same gun twice, instead of doubling up a peg', () => {
    assert.throws(() => fairDraw(ids(5), 4, []), RangeError)
    assert.throws(() => randomDraw(ids(5), 4), RangeError)
    assert.throws(() => fairDraw(['gun1', 'gun1'], 4, []), RangeError)
  })
})

describe('peg draw API', () => {
  let prisma: PrismaClient
  let server: TestServer
  let data: Awaited<ReturnType<typeof seed>>
  let laterShootId: string

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
    // Seed: A's gun stood on peg 3 at the 14 November shoot. Draw for a shoot a week later.
    const later = await prisma.shootDay.create({ data: { syndicateId: data.a.syndicate.id, date: new Date('2026-11-21'), locationName: 'A Wood' } })
    laterShootId = later.id
  })

  const draw = (body: unknown, shootId = laterShootId) => call(server, `/api/shoots/${shootId}/pegs/draw`, { method: 'POST', as: CAPTAIN_A, body })
  const save = (body: unknown, shootId = laterShootId) => call(server, `/api/shoots/${shootId}/pegs`, { method: 'PUT', as: CAPTAIN_A, body })
  const attendances = () => prisma.shootAttendance.findMany({ orderBy: { id: 'asc' } })

  it("shows each gun's pegs from earlier shoots this season only", async () => {
    const a = data.a
    // Cancelled, before the season, and after this day: none of these count.
    const cancelled = await prisma.shootDay.create({ data: { syndicateId: a.syndicate.id, date: new Date('2026-11-07'), locationName: 'X', status: 'CANCELLED' } })
    const lastSeason = await prisma.shootDay.create({ data: { syndicateId: a.syndicate.id, date: new Date('2026-01-10'), locationName: 'X' } })
    const afterwards = await prisma.shootDay.create({ data: { syndicateId: a.syndicate.id, date: new Date('2026-12-05'), locationName: 'X' } })
    for (const shoot of [cancelled, lastSeason, afterwards]) {
      await prisma.shootAttendance.create({ data: { shootId: shoot.id, memberId: a.gun.id, pegNumber: 7 } })
    }

    const res = await call(server, `/api/shoots/${laterShootId}/pegs`, { as: CAPTAIN_A })
    assert.equal(res.status, 200)
    const gun = res.json.guns.find((g: { id: string }) => g.id === a.gun.id)
    assert.deepEqual(gun.history.map((h: { pegNumber: number }) => h.pegNumber), [3])
    assert.deepEqual(res.json.guns.map((g: { name: string }) => g.name), ['A Captain', 'A Gun'], 'active guns only, not the beater-role member')
  })

  it('the fair draw keeps a gun off the peg they had last time', async () => {
    for (let i = 0; i < 8; i++) {
      const res = await draw({ method: 'fair', numberOfPegs: 3, memberIds: [data.a.gun.id, data.a.captainMember.id] })
      assert.equal(res.status, 200, JSON.stringify(res.json))
      assert.notEqual(res.json.allocations.find((x: PegAllocation) => x.memberId === data.a.gun.id).pegNumber, 3)
    }
  })

  it('drawing saves nothing', async () => {
    const before = JSON.stringify(await attendances())
    await draw({ method: 'random', numberOfPegs: 4, memberIds: [data.a.gun.id] })
    assert.equal(JSON.stringify(await attendances()), before)
  })

  it('refuses more guns than pegs, and anyone who is not an active gun here', async () => {
    assert.equal((await draw({ method: 'fair', numberOfPegs: 1, memberIds: [data.a.gun.id, data.a.captainMember.id] })).status, 400)
    assert.equal((await draw({ method: 'fair', numberOfPegs: 4, memberIds: [data.b.gun.id] })).status, 400, "another syndicate's gun")
    const beaterRole = await prisma.member.findFirstOrThrow({ where: { syndicateId: data.a.syndicate.id, role: 'BEATER' } })
    assert.equal((await draw({ method: 'fair', numberOfPegs: 4, memberIds: [beaterRole.id] })).status, 400, 'a beater-role member')
    await prisma.member.update({ where: { id: data.a.gun.id }, data: { status: 'INACTIVE' } })
    assert.equal((await draw({ method: 'fair', numberOfPegs: 4, memberIds: [data.a.gun.id] })).status, 400, 'an inactive member')
  })

  it('saves the whole list at once, and a gun left off loses their peg for that day', async () => {
    const { gun, captainMember } = data.a
    assert.equal((await save({ allocations: [{ memberId: gun.id, pegNumber: 1 }, { memberId: captainMember.id, pegNumber: 2 }] })).status, 200)
    const res = await save({ allocations: [{ memberId: captainMember.id, pegNumber: 5 }] })
    assert.equal(res.status, 200)
    assert.deepEqual(res.json.saved, [{ memberId: captainMember.id, pegNumber: 5 }])
    const gunRow = await prisma.shootAttendance.findUniqueOrThrow({ where: { shootId_memberId: { shootId: laterShootId, memberId: gun.id } } })
    assert.equal(gunRow.pegNumber, null)
  })

  it('a list with a problem saves nothing at all', async () => {
    const { gun, captainMember } = data.a
    await save({ allocations: [{ memberId: gun.id, pegNumber: 1 }] })
    const before = JSON.stringify(await attendances())
    const samePeg = await save({ allocations: [{ memberId: gun.id, pegNumber: 2 }, { memberId: captainMember.id, pegNumber: 2 }] })
    assert.equal(samePeg.status, 400)
    const outsider = await save({ allocations: [{ memberId: captainMember.id, pegNumber: 4 }, { memberId: data.b.gun.id, pegNumber: 1 }] })
    assert.equal(outsider.status, 400)
    assert.equal(JSON.stringify(await attendances()), before)
  })

  it('counts a shoot on the first day of the season, and an earlier shoot on the same date', async () => {
    const a = data.a
    const opening = await prisma.shootDay.create({ data: { syndicateId: a.syndicate.id, date: new Date('2026-10-01'), locationName: 'Opening day' } })
    await prisma.shootAttendance.create({ data: { shootId: opening.id, memberId: a.gun.id, pegNumber: 6 } })
    // A morning and an afternoon day on 21 November: the afternoon was added second.
    const afternoon = await prisma.shootDay.create({ data: { syndicateId: a.syndicate.id, date: new Date('2026-11-21'), locationName: 'Afternoon' } })
    await prisma.shootAttendance.create({ data: { shootId: laterShootId, memberId: a.gun.id, pegNumber: 1 } })

    const morning = await call(server, `/api/shoots/${laterShootId}/pegs`, { as: CAPTAIN_A })
    const pm = await call(server, `/api/shoots/${afternoon.id}/pegs`, { as: CAPTAIN_A })
    const pegsOf = (res: { json: { guns: { id: string; history: { pegNumber: number }[] }[] } }) =>
      res.json.guns.find((g) => g.id === a.gun.id)!.history.map((h) => h.pegNumber)
    assert.deepEqual(pegsOf(morning), [6, 3], 'the morning sees the opening day and 14 November')
    assert.deepEqual(pegsOf(pm), [6, 3, 1], 'the afternoon also sees the morning')
  })

  it('an empty list clears the day, and a gun who has left can be dropped and the rest saved', async () => {
    const { gun, captainMember } = data.a
    await save({ allocations: [{ memberId: gun.id, pegNumber: 1 }, { memberId: captainMember.id, pegNumber: 2 }] })
    await prisma.member.update({ where: { id: gun.id }, data: { status: 'INACTIVE' } })
    assert.equal((await save({ allocations: [{ memberId: gun.id, pegNumber: 1 }, { memberId: captainMember.id, pegNumber: 2 }] })).status, 400)
    const res = await save({ allocations: [{ memberId: captainMember.id, pegNumber: 2 }] })
    assert.deepEqual(res.json.saved, [{ memberId: captainMember.id, pegNumber: 2 }])
    assert.deepEqual((await save({ allocations: [] })).json.saved, [])
  })

  it('two saves at the same moment never leave two guns on one peg', async () => {
    const { gun, captainMember } = data.a
    for (let i = 0; i < 15; i++) {
      await Promise.all([
        save({ allocations: [{ memberId: gun.id, pegNumber: 1 }] }),
        save({ allocations: [{ memberId: captainMember.id, pegNumber: 1 }] }),
      ])
      const onPegOne = await prisma.shootAttendance.count({ where: { shootId: laterShootId, pegNumber: 1 } })
      assert.equal(onPegOne, 1, `round ${i}`)
    }
  })

  it('pegs can only be written through the checked save: the old one-at-a-time route is gone', async () => {
    const res = await call(server, `/api/shoots/${laterShootId}/attendance`, {
      method: 'POST', as: CAPTAIN_A, body: { memberId: data.a.gun.id, pegNumber: 1 },
    })
    assert.equal(res.status, 404)
  })

  it('a cancelled shoot day cannot be drawn or saved', async () => {
    await prisma.shootDay.update({ where: { id: laterShootId }, data: { status: 'CANCELLED' } })
    assert.equal((await draw({ method: 'fair', numberOfPegs: 4, memberIds: [data.a.gun.id] })).status, 400)
    assert.equal((await save({ allocations: [{ memberId: data.a.gun.id, pegNumber: 1 }] })).status, 400)
  })
})
