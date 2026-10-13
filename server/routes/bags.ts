import { Router } from 'express'
import { z } from 'zod'
import type { Deps } from '../deps.js'
import {
  handle,
  notFound,
  queryString,
  requireSyndicateAccess,
  syndicateOfBag,
  syndicateOfShoot,
  userIdOf,
} from '../access.js'

const count = z.number().int().min(0).max(100_000).optional()

const createBagSchema = z.object({
  shootId: z.string().min(1),
  driveNumber: z.number().int().min(1).max(50),
  pheasant: count,
  partridge: count,
  duck: count,
  woodcock: count,
  other: count,
  otherDescription: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
})

const updateBagSchema = createBagSchema.omit({ shootId: true }).partial()

// Per the role matrix, captain and guns may record and view bags.
export function bagRoutes({ prisma }: Deps): Router {
  const router = Router()

  // GET /api/bags?shootId=
  router.get('/', handle(async (req, res) => {
    const userId = userIdOf(req)
    const shootId = queryString(req.query.shootId)
    const syndicateId = await syndicateOfShoot(prisma, shootId)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'member')

    const bags = await prisma.bagRecord.findMany({
      where: { shootId },
      orderBy: { driveNumber: 'asc' },
    })
    res.json(bags)
  }))

  // GET /api/bags/season?syndicateId=
  router.get('/season', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = queryString(req.query.syndicateId)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'member')

    const [totals, shootsCompleted] = await Promise.all([
      prisma.bagRecord.aggregate({
        where: { shootDay: { syndicateId } },
        _sum: { pheasant: true, partridge: true, duck: true, woodcock: true, other: true },
      }),
      prisma.shootDay.count({ where: { syndicateId, status: 'COMPLETED' } }),
    ])

    const pheasant = totals._sum.pheasant || 0
    const partridge = totals._sum.partridge || 0
    const duck = totals._sum.duck || 0
    const woodcock = totals._sum.woodcock || 0
    const other = totals._sum.other || 0

    res.json({
      pheasant,
      partridge,
      duck,
      woodcock,
      other,
      total: pheasant + partridge + duck + woodcock + other,
      shootsCompleted,
    })
  }))

  // GET /api/bags/:id
  router.get('/:id', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfBag(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'member')

    const bag = await prisma.bagRecord.findUnique({
      where: { id: req.params.id },
      include: { shootDay: true },
    })
    if (!bag) throw notFound('Bag record not found')
    res.json(bag)
  }))

  // POST /api/bags
  router.post('/', handle(async (req, res) => {
    const userId = userIdOf(req)
    const data = createBagSchema.parse(req.body)
    const syndicateId = await syndicateOfShoot(prisma, data.shootId)
    const access = await requireSyndicateAccess(prisma, syndicateId, userId, 'member')

    const bag = await prisma.bagRecord.create({
      data: {
        shootId: data.shootId,
        driveNumber: data.driveNumber,
        pheasant: data.pheasant ?? 0,
        partridge: data.partridge ?? 0,
        duck: data.duck ?? 0,
        woodcock: data.woodcock ?? 0,
        other: data.other ?? 0,
        otherDescription: data.otherDescription,
        notes: data.notes,
        recordedByMemberId: access.memberId,
      },
    })
    res.status(201).json(bag)
  }))

  // PATCH /api/bags/:id
  router.patch('/:id', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfBag(prisma, req.params.id)
    const access = await requireSyndicateAccess(prisma, syndicateId, userId, 'member')
    const data = updateBagSchema.parse(req.body)

    // The captain can correct any bag; a gun only the ones they recorded.
    if (!access.isCaptain) {
      const bag = await prisma.bagRecord.findUnique({ where: { id: req.params.id }, select: { recordedByMemberId: true } })
      if (!bag || bag.recordedByMemberId !== access.memberId) throw notFound()
    }

    const bag = await prisma.bagRecord.update({ where: { id: req.params.id }, data })
    res.json(bag)
  }))

  // DELETE /api/bags/:id - captain only
  router.delete('/:id', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfBag(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')

    await prisma.bagRecord.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  }))

  return router
}
