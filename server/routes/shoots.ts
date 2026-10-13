import { Router } from 'express'
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
  userIdOf,
  withoutCaptainOnlyFields,
} from '../access.js'

const optionalText = (max: number) => z.string().trim().max(max).optional()
const dateString = z.string().min(1).refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date')

const createShootSchema = z.object({
  syndicateId: z.string().min(1),
  date: dateString.transform((s) => new Date(s)),
  locationName: z.string().trim().min(1).max(100),
  locationAddress: optionalText(300),
  locationPostcode: optionalText(12),
  locationWhat3Words: optionalText(100),
  meetTime: optionalText(10),
  drivesPlanned: z.number().int().min(1).max(50).optional(),
  expectedBag: z.number().int().min(0).max(100_000).optional(),
  captainNotes: optionalText(5000),
})

const updateShootSchema = createShootSchema.omit({ syndicateId: true }).partial()

const attendanceSchema = z.object({
  memberId: z.string().min(1),
  roleOnDay: z.enum(['CAPTAIN', 'GUN', 'BEATER', 'HYBRID']).optional(),
  pegNumber: z.number().int().min(1).max(100).nullable().optional(),
  confirmed: z.boolean().optional(),
})

const checkInSchema = z.object({
  memberId: z.string().min(1),
})

const statusFilter = z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).optional()

export function shootRoutes({ prisma }: Deps): Router {
  const router = Router()

  // GET /api/shoots?syndicateId= - captain and active members
  router.get('/', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = queryString(req.query.syndicateId)
    const access = await requireSyndicateAccess(prisma, syndicateId, userId, 'member')
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
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')

    const shoot = await prisma.shootDay.findUnique({
      where: { id: req.params.id },
      include: {
        syndicate: { select: syndicateSelect },
        attendances: { include: { member: true }, orderBy: { pegNumber: 'asc' } },
        guestGuns: { include: { invitedByMember: { select: { id: true, name: true } } } },
        beaterBookings: {
          include: { beater: { select: { id: true, name: true, phone: true, email: true, dayRate: true } } },
        },
        bagRecords: { orderBy: { driveNumber: 'asc' } },
      },
    })
    if (!shoot) throw notFound('Shoot not found')

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
    const userId = userIdOf(req)
    const data = createShootSchema.parse(req.body)
    await requireSyndicateAccess(prisma, data.syndicateId, userId, 'captain')

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

  // PATCH /api/shoots/:id - captain only
  router.patch('/:id', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')
    const data = updateShootSchema.parse(req.body)

    const shoot = await prisma.shootDay.update({ where: { id: req.params.id }, data })
    res.json(shoot)
  }))

  // POST /api/shoots/:id/complete - captain only
  router.post('/:id/complete', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')

    const shoot = await prisma.shootDay.update({ where: { id: req.params.id }, data: { status: 'COMPLETED' } })
    res.json(shoot)
  }))

  // POST /api/shoots/:id/cancel - captain only
  router.post('/:id/cancel', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')

    const shoot = await prisma.shootDay.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } })
    res.json(shoot)
  }))

  // POST /api/shoots/:id/attendance - set peg / attendance, captain only
  router.post('/:id/attendance', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')
    const { memberId, roleOnDay, pegNumber, confirmed } = attendanceSchema.parse(req.body)

    if ((await syndicateOfMember(prisma, memberId)) !== syndicateId) {
      throw new HttpError(400, 'Member is not in this syndicate')
    }

    const attendance = await prisma.shootAttendance.upsert({
      where: { shootId_memberId: { shootId: req.params.id, memberId } },
      update: { roleOnDay, pegNumber, confirmed },
      create: {
        shootId: req.params.id,
        memberId,
        roleOnDay: roleOnDay ?? 'GUN',
        pegNumber,
        confirmed: confirmed ?? false,
      },
    })
    res.json(attendance)
  }))

  // POST /api/shoots/:id/checkin - captain checks anyone in; a member checks themselves in
  router.post('/:id/checkin', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    const access = await requireSyndicateAccess(prisma, syndicateId, userId, 'member')
    const { memberId } = checkInSchema.parse(req.body)

    if (!access.isCaptain && access.memberId !== memberId) throw notFound()

    const attendance = await prisma.shootAttendance.update({
      where: { shootId_memberId: { shootId: req.params.id, memberId } },
      data: { attended: true, checkedInAt: new Date() },
    })
    res.json(attendance)
  }))

  // DELETE /api/shoots/:id - captain only, not once completed
  router.delete('/:id', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfShoot(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')

    const shoot = await prisma.shootDay.findUnique({ where: { id: req.params.id }, select: { status: true } })
    if (!shoot) throw notFound('Shoot not found')
    if (shoot.status === 'COMPLETED') throw new HttpError(400, 'Cannot delete completed shoots')

    await prisma.shootDay.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  }))

  return router
}
