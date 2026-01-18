import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const router = Router()

// Validation schemas
const createShootSchema = z.object({
  syndicateId: z.string().min(1),
  date: z.string().transform(s => new Date(s)),
  locationName: z.string().min(1).max(100),
  locationAddress: z.string().optional(),
  locationPostcode: z.string().optional(),
  locationWhat3Words: z.string().optional(),
  meetTime: z.string().optional(),
  drivesPlanned: z.number().int().min(1).optional(),
  expectedBag: z.number().int().min(0).optional(),
  captainNotes: z.string().optional(),
})

const updateShootSchema = createShootSchema.partial().omit({ syndicateId: true })

// GET /api/shoots - Get shoots for a syndicate
router.get('/', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { syndicateId, status, upcoming } = req.query

  if (!syndicateId || typeof syndicateId !== 'string') {
    return res.status(400).json({ error: 'syndicateId is required' })
  }

  try {
    const shoots = await prisma.shootDay.findMany({
      where: { 
        syndicateId,
        ...(status && typeof status === 'string' ? { status: status as any } : {}),
        ...(upcoming === 'true' ? { date: { gte: new Date() } } : {}),
      },
      orderBy: { date: 'asc' },
      include: {
        _count: {
          select: {
            attendances: true,
            guestGuns: true,
            beaterBookings: true,
          },
        },
      },
    })
    res.json(shoots)
  } catch (error) {
    console.error('Error fetching shoots:', error)
    res.status(500).json({ error: 'Failed to fetch shoots' })
  }
})

// GET /api/shoots/:id - Get single shoot with full details
router.get('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const shoot = await prisma.shootDay.findUnique({
      where: { id },
      include: {
        attendances: {
          include: { member: true },
          orderBy: { pegNumber: 'asc' },
        },
        guestGuns: {
          include: { invitedBy: true },
        },
        beaterBookings: {
          include: { beater: true },
        },
        bagRecords: {
          orderBy: { driveNumber: 'asc' },
        },
      },
    })

    if (!shoot) {
      return res.status(404).json({ error: 'Shoot not found' })
    }

    // Calculate bag totals
    const bagTotals = shoot.bagRecords.reduce(
      (acc: { pheasant: number; partridge: number; duck: number; woodcock: number; other: number }, bag: { pheasant: number; partridge: number; duck: number; woodcock: number; other: number }) => ({
        pheasant: acc.pheasant + bag.pheasant,
        partridge: acc.partridge + bag.partridge,
        duck: acc.duck + bag.duck,
        woodcock: acc.woodcock + bag.woodcock,
        other: acc.other + bag.other,
      }),
      { pheasant: 0, partridge: 0, duck: 0, woodcock: 0, other: 0 }
    )

    res.json({ ...shoot, bagTotals })
  } catch (error) {
    console.error('Error fetching shoot:', error)
    res.status(500).json({ error: 'Failed to fetch shoot' })
  }
})

// POST /api/shoots - Create new shoot day
router.post('/', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma

  try {
    const data = createShootSchema.parse(req.body)
    
    const shoot = await prisma.shootDay.create({
      data: {
        syndicateId: data.syndicateId,
        date: data.date,
        locationName: data.locationName,
        locationAddress: data.locationAddress,
        locationPostcode: data.locationPostcode,
        locationWhat3Words: data.locationWhat3Words,
        meetTime: data.meetTime ?? '08:30',
        drivesPlanned: data.drivesPlanned ?? 4,
        expectedBag: data.expectedBag,
        captainNotes: data.captainNotes,
      },
    })

    res.status(201).json(shoot)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors })
    }
    console.error('Error creating shoot:', error)
    res.status(500).json({ error: 'Failed to create shoot' })
  }
})

// PATCH /api/shoots/:id - Update shoot
router.patch('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const data = updateShootSchema.parse(req.body)
    
    const shoot = await prisma.shootDay.update({
      where: { id },
      data,
    })

    res.json(shoot)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors })
    }
    console.error('Error updating shoot:', error)
    res.status(500).json({ error: 'Failed to update shoot' })
  }
})

// POST /api/shoots/:id/complete - Mark shoot as completed
router.post('/:id/complete', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const shoot = await prisma.shootDay.update({
      where: { id },
      data: { status: 'COMPLETED' },
    })

    res.json(shoot)
  } catch (error) {
    console.error('Error completing shoot:', error)
    res.status(500).json({ error: 'Failed to complete shoot' })
  }
})

// POST /api/shoots/:id/cancel - Cancel shoot
router.post('/:id/cancel', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const shoot = await prisma.shootDay.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })

    res.json(shoot)
  } catch (error) {
    console.error('Error cancelling shoot:', error)
    res.status(500).json({ error: 'Failed to cancel shoot' })
  }
})

// POST /api/shoots/:id/attendance - Add/update attendance
router.post('/:id/attendance', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params
  const { memberId, roleOnDay, pegNumber, confirmed } = req.body

  try {
    const attendance = await prisma.shootAttendance.upsert({
      where: {
        shootId_memberId: { shootId: id, memberId },
      },
      update: {
        roleOnDay,
        pegNumber,
        confirmed,
      },
      create: {
        shootId: id,
        memberId,
        roleOnDay: roleOnDay ?? 'GUN',
        pegNumber,
        confirmed: confirmed ?? false,
      },
    })

    res.json(attendance)
  } catch (error) {
    console.error('Error updating attendance:', error)
    res.status(500).json({ error: 'Failed to update attendance' })
  }
})

// POST /api/shoots/:id/checkin - Check in attendee
router.post('/:id/checkin', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params
  const { memberId } = req.body

  try {
    const attendance = await prisma.shootAttendance.update({
      where: {
        shootId_memberId: { shootId: id, memberId },
      },
      data: {
        attended: true,
        checkedInAt: new Date(),
      },
    })

    res.json(attendance)
  } catch (error) {
    console.error('Error checking in:', error)
    res.status(500).json({ error: 'Failed to check in' })
  }
})

// DELETE /api/shoots/:id - Delete shoot (only if not completed)
router.delete('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const shoot = await prisma.shootDay.findUnique({ where: { id } })
    
    if (!shoot) {
      return res.status(404).json({ error: 'Shoot not found' })
    }

    if (shoot.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot delete completed shoots' })
    }

    await prisma.shootDay.delete({ where: { id } })

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting shoot:', error)
    res.status(500).json({ error: 'Failed to delete shoot' })
  }
})

export default router
