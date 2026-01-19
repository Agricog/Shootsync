import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const router = Router()

// Validation schemas
const createBeaterSchema = z.object({
  syndicateId: z.string().min(1),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  dayRate: z.number().int().min(0).optional(),
  bankName: z.string().optional(),
  bankSortCode: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  notes: z.string().optional(),
})

const updateBeaterSchema = createBeaterSchema.partial().omit({ syndicateId: true })

// GET /api/beaters - Get beaters for a syndicate
router.get('/', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { syndicateId, status } = req.query

  if (!syndicateId || typeof syndicateId !== 'string') {
    return res.status(400).json({ error: 'syndicateId is required' })
  }

  try {
    const beaters = await prisma.beater.findMany({
      where: { 
        syndicateId,
        ...(status && typeof status === 'string' ? { status: status as any } : {}),
      },
      orderBy: { name: 'asc' },
    })
    res.json(beaters)
  } catch (error) {
    console.error('Error fetching beaters:', error)
    res.status(500).json({ error: 'Failed to fetch beaters' })
  }
})

// GET /api/beaters/payments/summary - Get payment summary for all beaters
router.get('/payments/summary', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { syndicateId } = req.query

  if (!syndicateId || typeof syndicateId !== 'string') {
    return res.status(400).json({ error: 'syndicateId is required' })
  }

  try {
    const beaters = await prisma.beater.findMany({
      where: { syndicateId, status: 'ACTIVE' },
      include: {
        payments: true,
        bookings: {
          where: { status: 'CONFIRMED' },
        },
      },
      orderBy: { name: 'asc' },
    })

    const summary = beaters.map(beater => {
      const totalEarned = beater.payments.reduce((sum, p) => sum + p.amount, 0)
      const totalPaid = beater.payments
        .filter(p => p.status === 'PAID')
        .reduce((sum, p) => sum + p.amount, 0)
      const totalOutstanding = beater.payments
        .filter(p => p.status === 'PENDING')
        .reduce((sum, p) => sum + p.amount, 0)
      const daysWorked = beater.bookings.length

      return {
        id: beater.id,
        name: beater.name,
        email: beater.email,
        phone: beater.phone,
        bankName: beater.bankName,
        bankSortCode: beater.bankSortCode,
        bankAccountNumber: beater.bankAccountNumber,
        dayRate: beater.dayRate,
        daysWorked,
        totalEarned,
        totalPaid,
        totalOutstanding,
        payments: beater.payments.filter(p => p.status === 'PENDING'),
      }
    })

    const totals = {
      totalOutstanding: summary.reduce((sum, b) => sum + b.totalOutstanding, 0),
      totalPaid: summary.reduce((sum, b) => sum + b.totalPaid, 0),
      totalEarned: summary.reduce((sum, b) => sum + b.totalEarned, 0),
    }

    res.json({ beaters: summary, totals })
  } catch (error) {
    console.error('Error fetching payment summary:', error)
    res.status(500).json({ error: 'Failed to fetch payment summary' })
  }
})

// GET /api/beaters/:id - Get single beater with payment history
router.get('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const beater = await prisma.beater.findUnique({
      where: { id },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { shootDay: true },
        },
        bookings: {
          orderBy: { shootDay: { date: 'desc' } },
          take: 10,
          include: { shootDay: true },
        },
      },
    })

    if (!beater) {
      return res.status(404).json({ error: 'Beater not found' })
    }

    const totalOwed = await prisma.beaterPayment.aggregate({
      where: { beaterId: id, status: 'PENDING' },
      _sum: { amount: true },
    })

    const totalPaid = await prisma.beaterPayment.aggregate({
      where: { beaterId: id, status: 'PAID' },
      _sum: { amount: true },
    })

    res.json({
      ...beater,
      totalOwed: totalOwed._sum.amount || 0,
      totalPaid: totalPaid._sum.amount || 0,
    })
  } catch (error) {
    console.error('Error fetching beater:', error)
    res.status(500).json({ error: 'Failed to fetch beater' })
  }
})

// POST /api/beaters - Create new beater
router.post('/', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma

  try {
    const data = createBeaterSchema.parse(req.body)
    
    const beater = await prisma.beater.create({
      data: {
        syndicateId: data.syndicateId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        dayRate: data.dayRate ?? 40,
        bankName: data.bankName,
        bankSortCode: data.bankSortCode,
        bankAccountNumber: data.bankAccountNumber,
        notes: data.notes,
      },
    })

    res.status(201).json(beater)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors })
    }
    console.error('Error creating beater:', error)
    res.status(500).json({ error: 'Failed to create beater' })
  }
})

// PATCH /api/beaters/:id - Update beater
router.patch('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const data = updateBeaterSchema.parse(req.body)
    
    const beater = await prisma.beater.update({
      where: { id },
      data,
    })

    res.json(beater)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors })
    }
    console.error('Error updating beater:', error)
    res.status(500).json({ error: 'Failed to update beater' })
  }
})

// DELETE /api/beaters/:id - Deactivate beater
router.delete('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params

  try {
    const beater = await prisma.beater.update({
      where: { id },
      data: { status: 'INACTIVE' },
    })

    res.json(beater)
  } catch (error) {
    console.error('Error deactivating beater:', error)
    res.status(500).json({ error: 'Failed to deactivate beater' })
  }
})

// POST /api/beaters/:id/book - Book beater for a shoot
router.post('/:id/book', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params
  const { shootId, dayRate } = req.body

  try {
    const beater = await prisma.beater.findUnique({ where: { id } })
    if (!beater) {
      return res.status(404).json({ error: 'Beater not found' })
    }

    const booking = await prisma.beaterBooking.create({
      data: {
        syndicateId: beater.syndicateId,
        beaterId: id,
        shootId,
        dayRate: dayRate ?? beater.dayRate,
        status: 'INVITED',
      },
    })

    res.status(201).json(booking)
  } catch (error) {
    console.error('Error booking beater:', error)
    res.status(500).json({ error: 'Failed to book beater' })
  }
})

// POST /api/beaters/:id/pay - Record payment to beater
router.post('/:id/pay', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params
  const { paymentIds, paymentReference } = req.body

  try {
    const updated = await prisma.beaterPayment.updateMany({
      where: { 
        id: { in: paymentIds },
        beaterId: id,
      },
      data: {
        status: 'PAID',
        paidDate: new Date(),
        paymentReference,
      },
    })

    res.json({ updated: updated.count })
  } catch (error) {
    console.error('Error recording payment:', error)
    res.status(500).json({ error: 'Failed to record payment' })
  }
})

// POST /api/beaters/pay-all - Mark all outstanding payments as paid for a beater
router.post('/pay-all/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { id } = req.params
  const { paymentReference } = req.body

  try {
    const updated = await prisma.beaterPayment.updateMany({
      where: { 
        beaterId: id,
        status: 'PENDING',
      },
      data: {
        status: 'PAID',
        paidDate: new Date(),
        paymentReference,
      },
    })

    res.json({ updated: updated.count })
  } catch (error) {
    console.error('Error recording payments:', error)
    res.status(500).json({ error: 'Failed to record payments' })
  }
})

export default router
