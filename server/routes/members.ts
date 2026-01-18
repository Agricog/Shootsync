import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const router = Router()

// Validation schemas
const createMemberSchema = z.object({
  syndicateId: z.string().min(1),
  clerkUserId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  phone: z.string().optional(),
  role: z.enum(['CAPTAIN', 'GUN', 'BEATER', 'HYBRID']).optional(),
  bascNumber: z.string().optional(),
  insuranceExpiry: z.string().transform(s => new Date(s)).optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
})

const updateMemberSchema = createMemberSchema.partial().omit({ syndicateId: true })

// GET /api/members - Get members for a syndicate
router.get('/', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { syndicateId, status } = req.query

  if (!syndicateId || typeof syndicateId !== 'string') {
    return res.status(400).json({ error: 'syndicateId is required' })
  }

  try {
    const members = await prisma.member.findMany({
      where: { 
        syndicateId,
        ...(status && typeof status === 'string' ? { status: status as any } : {}),
      },
      orderBy: { name: 'asc' },
    })
    res.json(members)
  } catch (error) {
    console.error('Error fetching members:', error)
    res.status(500).json({ error: 'Failed to fetch members' })
  }
})

// GET /api/members/:id - Get single member
router.get('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        shootAttendances: {
          include: { shootDay: true },
          orderBy: { shootDay: { date: 'desc' } },
          take: 10,
        },
        memberPayments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!member) {
      return res.status(404).json({ error: 'Member not found' })
    }

    res.json(member)
  } catch (error) {
    console.error('Error fetching member:', error)
    res.status(500).json({ error: 'Failed to fetch member' })
  }
})

// GET /api/members/by-clerk/:clerkUserId - Get member by Clerk ID
router.get('/by-clerk/:clerkUserId', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { clerkUserId } = req.params
  const { syndicateId } = req.query

  try {
    const member = await prisma.member.findFirst({
      where: { 
        clerkUserId,
        ...(syndicateId && typeof syndicateId === 'string' ? { syndicateId } : {}),
      },
      include: {
        syndicate: true,
      },
    })

    if (!member) {
      return res.status(404).json({ error: 'Member not found' })
    }

    res.json(member)
  } catch (error) {
    console.error('Error fetching member:', error)
    res.status(500).json({ error: 'Failed to fetch member' })
  }
})

// POST /api/members - Create new member (invite)
router.post('/', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma

  try {
    const data = createMemberSchema.parse(req.body)
    
    const member = await prisma.member.create({
      data: {
        syndicateId: data.syndicateId,
        clerkUserId: data.clerkUserId,
        email: data.email,
        name: data.name,
        phone: data.phone,
        role: data.role ?? 'GUN',
        bascNumber: data.bascNumber,
        insuranceExpiry: data.insuranceExpiry,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        invitedAt: new Date(),
        status: 'PENDING',
      },
    })

    res.status(201).json(member)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors })
    }
    console.error('Error creating member:', error)
    res.status(500).json({ error: 'Failed to create member' })
  }
})

// PATCH /api/members/:id - Update member
router.patch('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const data = updateMemberSchema.parse(req.body)
    
    const member = await prisma.member.update({
      where: { id },
      data,
    })

    res.json(member)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors })
    }
    console.error('Error updating member:', error)
    res.status(500).json({ error: 'Failed to update member' })
  }
})

// POST /api/members/:id/accept - Accept invitation
router.post('/:id/accept', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const member = await prisma.member.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        acceptedAt: new Date(),
      },
    })

    res.json(member)
  } catch (error) {
    console.error('Error accepting invitation:', error)
    res.status(500).json({ error: 'Failed to accept invitation' })
  }
})

// DELETE /api/members/:id - Remove member
router.delete('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const member = await prisma.member.update({
      where: { id },
      data: { status: 'INACTIVE' },
    })

    res.json(member)
  } catch (error) {
    console.error('Error removing member:', error)
    res.status(500).json({ error: 'Failed to remove member' })
  }
})

export default router
