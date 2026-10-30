/**
 * What is on record stays on record, and the day is safe (batch 9b).
 *
 * - A guest's emergency contact is there for the captain: on the day's guest list and on the
 *   briefing sheet. The guest's own page never shows another guest's.
 * - A peg is one person's for the day: guests are placed by hand and can't land on a gun's peg,
 *   and the draw can't land a gun on a guest's.
 * - A day with anything on record (bag, pay, a signed acknowledgement, a payment) can't be
 *   deleted, only cancelled; a day with nothing on record can, invitations and all.
 * - A day that hasn't happened can't be marked complete.
 * - The acknowledgement: the server's words, in a version, recorded with a hash of exactly what
 *   was shown, including the syndicate's own clauses; a stale page is asked to read again.
 */

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Prisma, type PrismaClient } from '@prisma/client'
import { errorHandler } from '../server/access.js'
import { CAPTAIN_A, INVITE_TOKEN_A, TEST_TODAY, acceptBody, call, createTestPrisma, createTestStripe, resetDatabase, seed, startTestServer, testVerifier, type TestServer } from './helpers.js'
import { WAIVER_CLAUSES, WAIVER_VERSION, waiverHash, waiverText } from '../server/waiver.js'
import { sha256Hex } from '../src/lib/hash.js'

type Seeded = Awaited<ReturnType<typeof seed>>

describe('the guest acknowledgement text', () => {
  it('is an acknowledgement of ordinary risk, never a release from negligence', () => {
    const text = waiverText(null)
    assert.match(text, /does not mean accepting harm caused by anyone’s negligence, and nothing here excuses anyone from liability/)
    assert.match(text, /Nothing in this acknowledgement limits anyone’s liability for death or personal injury caused by negligence/)
    assert.doesNotMatch(text, /release|hold harmless|heirs|gross negligence|indemnif|waive/i)
    // Section 11A, Firearms Act 1968 (as inserted by the Policing and Crime Act 2017), stated in full.
    assert.match(text, /section 11A of the Firearms Act 1968/)
    for (const condition of ['private premises', 'aged 18 or over', 'holds a shotgun certificate', 'right to allow others to shoot game or vermin there', 'written authority', 'presence of the lender', 'conditions on the lender’s certificate']) {
      assert.ok(text.includes(condition), condition)
    }
    // No consent to treatment by tick-box, and the emergency contact knows they are named.
    assert.doesNotMatch(text, /emergency treatment/)
    assert.match(text, /who knows I have named them/)
    assert.match(text, /held by the syndicate to run the shoot day and keep its records, using ShootSync as its service provider/)
    assert.ok(WAIVER_CLAUSES.length >= 6)
    assert.match(WAIVER_VERSION, /^uk-\d{4}-\d{2}(\.\d+)?$/)
  })

  it('carries the syndicate’s own clauses under the standard text, and the hash changes with them', () => {
    const plain = waiverText(null)
    const extra = waiverText('No ground game.')
    assert.ok(extra.startsWith(plain))
    assert.match(extra, /This syndicate also asks that:\n\nNo ground game\.$/)
    assert.equal(waiverText('   '), plain)
    assert.notEqual(waiverHash(plain), waiverHash(extra))
    assert.match(waiverHash(plain), /^[a-f0-9]{64}$/)
  })
})

describe('records and the day, on the server', () => {
  let prisma: PrismaClient
  let data: Seeded
  let today = TEST_TODAY
  let server: TestServer

  before(async () => {
    prisma = createTestPrisma()
    server = await startTestServer(prisma, createTestStripe().stripe, testVerifier, () => today)
  })

  after(async () => {
    await server.close()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    today = TEST_TODAY
    await resetDatabase(prisma)
    data = await seed(prisma)
  })

  const as = (method: string, path: string, body?: unknown) => call(server, path, { method, as: CAPTAIN_A, body })
  const invite = () => call(server, `/api/guests/token/${INVITE_TOKEN_A}`)
  const accept = (body: unknown = acceptBody()) => call(server, `/api/guests/token/${INVITE_TOKEN_A}/accept`, { method: 'POST', body })

  describe('the acknowledgement', () => {
    it('is served with the invitation, from the server, in its version', async () => {
      const shown = await invite()
      assert.equal(shown.json.waiver.version, WAIVER_VERSION)
      assert.equal(shown.json.waiver.text, waiverText(null))
      assert.equal(shown.json.shootDay.syndicate.waiverExtra, undefined, 'the raw clauses field is not sent separately')
    })

    it('includes the syndicate’s own clauses, and records the version and the hash of exactly what was accepted', async () => {
      assert.equal((await as('PATCH', `/api/syndicates/${data.a.syndicate.id}`, { waiverExtra: 'No ground game.' })).status, 200)
      const shown = await invite()
      assert.match(shown.json.waiver.text, /No ground game\./)
      const accepted = await accept(acceptBody('No ground game.'))
      assert.equal(accepted.status, 200)
      const row = await prisma.guestGun.findUniqueOrThrow({ where: { id: data.a.guest.id } })
      assert.equal(row.waiverVersion, WAIVER_VERSION)
      assert.equal(row.waiverTextHash, waiverHash(waiverText('No ground game.')))
      // The words themselves are kept, so they can be read back after the syndicate edits its clauses.
      assert.equal(row.waiverText, waiverText('No ground game.'))
      assert.equal(row.waiverAccepted, true)
    })

    it('a page showing old words is asked to read again, and nothing is recorded', async () => {
      await as('PATCH', `/api/syndicates/${data.a.syndicate.id}`, { waiverExtra: 'Shotguns only.' })
      const stale = await accept(acceptBody(null))
      assert.equal(stale.status, 409)
      assert.match(stale.json.error, /updated since this page was opened/)
      const row = await prisma.guestGun.findUniqueOrThrow({ where: { id: data.a.guest.id } })
      assert.equal(row.waiverAccepted, false)
      assert.equal(row.rsvpStatus, 'PENDING')
    })

    it('a missing or malformed hash is refused before anything else', async () => {
      const { waiverTextHash: _h, ...noHash } = acceptBody()
      assert.equal((await accept(noHash)).status, 400)
      assert.equal((await accept({ ...acceptBody(), waiverTextHash: 'abc' })).status, 400)
    })

    it('the clauses can be cleared again', async () => {
      await as('PATCH', `/api/syndicates/${data.a.syndicate.id}`, { waiverExtra: 'Dogs by arrangement.' })
      assert.equal((await as('PATCH', `/api/syndicates/${data.a.syndicate.id}`, { waiverExtra: null })).status, 200)
      assert.equal((await invite()).json.waiver.text, waiverText(null))
    })
  })

  describe('emergency contacts', () => {
    it('the captain sees a confirmed guest’s emergency contact on the day', async () => {
      await accept()
      const day = await as('GET', `/api/shoots/${data.a.shoot.id}`)
      const guest = day.json.guestGuns.find((g: { id: string }) => g.id === data.a.guest.id)
      assert.equal(guest.emergencyContactName, 'Jo')
      assert.equal(guest.emergencyContactPhone, '07700900000')
    })

    it('the guest’s own page shows no emergency contact, not even their own, and never another guest', async () => {
      await accept()
      const shown = await invite()
      assert.equal(JSON.stringify(shown.json).includes('07700900000'), false)
    })
  })

  describe('pegs', () => {
    const setGuestPeg = (pegNumber: number | null) => as('PATCH', `/api/guests/${data.a.guest.id}`, { pegNumber })

    it('a guest can be placed on a free peg, and taken off it', async () => {
      assert.equal((await setGuestPeg(5)).status, 200)
      assert.equal((await prisma.guestGun.findUniqueOrThrow({ where: { id: data.a.guest.id } })).pegNumber, 5)
      assert.equal((await setGuestPeg(null)).status, 200)
      assert.equal((await prisma.guestGun.findUniqueOrThrow({ where: { id: data.a.guest.id } })).pegNumber, null)
    })

    it('not on a gun’s peg (the seed has the gun on peg 3), and not past 40', async () => {
      const taken = await setGuestPeg(3)
      assert.equal(taken.status, 409)
      assert.match(taken.json.error, /Peg 3 is already .*’s for this day/)
      assert.equal((await setGuestPeg(41)).status, 400)
    })

    it('not on another guest’s peg, unless that guest has declined', async () => {
      const other = await prisma.guestGun.create({ data: { shootId: data.a.shoot.id, invitedByMemberId: data.a.gun.id, name: 'Other Guest', email: 'o@example.com', pegNumber: 7 } })
      assert.equal((await setGuestPeg(7)).status, 409)
      await prisma.guestGun.update({ where: { id: other.id }, data: { rsvpStatus: 'DECLINED' } })
      assert.equal((await setGuestPeg(7)).status, 200)
    })

    it('not on a cancelled day', async () => {
      await prisma.shootDay.update({ where: { id: data.a.shoot.id }, data: { status: 'CANCELLED' } })
      const refused = await setGuestPeg(5)
      assert.equal(refused.status, 409)
      assert.match(refused.json.error, /cancelled/)
      assert.equal((await prisma.guestGun.findUniqueOrThrow({ where: { id: data.a.guest.id } })).pegNumber, null)
    })

    it('a free peg saved together with a fee that can’t change: nothing changes', async () => {
      await accept()
      const refused = await as('PATCH', `/api/guests/${data.a.guest.id}`, { pegNumber: 5, dayFee: 1 })
      assert.equal(refused.status, 409)
      assert.match(refused.json.error, /fee can’t change/)
      const guest = await prisma.guestGun.findUniqueOrThrow({ where: { id: data.a.guest.id } })
      assert.equal(guest.pegNumber, null)
      assert.notEqual(guest.dayFee, 1)
    })

    it('the browser computes the same hash of the same words as the server', async () => {
      const text = waiverText('No ground game.')
      assert.equal(await sha256Hex(text), waiverHash(text))
      assert.notEqual(await sha256Hex(waiverText(null)), waiverHash(text))
    })

    it('the draw can’t put a gun on a guest’s peg', async () => {
      await setGuestPeg(2)
      const save = await as('PUT', `/api/shoots/${data.a.shoot.id}/pegs`, { allocations: [{ memberId: data.a.gun.id, pegNumber: 2 }] })
      assert.equal(save.status, 409)
      assert.match(save.json.error, /Peg 2 is .* \(a guest\)/)
      assert.equal((await as('PUT', `/api/shoots/${data.a.shoot.id}/pegs`, { allocations: [{ memberId: data.a.gun.id, pegNumber: 4 }] })).status, 200)
    })
  })

  describe('deleting a shoot day', () => {
    const del = () => as('DELETE', `/api/shoots/${data.a.shoot.id}`)
    const clear = async () => {
      await prisma.bagRecord.deleteMany({ where: { shootId: data.a.shoot.id } })
      await prisma.beaterPayment.deleteMany({ where: { shootId: data.a.shoot.id } })
    }

    it('is refused while a bag is recorded, pay is owed, or a guest has signed or paid; and nothing goes', async () => {
      const before = await prisma.guestGun.count()
      assert.match((await del()).json.error, /Bag numbers have been recorded/)
      await prisma.bagRecord.deleteMany({ where: { shootId: data.a.shoot.id } })
      assert.match((await del()).json.error, /Beaters are owed or have been paid/)
      await prisma.beaterPayment.deleteMany({ where: { shootId: data.a.shoot.id } })
      await accept()
      assert.match((await del()).json.error, /signed the acknowledgement/)
      await prisma.guestGun.update({ where: { id: data.a.guest.id }, data: { waiverAccepted: false, paymentStatus: 'PAID' } })
      assert.match((await del()).json.error, /signed the acknowledgement/)
      assert.ok(await prisma.shootDay.findUnique({ where: { id: data.a.shoot.id } }))
      assert.equal(await prisma.guestGun.count(), before)
    })

    it('a day with nothing on record goes, with its unanswered invitations', async () => {
      await clear()
      assert.equal((await del()).status, 200)
      assert.equal(await prisma.shootDay.findUnique({ where: { id: data.a.shoot.id } }), null)
      assert.equal(await prisma.guestGun.findUnique({ where: { id: data.a.guest.id } }), null)
    })

    it('if the database’s refusal is ever the first to speak (older code mid-upload), it is a sentence, not a 500', () => {
      const err = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' })
      let status = 0
      let body: { error?: string } = {}
      const res = { status: (code: number) => ({ json: (payload: { error: string }) => { status = code; body = payload } }) }
      errorHandler(err, { method: 'DELETE', path: '/x' } as never, res as never, () => {})
      assert.equal(status, 409)
      assert.match(body.error ?? '', /part of the record/)
    })

    it('the database itself refuses to lose a bag, a payment or a signed acknowledgement', async () => {
      await assert.rejects(prisma.shootDay.delete({ where: { id: data.a.shoot.id } }), /Foreign key constraint|violates foreign key/)
      assert.ok(await prisma.bagRecord.findUnique({ where: { id: data.a.bag.id } }))
      await assert.rejects(prisma.beater.delete({ where: { id: data.a.beater.id } }), /Foreign key constraint|violates foreign key/)
    })
  })

  describe('completing a day', () => {
    it('is refused before the day, allowed on the day and after', async () => {
      today = '2026-11-13'
      const early = await as('POST', `/api/shoots/${data.a.shoot.id}/complete`)
      assert.equal(early.status, 409)
      assert.match(early.json.error, /hasn’t happened yet/)
      assert.equal((await prisma.shootDay.findUniqueOrThrow({ where: { id: data.a.shoot.id } })).status, 'SCHEDULED')
      today = '2026-11-14'
      assert.equal((await as('POST', `/api/shoots/${data.a.shoot.id}/complete`)).status, 200)
    })
  })
})
