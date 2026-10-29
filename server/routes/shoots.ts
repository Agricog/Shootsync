import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import type { Deps } from '../deps.js'
import {
  HttpError,
  handle,
  notFound,
  queryString,
  requireSyndicateAccess,
  syndicateOfMember,
  syndicateOfShoot,
  syndicateSelect,
  withoutCaptainOnlyFields,
} from '../access.js'
import { fairDraw, randomDraw } from '../pegDraw.js'
import { lockShoot, syncBeaterPayments } from '../beaterPay.js'

const optionalText = (max: number) => z.string().trim().max(max).optional()
const dateString = z.string().min(1).refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date')

const createShootSchema = z.object({
  syndicateId: z.string().min(1),
  date: dateString.transform((s) => new Date(s)),
  locationName: z.string().trim().min(1).max(100),
  locationAddress: optionalText(300),
  locationPostcode: optionalText(12),
  locationWhat3Words: optionalText(100),
  meetTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Meet time must be like 08:30')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  drivesPlanned: z.number().int().min(1).max(50).optional(),
  expectedBag: z.number().int().min(0).max(100_000).optional(),
  captainNotes: optionalText(5000),
})

// Editing: optional text can be cleared with null; the meet time must be a real time.
const clearableText = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v === '' ? null : v))

const updateShootSchema = createShootSchema
  .omit({ syndicateId: true, locationAddress: true, locationPostcode: true, locationWhat3Words: true, captainNotes: true, expectedBag: true })
  .partial()
  .extend({
    locationAddress: clearableText(300),
    locationPostcode: clearableText(12),
    locationWhat3Words: clearableText(100),
    captainNotes: clearableText(5000),
    expectedBag: z.number().int().min(0).max(100_000).nullable().optional(),
  })

const checkInSchema = z.object({
  memberId: z.string().min(1),
})

const statusFilter = z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).optional()

const MAX_PEGS = 40
const GUN_ROLES = ['CAPTAIN', 'GUN', 'HYBRID'] as const

const drawSchema = z.object({
  method: z.enum(['fair', 'random']),
  numberOfPegs: z.number().int().min(1).max(MAX_PEGS),
  memberIds: z
    .array(z.string().min(1).max(64))
    .min(1, 'Choose at least one gun')
    .max(MAX_PEGS)
    .refine((ids) => new Set(ids).size === ids.length, 'A gun is listed twice'),
})

const bookBeatersSchema = z.object({
  beaterIds: z
    .array(z.string().min(1).max(64))
    .min(1, 'Choose at least one beater')
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, 'A beater is listed twice'),
})

const updateBookingSchema = z
  .object({
    status: z.enum(['INVITED', 'CONFIRMED', 'DECLINED', 'NO_SHOW']).optional(),
    dayRate: z.number().int().min(0).max(1000).optional(),
  })
  .refine((d) => d.status !== undefined || d.dayRate !== undefined, 'Nothing to change')

const savePegsSchema = z.object({
  allocations: z
    .array(z.object({ memberId: z.string().min(1).max(64), pegNumber: z.number().int().min(1).max(MAX_PEGS) }))
    .max(MAX_PEGS)
    .refine((a) => new Set(a.map((x) => x.memberId)).size === a.length, 'A gun is listed twice')
    .refine((a) => new Set(a.map((x) => x.pegNumber)).size === a.length, 'Two guns are on the same peg'),
})

export function shootRoutes({ prisma }: Deps): Router {
  const router = Router()

  // GET /api/shoots?syndicateId= - captain and active members
  router.get('/', handle(async (req, res) => {
    const syndicateId = queryString(req.query.syndicateId)
    const access = await requireSyndicateAccess(prisma, syndicateId, req, 'member')
    const status = statusFilter.parse(queryString(req.query.status))

    const shoots = await prisma.shootDay.findMany({
      where: {
        syndicateId,
        ...(status ? { status } : {}),
        ...(req.query.upcoming === 'true' ? { date: { gte: new Date() } } : {}),
      },
      orderBy: { date: 'asc' },
      include: {
        _count: { select: { attendances: true, guestGuns: true, beaterBookings: true } },
      },
    })
    res.json(access.isCaptain ? shoots : shoots.map(withoutCaptainOnlyFields))
  }))

  // GET /api/shoots/:id - full shoot sheet, captain only
  router.get('/:id', handle(async (req, res) => {
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')

    const shoot = await prisma.shootDay.findUnique({
      where: { id: req.params.id },
      include: {
        syndicate: { select: syndicateSelect },
        attendances: { include: { member: true }, orderBy: { pegNumber: 'asc' } },
        guestGuns: { include: { invitedByMember: { select: { id: true, name: true } } } },
        beaterBookings: {
          include: { beater: { select: { id: true, name: true, phone: true, email: true, dayRate: true } } },
          orderBy: { beater: { name: 'asc' } },
        },
        beaterPayments: { select: { beaterId: true, amount: true, status: true } },
        bagRecords: { orderBy: { driveNumber: 'asc' } },
      },
    })
    if (!shoot) throw notFound('That shoot day could not be found. It may have been removed.')

    const bagTotals = shoot.bagRecords.reduce(
      (acc, bag) => ({
        pheasant: acc.pheasant + bag.pheasant,
        partridge: acc.partridge + bag.partridge,
        duck: acc.duck + bag.duck,
        woodcock: acc.woodcock + bag.woodcock,
        other: acc.other + bag.other,
      }),
      { pheasant: 0, partridge: 0, duck: 0, woodcock: 0, other: 0 }
    )

    res.json({ ...shoot, bagTotals })
  }))

  // POST /api/shoots - captain only
  router.post('/', handle(async (req, res) => {
    const data = createShootSchema.parse(req.body)
    await requireSyndicateAccess(prisma, data.syndicateId, req, 'captain')

    const shoot = await prisma.shootDay.create({
      data: {
        syndicateId: data.syndicateId,
        date: data.date,
        locationName: data.locationName,
        locationAddress: data.locationAddress,
        locationPostcode: data.locationPostcode,
        locationWhat3Words: data.locationWhat3Words,
        meetTime: data.meetTime || '08:30',
        drivesPlanned: data.drivesPlanned ?? 4,
        expectedBag: data.expectedBag,
        captainNotes: data.captainNotes,
      },
    })
    res.status(201).json(shoot)
  }))

  // PATCH /api/shoots/:id - captain only.
  // The date can only move while the day is still scheduled and nobody has been owed or paid
  // for it: pay, the HMRC tax-year count and the peg history all hang off the date.
  router.patch('/:id', handle(async (req, res) => {
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')
    const data = updateShootSchema.parse(req.body)

    const shoot = await prisma.$transaction(async (tx) => {
      await lockShoot(tx, req.params.id)
      const current = await tx.shootDay.findUnique({ where: { id: req.params.id }, select: { status: true, date: true } })
      if (!current) throw notFound('That shoot day could not be found. It may have been removed.')
      if (data.date && data.date.getTime() !== current.date.getTime()) {
        const payments = await tx.beaterPayment.count({ where: { shootId: req.params.id } })
        if (current.status !== 'SCHEDULED' || payments > 0) {
          throw new HttpError(409, 'This day has been completed or cancelled, so its date can no longer change')
        }
      }
      return tx.shootDay.update({ where: { id: req.params.id }, data })
    })
    res.json(shoot)
  }))

  // POST /api/shoots/:id/complete - captain only.
  // Completing the day records what each confirmed beater is owed (server/beaterPay.ts).
  // Completing again is harmless: the records are brought into line, never doubled.
  router.post('/:id/complete', handle(async (req, res) => {
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')

    const shoot = await prisma.$transaction(async (tx) => {
      await lockShoot(tx, req.params.id)
      const current = await tx.shootDay.findUnique({ where: { id: req.params.id }, select: { status: true } })
      if (!current) throw notFound('That shoot day could not be found. It may have been removed.')
      if (current.status === 'CANCELLED') throw new HttpError(400, 'A cancelled shoot day cannot be completed')
      const updated = await tx.shootDay.update({ where: { id: req.params.id }, data: { status: 'COMPLETED' } })
      await syncBeaterPayments(tx, req.params.id)
      return updated
    })
    res.json(shoot)
  }))

  // POST /api/shoots/:id/cancel - captain only. Not once beaters have been paid for the day.
  router.post('/:id/cancel', handle(async (req, res) => {
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')

    const shoot = await prisma.$transaction(async (tx) => {
      await lockShoot(tx, req.params.id)
      const current = await tx.shootDay.findUnique({ where: { id: req.params.id }, select: { status: true } })
      // A completed day happened: cancelling it would wipe what the beaters are owed.
      if (current?.status === 'COMPLETED') throw new HttpError(409, 'This day has been completed, so it cannot be cancelled')
      const paid = await tx.beaterPayment.count({ where: { shootId: req.params.id, status: 'PAID' } })
      if (paid > 0) throw new HttpError(409, 'Beaters have already been paid for this day, so it cannot be cancelled')
      const updated = await tx.shootDay.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } })
      await syncBeaterPayments(tx, req.params.id)
      return updated
    })
    res.json(shoot)
  }))

  // ---- Beaters on the day --------------------------------------------------------
  // The captain books beaters onto the day and marks how each one stands. On a completed
  // day every change is followed by syncBeaterPayments, so what's owed always matches.
  // A booking whose pay has been marked paid can't be changed or removed.

  const requirePaidNot = async (tx: Prisma.TransactionClient, shootId: string, beaterId: string) => {
    const paid = await tx.beaterPayment.count({ where: { shootId, beaterId, status: 'PAID' } })
    if (paid > 0) throw new HttpError(409, 'This beater has already been paid for the day')
  }

  /** Read inside the locked transaction, so a booking removed a moment ago is a clean 404. */
  const bookingOnShoot = async (tx: Prisma.TransactionClient, shootId: string, bookingId: string) => {
    const booking = await tx.beaterBooking.findUnique({ where: { id: bookingId }, select: { id: true, shootId: true, beaterId: true } })
    if (!booking || booking.shootId !== shootId) throw notFound('That booking could not be found. It may have been removed.')
    return booking
  }

  // POST /api/shoots/:id/beaters - book beaters at their own day rate, captain only
  router.post('/:id/beaters', handle(async (req, res) => {
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')
    const { beaterIds } = bookBeatersSchema.parse(req.body)

    await prisma.$transaction(async (tx) => {
      await lockShoot(tx, req.params.id)
      const shoot = await tx.shootDay.findUnique({ where: { id: req.params.id }, select: { status: true } })
      if (shoot?.status === 'CANCELLED') throw new HttpError(400, 'This shoot day is cancelled')
      const beaters = await tx.beater.findMany({
        where: { id: { in: beaterIds }, syndicateId: syndicateId!, status: 'ACTIVE' },
        select: { id: true, dayRate: true },
      })
      if (beaters.length !== beaterIds.length) throw new HttpError(400, 'Every beater must be an active beater in this syndicate')
      await tx.beaterBooking.createMany({
        data: beaters.map((b) => ({ syndicateId: syndicateId!, beaterId: b.id, shootId: req.params.id, dayRate: b.dayRate, status: 'INVITED' as const })),
        skipDuplicates: true,
      })
      await syncBeaterPayments(tx, req.params.id)
    })

    const bookings = await prisma.beaterBooking.findMany({
      where: { shootId: req.params.id },
      include: { beater: { select: { id: true, name: true, phone: true } } },
      orderBy: { beater: { name: 'asc' } },
    })
    res.status(201).json(bookings)
  }))

  // PATCH /api/shoots/:id/beaters/:bookingId - status or day rate, captain only
  router.patch('/:id/beaters/:bookingId', handle(async (req, res) => {
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')
    const data = updateBookingSchema.parse(req.body)

    const updated = await prisma.$transaction(async (tx) => {
      await lockShoot(tx, req.params.id)
      const booking = await bookingOnShoot(tx, req.params.id, req.params.bookingId)
      await requirePaidNot(tx, req.params.id, booking.beaterId)
      const result = await tx.beaterBooking.update({
        where: { id: booking.id },
        data: {
          ...data,
          ...(data.status === 'CONFIRMED' ? { confirmedAt: new Date() } : {}),
        },
      })
      await syncBeaterPayments(tx, req.params.id)
      return result
    })
    res.json(updated)
  }))

  // DELETE /api/shoots/:id/beaters/:bookingId - take a beater off the day, captain only
  router.delete('/:id/beaters/:bookingId', handle(async (req, res) => {
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')

    await prisma.$transaction(async (tx) => {
      await lockShoot(tx, req.params.id)
      const booking = await bookingOnShoot(tx, req.params.id, req.params.bookingId)
      await requirePaidNot(tx, req.params.id, booking.beaterId)
      await tx.beaterBooking.delete({ where: { id: booking.id } })
      await syncBeaterPayments(tx, req.params.id)
    })
    res.json({ success: true })
  }))

  // ---- Peg draw ----------------------------------------------------------------
  // The season's record is every peg saved on this syndicate's other shoot days from the
  // start of the season up to this one, ignoring cancelled days. Two days on the same date
  // (a morning and an afternoon) are ordered by when they were added.
  // Pegs are written only by PUT /:id/pegs, which refuses two guns on one peg.

  /** The shoot, with its syndicate's season start, refusing a cancelled day for changes. */
  const pegShoot = async (shootId: string) => {
    const shoot = await prisma.shootDay.findUnique({
      where: { id: shootId },
      select: { id: true, date: true, createdAt: true, locationName: true, status: true, syndicateId: true, syndicate: { select: { seasonStart: true } } },
    })
    if (!shoot) throw notFound('That shoot day could not be found. It may have been removed.')
    return shoot
  }

  const seasonHistory = (shoot: Awaited<ReturnType<typeof pegShoot>>) =>
    prisma.shootAttendance.findMany({
      where: {
        pegNumber: { not: null },
        shootId: { not: shoot.id },
        shootDay: {
          syndicateId: shoot.syndicateId,
          status: { not: 'CANCELLED' },
          date: { gte: shoot.syndicate.seasonStart },
          OR: [{ date: { lt: shoot.date } }, { date: shoot.date, createdAt: { lt: shoot.createdAt } }],
        },
      },
      select: { memberId: true, pegNumber: true, shootDay: { select: { date: true } } },
      orderBy: { shootDay: { date: 'asc' } },
    })

  const activeGuns = (syndicateId: string) =>
    prisma.member.findMany({
      where: { syndicateId, status: 'ACTIVE', role: { in: [...GUN_ROLES] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    })

  /** Every id must be an active gun of this syndicate; anything else is refused, not skipped. */
  const requireActiveGuns = async (syndicateId: string, memberIds: string[], db: Pick<typeof prisma, 'member'> = prisma) => {
    const guns = await db.member.count({
      where: { id: { in: memberIds }, syndicateId, status: 'ACTIVE', role: { in: [...GUN_ROLES] } },
    })
    if (guns !== memberIds.length) throw new HttpError(400, 'Every gun must be an active member of this syndicate')
  }

  // GET /api/shoots/:id/pegs - the day's saved pegs and each gun's record this season, captain only
  router.get('/:id/pegs', handle(async (req, res) => {
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')
    const shoot = await pegShoot(req.params.id)

    const [guns, history, saved] = await Promise.all([
      activeGuns(shoot.syndicateId),
      seasonHistory(shoot),
      prisma.shootAttendance.findMany({
        where: { shootId: shoot.id, pegNumber: { not: null } },
        select: { memberId: true, pegNumber: true },
        orderBy: { pegNumber: 'asc' },
      }),
    ])

    res.json({
      shoot: { id: shoot.id, date: shoot.date, locationName: shoot.locationName, status: shoot.status },
      guns: guns.map((gun) => ({
        ...gun,
        history: history
          .filter((h) => h.memberId === gun.id)
          .map((h) => ({ pegNumber: h.pegNumber, shootDate: h.shootDay.date })),
      })),
      saved,
    })
  }))

  // POST /api/shoots/:id/pegs/draw - propose a draw; saves nothing, captain only
  router.post('/:id/pegs/draw', handle(async (req, res) => {
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')
    const { method, numberOfPegs, memberIds } = drawSchema.parse(req.body)
    if (memberIds.length > numberOfPegs) throw new HttpError(400, `There are ${memberIds.length} guns but only ${numberOfPegs} pegs`)

    const shoot = await pegShoot(req.params.id)
    if (shoot.status === 'CANCELLED') throw new HttpError(400, 'This shoot day is cancelled')
    await requireActiveGuns(shoot.syndicateId, memberIds)

    const history = method === 'fair' ? await seasonHistory(shoot) : []
    const allocations =
      method === 'fair'
        ? fairDraw(memberIds, numberOfPegs, history.map((h) => ({ memberId: h.memberId, pegNumber: h.pegNumber as number })))
        : randomDraw(memberIds, numberOfPegs)
    res.json({ method, numberOfPegs, allocations })
  }))

  // PUT /api/shoots/:id/pegs - save the whole peg list at once, captain only.
  // Guns left off the list lose their peg for this day; nothing else about them changes.
  router.put('/:id/pegs', handle(async (req, res) => {
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')
    const { allocations } = savePegsSchema.parse(req.body)

    const shoot = await pegShoot(req.params.id)
    if (shoot.status === 'CANCELLED') throw new HttpError(400, 'This shoot day is cancelled')
    const memberIds = allocations.map((a) => a.memberId)

    // One save per shoot day at a time: the row lock makes a second save (another tab or
    // device) wait, then replace the list whole, so two guns can never end up on one peg.
    await prisma.$transaction(async (tx) => {
      await lockShoot(tx, shoot.id)
      await requireActiveGuns(shoot.syndicateId, memberIds, tx)
      await tx.shootAttendance.updateMany({
        where: { shootId: shoot.id, memberId: { notIn: memberIds } },
        data: { pegNumber: null },
      })
      for (const { memberId, pegNumber } of allocations) {
        await tx.shootAttendance.upsert({
          where: { shootId_memberId: { shootId: shoot.id, memberId } },
          update: { pegNumber, confirmed: true, roleOnDay: 'GUN' },
          create: { shootId: shoot.id, memberId, pegNumber, confirmed: true, roleOnDay: 'GUN' },
        })
      }
    })

    const saved = await prisma.shootAttendance.findMany({
      where: { shootId: shoot.id, pegNumber: { not: null } },
      select: { memberId: true, pegNumber: true },
      orderBy: { pegNumber: 'asc' },
    })
    res.json({ saved })
  }))

  // POST /api/shoots/:id/checkin - captain checks anyone in; a member checks themselves in
  router.post('/:id/checkin', handle(async (req, res) => {
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    const access = await requireSyndicateAccess(prisma, syndicateId, req, 'member')
    const { memberId } = checkInSchema.parse(req.body)

    if (!access.isCaptain && access.memberId !== memberId) throw notFound()

    const attendance = await prisma.shootAttendance.update({
      where: { shootId_memberId: { shootId: req.params.id, memberId } },
      data: { attended: true, checkedInAt: new Date() },
    })
    res.json(attendance)
  }))

  // DELETE /api/shoots/:id - captain only, not once completed, never once anyone has been paid for it
  router.delete('/:id', handle(async (req, res) => {
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')

    await prisma.$transaction(async (tx) => {
      await lockShoot(tx, req.params.id)
      const shoot = await tx.shootDay.findUnique({ where: { id: req.params.id }, select: { status: true } })
      if (!shoot) throw notFound('That shoot day could not be found. It may have been removed.')
      if (shoot.status === 'COMPLETED') throw new HttpError(400, 'Cannot delete completed shoots')
      const paid = await tx.beaterPayment.count({ where: { shootId: req.params.id, status: 'PAID' } })
      if (paid > 0) throw new HttpError(409, 'Beaters have been paid for this day, so it cannot be deleted')
      // Deleting the day would delete its guests too, and with them the record of who paid.
      const paidGuests = await tx.guestGun.count({ where: { shootId: req.params.id, paymentStatus: 'PAID' } })
      if (paidGuests > 0) throw new HttpError(409, 'Guests have paid a day fee for this day, so it cannot be deleted. Cancel it instead.')
      await tx.shootDay.delete({ where: { id: req.params.id } })
    })
    res.json({ success: true })
  }))

  return router
}
