import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import crypto from 'crypto'

const router = Router()

// Validation schemas
const createGuestSchema = z.object({
  shootId: z.string().min(1),
  invitedByMemberId: z.string().min(1),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  dayFee: z.number().min(0).default(50),
})

const updateGuestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  pegNumber: z.number().int().min(1).optional(),
  dayFee: z.number().min(0).optional(),
  notes: z.string().optional(),
})

const acceptGuestSchema = z.object({
  emergencyContactName: z.string().min(1),
  emergencyContactPhone: z.string().min(1),
  waiverAccepted: z.boolean().refine(val => val === true, {
    message: 'Waiver must be accepted',
  }),
})

// GET /api/guests - Get guests for a shoot
router.get('/', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { shootId, syndicateId } = req.query

  try {
    if (shootId && typeof shootId === 'string') {
      const guests = await prisma.guestGun.findMany({
        where: { shootId },
        orderBy: { createdAt: 'desc' },
      })
      return res.json(guests)
    }

    if (syndicateId && typeof syndicateId === 'string') {
      const guests = await prisma.guestGun.findMany({
        where: {
          shootDay: { syndicateId },
        },
        orderBy: { createdAt: 'desc' },
      })
      return res.json(guests)
    }

    return res.status(400).json({ error: 'shootId or syndicateId is required' })
  } catch (error) {
    console.error('Error fetching guests:', error)
    res.status(500).json({ error: 'Failed to fetch guests' })
  }
})

// GET /api/guests/:id - Get single guest
router.get('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const guest = await prisma.guestGun.findUnique({
      where: { id },
    })

    if (!guest) {
      return res.status(404).json({ error: 'Guest not found' })
    }

    // Get related data separately
    const shootDay = await prisma.shootDay.findUnique({
      where: { id: guest.shootId },
      include: { syndicate: { select: { name: true } } },
    })

    res.json({ ...guest, shootDay })
  } catch (error) {
    console.error('Error fetching guest:', error)
    res.status(500).json({ error: 'Failed to fetch guest' })
  }
})

// GET /api/guests/token/:token - Get guest by invite token (public)
router.get('/token/:token', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { token } = req.params

  try {
    const guest = await prisma.guestGun.findFirst({
      where: { inviteToken: token },
    })

    if (!guest) {
      return res.status(404).json({ error: 'Invalid or expired invite' })
    }

    // Get related data separately
    const shootDay = await prisma.shootDay.findUnique({
      where: { id: guest.shootId },
      include: { syndicate: { select: { name: true } } },
    })

    const invitedBy = await prisma.member.findUnique({
      where: { id: guest.invitedByMemberId },
      select: { name: true },
    })

    res.json({ ...guest, shootDay, invitedBy })
  } catch (error) {
    console.error('Error fetching guest by token:', error)
    res.status(500).json({ error: 'Failed to fetch guest' })
  }
})

// POST /api/guests - Create guest invite
router.post('/', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma

  try {
    const data = createGuestSchema.parse(req.body)
    
    // Generate unique invite token
    const inviteToken = crypto.randomBytes(32).toString('hex')
    
    const guest = await prisma.guestGun.create({
      data: {
        shootId: data.shootId,
        invitedByMemberId: data.invitedByMemberId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        dayFee: data.dayFee,
        inviteToken,
        rsvpStatus: 'PENDING',
        paymentStatus: 'PENDING',
        waiverAccepted: false,
      },
    })

    res.status(201).json(guest)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors })
    }
    console.error('Error creating guest:', error)
    res.status(500).json({ error: 'Failed to create guest' })
  }
})

// POST /api/guests/:id/accept - Guest accepts invite (RSVP + waiver)
router.post('/:id/accept', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const data = acceptGuestSchema.parse(req.body)
    
    const guest = await prisma.guestGun.update({
      where: { id },
      data: {
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        waiverAccepted: true,
        waiverAcceptedAt: new Date(),
        rsvpStatus: 'CONFIRMED',
      },
    })

    res.json(guest)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors })
    }
    console.error('Error accepting invite:', error)
    res.status(500).json({ error: 'Failed to accept invite' })
  }
})

// POST /api/guests/:id/decline - Guest declines invite
router.post('/:id/decline', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const guest = await prisma.guestGun.update({
      where: { id },
      data: {
        rsvpStatus: 'DECLINED',
      },
    })

    res.json(guest)
  } catch (error) {
    console.error('Error declining invite:', error)
    res.status(500).json({ error: 'Failed to decline invite' })
  }
})

// PATCH /api/guests/:id - Update guest
router.patch('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const data = updateGuestSchema.parse(req.body)
    
    const guest = await prisma.guestGun.update({
      where: { id },
      data,
    })

    res.json(guest)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors })
    }
    console.error('Error updating guest:', error)
    res.status(500).json({ error: 'Failed to update guest' })
  }
})

// DELETE /api/guests/:id - Remove guest
router.delete('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    await prisma.guestGun.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting guest:', error)
    res.status(500).json({ error: 'Failed to delete guest' })
  }
})

export default router
