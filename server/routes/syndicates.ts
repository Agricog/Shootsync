import { Router } from 'express'
import { z } from 'zod'
import type { Deps } from '../deps.js'
import { handle, notFound, requireSyndicateAccess, syndicateSelect, userIdOf, withoutCaptainOnlyFields } from '../access.js'

const dateString = z.string().min(1).refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date')

// The captain is always the signed-in user. A captainClerkId sent by the browser is ignored.
const createSyndicateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  seasonStart: dateString.transform((s) => new Date(s)),
  seasonEnd: dateString.transform((s) => new Date(s)),
  subscriptionAmount: z.number().int().min(0).max(1_000_000).optional(),
  subscriptionType: z.enum(['ANNUAL', 'PER_SHOOT', 'HYBRID']).optional(),
  defaultBeaterRate: z.number().int().min(0).max(10_000).optional(),
  pegRotationRule: z.enum(['FAIR_ROTATION', 'RANDOM', 'MANUAL']).optional(),
})

const updateSyndicateSchema = createSyndicateSchema.partial()

export function syndicateRoutes({ prisma }: Deps): Router {
  const router = Router()

  // GET /api/syndicates - syndicates the signed-in user captains
  router.get('/', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicates = await prisma.syndicate.findMany({
      where: { captainClerkId: userId },
      select: syndicateSelect,
      orderBy: { createdAt: 'desc' },
    })
    res.json(syndicates)
  }))

  // GET /api/syndicates/:id
  router.get('/:id', handle(async (req, res) => {
    const userId = userIdOf(req)
    const access = await requireSyndicateAccess(prisma, req.params.id, userId, 'member')

    const syndicate = await prisma.syndicate.findUnique({
      where: { id: req.params.id },
      select: {
        ...syndicateSelect,
        members: {
          where: { status: 'ACTIVE' },
          select: { id: true, name: true, role: true, status: true },
        },
        beaters: {
          where: { status: 'ACTIVE' },
          select: { id: true, name: true, dayRate: true, status: true },
        },
        shootDays: {
          where: { status: 'SCHEDULED' },
          orderBy: { date: 'asc' },
          take: 5,
        },
      },
    })
    if (!syndicate) throw notFound()

    if (access.isCaptain) return res.json(syndicate)

    // A gun sees the fixtures, not the captain's notes, beater list or captain's account ID.
    const { beaters: _beaters, captainClerkId: _captain, shootDays, ...rest } = syndicate
    res.json({ ...rest, shootDays: shootDays.map(withoutCaptainOnlyFields) })
  }))

  // POST /api/syndicates - the signed-in user becomes captain
  router.post('/', handle(async (req, res) => {
    const userId = userIdOf(req)
    const data = createSyndicateSchema.parse(req.body)
    if (data.seasonEnd < data.seasonStart) {
      return res.status(400).json({ error: 'Season end must be after season start' })
    }

    const syndicate = await prisma.syndicate.create({
      data: {
        name: data.name,
        captainClerkId: userId,
        seasonStart: data.seasonStart,
        seasonEnd: data.seasonEnd,
        subscriptionAmount: data.subscriptionAmount ?? 0,
        subscriptionType: data.subscriptionType ?? 'ANNUAL',
        defaultBeaterRate: data.defaultBeaterRate ?? 40,
        pegRotationRule: data.pegRotationRule ?? 'FAIR_ROTATION',
      },
      select: syndicateSelect,
    })
    res.status(201).json(syndicate)
  }))

  // PATCH /api/syndicates/:id - captain only
  router.patch('/:id', handle(async (req, res) => {
    const userId = userIdOf(req)
    await requireSyndicateAccess(prisma, req.params.id, userId, 'captain')
    const data = updateSyndicateSchema.parse(req.body)

    const syndicate = await prisma.syndicate.update({
      where: { id: req.params.id },
      data,
      select: syndicateSelect,
    })
    res.json(syndicate)
  }))

  // DELETE /api/syndicates/:id - archive, captain only
  router.delete('/:id', handle(async (req, res) => {
    const userId = userIdOf(req)
    await requireSyndicateAccess(prisma, req.params.id, userId, 'captain')

    const syndicate = await prisma.syndicate.update({
      where: { id: req.params.id },
      data: { status: 'ARCHIVED' },
      select: syndicateSelect,
    })
    res.json(syndicate)
  }))

  return router
}
