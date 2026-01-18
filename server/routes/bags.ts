import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const router = Router()

// Validation schema
const createBagSchema = z.object({
  shootId: z.string().min(1),
  driveNumber: z.number().int().min(1),
  pheasant: z.number().int().min(0).optional(),
  partridge: z.number().int().min(0).optional(),
  duck: z.number().int().min(0).optional(),
  woodcock: z.number().int().min(0).optional(),
  other: z.number().int().min(0).optional(),
  otherDescription: z.string().optional(),
  recordedByMemberId: z.string().min(1),
  notes: z.string().optional(),
})

const updateBagSchema = createBagSchema.partial().omit({ shootId: true, recordedByMemberId: true })

// GET /api/bags - Get bag records for a shoot
router.get('/', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { shootId } = req.query

  if (!shootId || typeof shootId !== 'string') {
    return res.status(400).json({ error: 'shootId is required' })
  }

  try {
    const bags = await prisma.bagRecord.findMany({
      where: { shootId },
      orderBy: { driveNumber: 'asc' },
      include: {
        recordedBy: {
          select: { id: true, name: true },
        },
      },
    })
    res.json(bags)
  } catch (error) {
    console.error('Error fetching bags:', error)
    res.status(500).json({ error: 'Failed to fetch bag records' })
  }
})

// GET /api/bags/season - Get season totals for a syndicate
router.get('/season', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { syndicateId } = req.query

  if (!syndicateId || typeof syndicateId !== 'string') {
    return res.status(400).json({ error: 'syndicateId is required' })
  }

  try {
    const totals = await prisma.bagRecord.aggregate({
      where: {
        shootDay: { syndicateId },
      },
      _sum: {
        pheasant: true,
        partridge: true,
        duck: true,
        woodcock: true,
        other: true,
      },
    })

    const shootCount = await prisma.shootDay.count({
      where: {
        syndicateId,
        status: 'COMPLETED',
      },
    })

    res.json({
      pheasant: totals._sum.pheasant || 0,
      partridge: totals._sum.partridge || 0,
      duck: totals._sum.duck || 0,
      woodcock: totals._sum.woodcock || 0,
      other: totals._sum.other || 0,
      total: (totals._sum.pheasant || 0) + 
             (totals._sum.partridge || 0) + 
             (totals._sum.duck || 0) + 
             (totals._sum.woodcock || 0) + 
             (totals._sum.other || 0),
      shootsCompleted: shootCount,
    })
  } catch (error) {
    console.error('Error fetching season totals:', error)
    res.status(500).json({ error: 'Failed to fetch season totals' })
  }
})

// GET /api/bags/:id - Get single bag record
router.get('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const bag = await prisma.bagRecord.findUnique({
      where: { id },
      include: {
        shootDay: true,
        recordedBy: {
          select: { id: true, name: true },
        },
      },
    })

    if (!bag) {
      return res.status(404).json({ error: 'Bag record not found' })
    }

    res.json(bag)
  } catch (error) {
    console.error('Error fetching bag:', error)
    res.status(500).json({ error: 'Failed to fetch bag record' })
  }
})

// POST /api/bags - Create new bag record
router.post('/', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma

  try {
    const data = createBagSchema.parse(req.body)
    
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
        recordedByMemberId: data.recordedByMemberId,
        notes: data.notes,
      },
    })

    res.status(201).json(bag)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors })
    }
    console.error('Error creating bag:', error)
    res.status(500).json({ error: 'Failed to create bag record' })
  }
})

// PATCH /api/bags/:id - Update bag record
router.patch('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const data = updateBagSchema.parse(req.body)
    
    const bag = await prisma.bagRecord.update({
      where: { id },
      data,
    })

    res.json(bag)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors })
    }
    console.error('Error updating bag:', error)
    res.status(500).json({ error: 'Failed to update bag record' })
  }
})

// DELETE /api/bags/:id - Delete bag record
router.delete('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    await prisma.bagRecord.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting bag:', error)
    res.status(500).json({ error: 'Failed to delete bag record' })
  }
})

export default router
