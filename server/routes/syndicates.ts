import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const router = Router()

// Validation schema
const createSyndicateSchema = z.object({
  name: z.string().min(1).max(100),
  captainClerkId: z.string().min(1),
  seasonStart: z.string().transform(s => new Date(s)),
  seasonEnd: z.string().transform(s => new Date(s)),
  subscriptionAmount: z.number().int().min(0).optional(),
  subscriptionType: z.enum(['ANNUAL', 'PER_SHOOT', 'HYBRID']).optional(),
  defaultBeaterRate: z.number().int().min(0).optional(),
  pegRotationRule: z.enum(['FAIR_ROTATION', 'RANDOM', 'MANUAL']).optional(),
})

const updateSyndicateSchema = createSyndicateSchema.partial()

// GET /api/syndicates - Get syndicates for a captain
router.get('/', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { captainClerkId } = req.query

  if (!captainClerkId || typeof captainClerkId !== 'string') {
    return res.status(400).json({ error: 'captainClerkId is required' })
  }

  try {
    const syndicates = await prisma.syndicate.findMany({
      where: { captainClerkId },
      orderBy: { createdAt: 'desc' },
    })
    res.json(syndicates)
  } catch (error) {
    console.error('Error fetching syndicates:', error)
    res.status(500).json({ error: 'Failed to fetch syndicates' })
  }
})

// GET /api/syndicates/:id - Get single syndicate
router.get('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const syndicate = await prisma.syndicate.findUnique({
      where: { id },
      include: {
        members: { where: { status: 'ACTIVE' } },
        beaters: { where: { status: 'ACTIVE' } },
        shootDays: { 
          where: { status: 'SCHEDULED' },
          orderBy: { date: 'asc' },
          take: 5
        },
      },
    })

    if (!syndicate) {
      return res.status(404).json({ error: 'Syndicate not found' })
    }

    res.json(syndicate)
  } catch (error) {
    console.error('Error fetching syndicate:', error)
    res.status(500).json({ error: 'Failed to fetch syndicate' })
  }
})

// POST /api/syndicates - Create new syndicate
router.post('/', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma

  try {
    const data = createSyndicateSchema.parse(req.body)
    
    const syndicate = await prisma.syndicate.create({
      data: {
        name: data.name,
        captainClerkId: data.captainClerkId,
        seasonStart: data.seasonStart,
        seasonEnd: data.seasonEnd,
        subscriptionAmount: data.subscriptionAmount ?? 0,
        subscriptionType: data.subscriptionType ?? 'ANNUAL',
        defaultBeaterRate: data.defaultBeaterRate ?? 40,
        pegRotationRule: data.pegRotationRule ?? 'FAIR_ROTATION',
      },
    })

    res.status(201).json(syndicate)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors })
    }
    console.error('Error creating syndicate:', error)
    res.status(500).json({ error: 'Failed to create syndicate' })
  }
})

// PATCH /api/syndicates/:id - Update syndicate
router.patch('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const data = updateSyndicateSchema.parse(req.body)
    
    const syndicate = await prisma.syndicate.update({
      where: { id },
      data,
    })

    res.json(syndicate)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors })
    }
    console.error('Error updating syndicate:', error)
    res.status(500).json({ error: 'Failed to update syndicate' })
  }
})

// DELETE /api/syndicates/:id - Archive syndicate
router.delete('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const syndicate = await prisma.syndicate.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    })

    res.json(syndicate)
  } catch (error) {
    console.error('Error archiving syndicate:', error)
    res.status(500).json({ error: 'Failed to archive syndicate' })
  }
})

export default router
