/**
 * Beaters' pay: the rule (a completed day owes each Confirmed beater their day rate, once),
 * the money units (rates in pounds, money in pence), the HMRC day count, and the export.
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { HMRC_CASUAL_DAY_LIMIT, normaliseAccountNumber, normaliseSortCode, poundsToPence, syncBeaterPayments, taxYearOf } from '../server/beaterPay.js'
import { csvCell, toCsv } from '../src/utils/csv.js'
import { CAPTAIN_A, call, createTestPrisma, createTestStripe, resetDatabase, seed, startTestServer, type TestServer } from './helpers.js'

describe('beater pay rules', () => {
  it('the tax year runs from 6 April to 5 April', () => {
    assert.equal(taxYearOf(new Date('2026-04-05T23:59:00Z')).start.toISOString().slice(0, 10), '2025-04-06')
    assert.equal(taxYearOf(new Date('2026-04-06T00:00:00Z')).start.toISOString().slice(0, 10), '2026-04-06')
    assert.equal(taxYearOf(new Date('2027-01-30T12:00:00Z')).end.toISOString().slice(0, 10), '2027-04-06')
  })

  it('bank details are normalised, and anything else is refused', () => {
    assert.equal(normaliseSortCode('123456'), '12-34-56')
    assert.equal(normaliseSortCode(' 12 34 56 '), '12-34-56')
    assert.equal(normaliseSortCode('12-34-5'), null)
    assert.equal(normaliseAccountNumber('0123 4567'), '01234567')
    assert.equal(normaliseAccountNumber('1234567'), null)
  })

  it('day rates in pounds become pence exactly', () => {
    assert.equal(poundsToPence(40), 4000)
    assert.equal(poundsToPence(0), 0)
  })

  it('the export can never smuggle a spreadsheet formula, and quotes are escaped', () => {
    assert.equal(csvCell('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`)
    assert.equal(csvCell('+44 7700 900000'), `"'+44 7700 900000"`)
    assert.equal(csvCell('O\'Neil, "Dai"'), `"O'Neil, ""Dai"""`)
    assert.equal(toCsv([['a', 'b'], ['c', 'd']]), '"a","b"\r\n"c","d"')
  })
})

describe('beater pay API', () => {
  let prisma: PrismaClient
  let server: TestServer
  let data: Awaited<ReturnType<typeof seed>>
  let shootId: string

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
    // A fresh day with nothing on it yet.
    shootId = (await prisma.shootDay.create({ data: { syndicateId: data.a.syndicate.id, date: new Date('2026-11-28'), locationName: 'Top Wood' } })).id
  })

  const as = (method: string, path: string, body?: unknown) => call(server, path, { method, as: CAPTAIN_A, body })
  const addBeater = (name: string, dayRate: number) => prisma.beater.create({ data: { syndicateId: data.a.syndicate.id, name, dayRate } })
  const book = (ids: string[], id = shootId) => as('POST', `/api/shoots/${id}/beaters`, { beaterIds: ids })
  const bookingOf = (beaterId: string, id = shootId) => prisma.beaterBooking.findUniqueOrThrow({ where: { beaterId_shootId: { beaterId, shootId: id } } })
  const setStatus = async (beaterId: string, status: string, id = shootId) =>
    as('PATCH', `/api/shoots/${id}/beaters/${(await bookingOf(beaterId, id)).id}`, { status })
  const paymentsOn = (id = shootId) => prisma.beaterPayment.findMany({ where: { shootId: id }, orderBy: { amount: 'asc' } })
  const complete = (id = shootId) => as('POST', `/api/shoots/${id}/complete`)

  it("books beaters at their own day rate, and booking twice doesn't double up", async () => {
    const dai = await addBeater('Dai', 45)
    assert.equal((await book([dai.id])).status, 201)
    assert.equal((await book([dai.id])).status, 201)
    const bookings = await prisma.beaterBooking.findMany({ where: { shootId } })
    assert.equal(bookings.length, 1)
    assert.equal(bookings[0].dayRate, 45)
    assert.equal(bookings[0].status, 'INVITED')
  })

  it('refuses an inactive beater and a cancelled day', async () => {
    const gone = await prisma.beater.create({ data: { syndicateId: data.a.syndicate.id, name: 'Gone', status: 'INACTIVE' } })
    assert.equal((await book([gone.id])).status, 400)
    await prisma.shootDay.update({ where: { id: shootId }, data: { status: 'CANCELLED' } })
    assert.equal((await book([data.a.beater.id])).status, 400)
  })

  it('nobody is owed anything until the day is complete', async () => {
    const dai = await addBeater('Dai', 45)
    await book([dai.id])
    await setStatus(dai.id, 'CONFIRMED')
    assert.equal((await paymentsOn()).length, 0)
  })

  it('completing the day owes each Confirmed beater their rate in pence, and nobody else', async () => {
    const [dai, bob, sam, tom] = await Promise.all([addBeater('Dai', 45), addBeater('Bob', 40), addBeater('Sam', 40), addBeater('Tom', 40)])
    await book([dai.id, bob.id, sam.id, tom.id])
    await setStatus(dai.id, 'CONFIRMED')
    await setStatus(bob.id, 'DECLINED')
    await setStatus(sam.id, 'NO_SHOW')
    // Tom stays "Asked"
    assert.equal((await complete()).status, 200)
    const payments = await paymentsOn()
    assert.deepEqual(payments.map((p) => [p.beaterId, p.amount, p.status]), [[dai.id, 4500, 'PENDING']])
  })

  it('completing twice, or many times at once, never doubles what is owed', async () => {
    const beaters = await Promise.all(['Dai', 'Bob', 'Sam'].map((name) => addBeater(name, 40)))
    await book(beaters.map((b) => b.id))
    for (const b of beaters) await setStatus(b.id, 'CONFIRMED')
    await complete()
    await complete()
    assert.equal((await paymentsOn()).length, 3)

    // The race that matters is the first completion of a day: fire it from many places at once.
    for (let round = 0; round < 6; round++) {
      const day = await prisma.shootDay.create({ data: { syndicateId: data.a.syndicate.id, date: new Date('2026-12-12'), locationName: `Race ${round}` } })
      await prisma.beaterBooking.createMany({
        data: beaters.map((b) => ({ syndicateId: data.a.syndicate.id, beaterId: b.id, shootId: day.id, dayRate: 40, status: 'CONFIRMED' as const })),
      })
      await Promise.all(Array.from({ length: 8 }, () => complete(day.id)))
      assert.equal((await paymentsOn(day.id)).length, 3, `round ${round}`)
    }
  })

  it('confirming several beaters at once on a completed day records each exactly once', async () => {
    const beaters = await Promise.all(['Dai', 'Bob', 'Sam', 'Tom'].map((name) => addBeater(name, 40)))
    for (let round = 0; round < 6; round++) {
      const day = await prisma.shootDay.create({ data: { syndicateId: data.a.syndicate.id, date: new Date('2026-12-19'), locationName: `Busy ${round}`, status: 'COMPLETED' } })
      await prisma.beaterBooking.createMany({
        data: beaters.map((b) => ({ syndicateId: data.a.syndicate.id, beaterId: b.id, shootId: day.id, dayRate: 40 })),
      })
      await Promise.all(beaters.map((b) => setStatus(b.id, 'CONFIRMED', day.id)))
      assert.equal((await paymentsOn(day.id)).length, 4, `round ${round}`)
    }
  })

  it('bringing the records into line never alters or removes a paid record', async () => {
    const dai = await addBeater('Dai', 45)
    const paid = await prisma.beaterPayment.create({
      data: { syndicateId: data.a.syndicate.id, beaterId: dai.id, shootId, amount: 4500, status: 'PAID', paymentReference: 'CASH' },
    })
    await prisma.shootDay.update({ where: { id: shootId }, data: { status: 'COMPLETED' } })
    // No booking at all for Dai now, so the rule says nothing is owed: the paid record must still stand.
    await prisma.$transaction((tx) => syncBeaterPayments(tx, shootId))
    assert.deepEqual(await paymentsOn(), [paid])
  })

  it('after the day, what is owed follows every change to the beaters', async () => {
    const [dai, bob] = await Promise.all([addBeater('Dai', 45), addBeater('Bob', 40)])
    await book([dai.id])
    await setStatus(dai.id, 'CONFIRMED')
    await complete()

    await as('PATCH', `/api/shoots/${shootId}/beaters/${(await bookingOf(dai.id)).id}`, { dayRate: 50 })
    assert.deepEqual((await paymentsOn()).map((p) => p.amount), [5000], 'rate change')

    await book([bob.id])
    await setStatus(bob.id, 'CONFIRMED')
    assert.deepEqual((await paymentsOn()).map((p) => p.amount), [4000, 5000], 'added late')

    await setStatus(bob.id, 'NO_SHOW')
    assert.deepEqual((await paymentsOn()).map((p) => p.amount), [5000], 'marked no-show')

    await as('DELETE', `/api/shoots/${shootId}/beaters/${(await bookingOf(dai.id)).id}`)
    assert.equal((await paymentsOn()).length, 0, 'removed')
  })

  it('once a beater is paid for the day, their booking is locked and the day cannot be cancelled', async () => {
    const dai = await addBeater('Dai', 45)
    await book([dai.id])
    await setStatus(dai.id, 'CONFIRMED')
    await complete()
    const [payment] = await paymentsOn()
    assert.equal((await as('POST', `/api/beaters/${dai.id}/pay`, { payments: [{ paymentId: payment.id, amount: 4500 }], paymentReference: 'BEAT NOV' })).status, 200)

    const booking = await bookingOf(dai.id)
    assert.equal((await as('PATCH', `/api/shoots/${shootId}/beaters/${booking.id}`, { status: 'NO_SHOW' })).status, 409)
    assert.equal((await as('PATCH', `/api/shoots/${shootId}/beaters/${booking.id}`, { dayRate: 99 })).status, 409)
    assert.equal((await as('DELETE', `/api/shoots/${shootId}/beaters/${booking.id}`)).status, 409)
    assert.equal((await as('POST', `/api/shoots/${shootId}/cancel`)).status, 409)
    assert.equal((await as('DELETE', `/api/shoots/${shootId}`)).status, 400, 'completed days are never deleted')
    const [after] = await paymentsOn()
    assert.deepEqual([after.status, after.amount, after.paymentReference], ['PAID', 4500, 'BEAT NOV'])
  })

  it('marking paid only ever pays exactly what was on screen, once', async () => {
    const dai = await addBeater('Dai', 45)
    await book([dai.id])
    await setStatus(dai.id, 'CONFIRMED')
    await complete()
    const [payment] = await paymentsOn()
    const pay = (amount: number, reference = 'REF') =>
      as('POST', `/api/beaters/${dai.id}/pay`, { payments: [{ paymentId: payment.id, amount }], paymentReference: reference })

    // The rate went up after the captain loaded the page: £45 on screen, £50 owed now.
    await as('PATCH', `/api/shoots/${shootId}/beaters/${(await bookingOf(dai.id)).id}`, { dayRate: 50 })
    assert.equal((await pay(4500)).status, 409)
    assert.equal((await paymentsOn())[0].status, 'PENDING', 'nothing marked paid on a mismatch')

    const ok = await pay(5000, 'FIRST')
    assert.equal(ok.status, 200)
    assert.deepEqual([ok.json.updated, ok.json.total], [1, 5000])

    // Paying it again (a second tab, a retry) is refused and the original record stands.
    assert.equal((await pay(5000, 'SECOND')).status, 409)
    const [after] = await paymentsOn()
    assert.deepEqual([after.status, after.paymentReference], ['PAID', 'FIRST'])
  })

  it('paying and changing the day at the same moment never alters a paid record', async () => {
    for (let round = 0; round < 6; round++) {
      const dai = await addBeater(`Dai ${round}`, 45)
      const day = (await prisma.shootDay.create({ data: { syndicateId: data.a.syndicate.id, date: new Date('2026-12-05'), locationName: `Race ${round}` } })).id
      await book([dai.id], day)
      await setStatus(dai.id, 'CONFIRMED', day)
      await complete(day)
      const [payment] = await paymentsOn(day)
      const booking = await bookingOf(dai.id, day)
      await Promise.all([
        as('POST', `/api/beaters/${dai.id}/pay`, { payments: [{ paymentId: payment.id, amount: 4500 }] }),
        as('PATCH', `/api/shoots/${day}/beaters/${booking.id}`, { status: 'NO_SHOW' }),
      ])
      const rows = await paymentsOn(day)
      // Either the pay won (paid, booking unchanged) or the no-show won (nothing owed, nothing paid).
      if (rows.length === 1) {
        assert.deepEqual([rows[0].status, rows[0].amount], ['PAID', 4500], `round ${round}`)
        assert.equal((await bookingOf(dai.id, day)).status, 'CONFIRMED', `round ${round}`)
      } else {
        assert.equal(rows.length, 0, `round ${round}`)
        assert.equal((await bookingOf(dai.id, day)).status, 'NO_SHOW', `round ${round}`)
      }
    }
  })

  it('bank details are checked when a beater is added', async () => {
    const bad = await as('POST', '/api/beaters', { syndicateId: data.a.syndicate.id, name: 'X', bankSortCode: '12-34', bankAccountNumber: '12345678' })
    assert.equal(bad.status, 400)
    const good = await as('POST', '/api/beaters', { syndicateId: data.a.syndicate.id, name: 'Y', bankSortCode: '123456', bankAccountNumber: '0123 4567' })
    assert.equal(good.status, 201)
    const saved = await prisma.beater.findUniqueOrThrow({ where: { id: good.json.id } })
    assert.deepEqual([saved.bankSortCode, saved.bankAccountNumber], ['12-34-56', '01234567'])
  })

  it('cancelling a completed day that nobody has been paid for clears what was owed', async () => {
    const dai = await addBeater('Dai', 45)
    await book([dai.id])
    await setStatus(dai.id, 'CONFIRMED')
    await complete()
    assert.equal((await as('POST', `/api/shoots/${shootId}/cancel`)).status, 200)
    assert.equal((await paymentsOn()).length, 0)
  })

  it('the pay summary shows what is owed in pence, by day, and counts days in the tax year', async () => {
    const dai = await addBeater('Dai', 45)
    await book([dai.id])
    await setStatus(dai.id, 'CONFIRMED')
    await complete()

    const res = await as('GET', `/api/beaters/payments/summary?syndicateId=${data.a.syndicate.id}`)
    assert.equal(res.status, 200)
    const row = res.json.beaters.find((b: { id: string }) => b.id === dai.id)
    assert.equal(row.dayRatePence, 4500)
    assert.equal(row.totalOutstanding, 4500)
    assert.deepEqual(row.owed.map((o: { amount: number; locationName: string }) => [o.amount, o.locationName]), [[4500, 'Top Wood']])
    assert.equal(res.json.casualDayLimit, HMRC_CASUAL_DAY_LIMIT)
  })

  /** n completed, confirmed days for a beater in the current tax year, on distinct dates. */
  const workDays = async (beaterId: string, n: number, offsetDays = 1) => {
    const { start } = taxYearOf(new Date())
    for (let day = 0; day < n; day++) {
      const shoot = await prisma.shootDay.create({
        data: { syndicateId: data.a.syndicate.id, date: new Date(start.getTime() + (day + offsetDays) * 86_400_000), locationName: `Day ${day}`, status: 'COMPLETED' },
      })
      await prisma.beaterPayment.create({ data: { syndicateId: data.a.syndicate.id, beaterId, shootId: shoot.id, amount: 4000, status: 'PAID' } })
    }
  }
  const payRow = async (beaterId: string) =>
    (await as('GET', `/api/beaters/payments/summary?syndicateId=${data.a.syndicate.id}`)).json.beaters.find((b: { id: string }) => b.id === beaterId)

  it(`HMRC's ${HMRC_CASUAL_DAY_LIMIT}-day limit: under, at, expected over, and over`, async () => {
    const [under, at, booked, over] = await Promise.all(['Under', 'At', 'Booked', 'Over'].map((n) => addBeater(n, 40)))
    await workDays(under.id, HMRC_CASUAL_DAY_LIMIT - 1)
    await workDays(at.id, HMRC_CASUAL_DAY_LIMIT)
    await workDays(over.id, HMRC_CASUAL_DAY_LIMIT + 1)
    // 14 worked plus one confirmed day still to come this tax year.
    await workDays(booked.id, HMRC_CASUAL_DAY_LIMIT)
    const { end } = taxYearOf(new Date())
    const upcoming = await prisma.shootDay.create({ data: { syndicateId: data.a.syndicate.id, date: new Date(end.getTime() - 2 * 86_400_000), locationName: 'Later' } })
    await prisma.beaterBooking.create({ data: { syndicateId: data.a.syndicate.id, beaterId: booked.id, shootId: upcoming.id, dayRate: 40, status: 'CONFIRMED' } })

    assert.equal((await payRow(under.id)).casualLimit, 'under')
    assert.equal((await payRow(at.id)).casualLimit, 'atLimit')
    const bookedRow = await payRow(booked.id)
    assert.deepEqual([bookedRow.daysThisTaxYear, bookedRow.daysExpectedThisTaxYear, bookedRow.casualLimit], [HMRC_CASUAL_DAY_LIMIT, HMRC_CASUAL_DAY_LIMIT + 1, 'expectedOver'])
    assert.equal((await payRow(over.id)).casualLimit, 'over')
  })

  it('a day in last tax year does not count, and two shoots on one date are one day', async () => {
    const dai = await addBeater('Dai', 40)
    await workDays(dai.id, 2)
    const { start } = taxYearOf(new Date())
    const old = await prisma.shootDay.create({ data: { syndicateId: data.a.syndicate.id, date: new Date(start.getTime() - 86_400_000), locationName: 'Last year', status: 'COMPLETED' } })
    await prisma.beaterPayment.create({ data: { syndicateId: data.a.syndicate.id, beaterId: dai.id, shootId: old.id, amount: 4000, status: 'PAID' } })
    // An afternoon shoot on the same date as the first day.
    const afternoon = await prisma.shootDay.create({ data: { syndicateId: data.a.syndicate.id, date: new Date(start.getTime() + 86_400_000), locationName: 'Afternoon', status: 'COMPLETED' } })
    await prisma.beaterPayment.create({ data: { syndicateId: data.a.syndicate.id, beaterId: dai.id, shootId: afternoon.id, amount: 4000, status: 'PAID' } })

    const row = await payRow(dai.id)
    assert.deepEqual([row.daysThisTaxYear, row.daysWorked], [2, 3])
  })

  it('a beater who has left still shows while they are owed money', async () => {
    const dai = await addBeater('Dai', 45)
    await book([dai.id])
    await setStatus(dai.id, 'CONFIRMED')
    await complete()
    await prisma.beater.update({ where: { id: dai.id }, data: { status: 'INACTIVE' } })
    const res = await as('GET', `/api/beaters/payments/summary?syndicateId=${data.a.syndicate.id}`)
    assert.ok(res.json.beaters.some((b: { id: string }) => b.id === dai.id))
  })
})
