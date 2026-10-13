import { Router } from 'express'
import { z } from 'zod'
import type { Deps } from '../deps.js'
import {
  HttpError,
  handle,
  maskBankDetails,
  notFound,
  queryString,
  requireSyndicateAccess,
  syndicateOfBeater,
  syndicateOfShoot,
  userIdOf,
} from '../access.js'

const optionalText = (max: number) => z.string().trim().max(max).optional()

const createBeaterSchema = z.object({
  syndicateId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254).optional().or(z.literal('').transform(() => undefined)),
  phone: optionalText(30),
  dayRate: z.number().int().min(0).max(10_000).optional(),
  bankName: optionalText(100),
  bankSortCode: optionalText(20),
  bankAccountNumber: optionalText(20),
  notes: optionalText(2000),
})

const updateBeaterSchema = createBeaterSchema.omit({ syndicateId: true }).partial()

const bookSchema = z.object({
  shootId: z.string().min(1),
  dayRate: z.number().int().min(0).max(10_000).optional(),
})

const paySchema = z.object({
  paymentIds: z.array(z.string().min(1)).min(1).max(500),
  paymentReference: optionalText(100),
})

const payAllSchema = z.object({
  paymentReference: optionalText(100),
})

const statusFilter = z.enum(['ACTIVE', 'INACTIVE']).optional()

// Every beater route is captain only: beaters' contact and bank details are the captain's to manage.
export function beaterRoutes({ prisma }: Deps): Router {
  const router = Router()

  // GET /api/beaters?syndicateId= - bank details masked
  router.get('/', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = queryString(req.query.syndicateId)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')
    const status = statusFilter.parse(queryString(req.query.status))

    const beaters = await prisma.beater.findMany({
      where: { syndicateId, ...(status ? { status } : {}) },
      orderBy: { name: 'asc' },
    })
    res.json(beaters.map(maskBankDetails))
  }))

  // GET /api/beaters/payments/summary?syndicateId= - full bank details, needed to pay beaters
  router.get('/payments/summary', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = queryString(req.query.syndicateId)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')

    const beaters = await prisma.beater.findMany({
      where: { syndicateId, status: 'ACTIVE' },
      include: { payments: true, bookings: { where: { status: 'CONFIRMED' } } },
      orderBy: { name: 'asc' },
    })

    const summary = beaters.map((beater) => {
      const sum = (status?: 'PAID' | 'PENDING') =>
        beater.payments
          .filter((p) => (status ? p.status === status : true))
          .reduce((total, p) => total + p.amount, 0)

      return {
        id: beater.id,
        name: beater.name,
        email: beater.email,
        phone: beater.phone,
        bankName: beater.bankName,
        bankSortCode: beater.bankSortCode,
        bankAccountNumber: beater.bankAccountNumber,
        dayRate: beater.dayRate,
        daysWorked: beater.bookings.length,
        totalEarned: sum(),
        totalPaid: sum('PAID'),
        totalOutstanding: sum('PENDING'),
        payments: beater.payments.filter((p) => p.status === 'PENDING'),
      }
    })

    const totals = {
      totalOutstanding: summary.reduce((total, b) => total + b.totalOutstanding, 0),
      totalPaid: summary.reduce((total, b) => total + b.totalPaid, 0),
      totalEarned: summary.reduce((total, b) => total + b.totalEarned, 0),
    }

    res.set('Cache-Control', 'no-store')
    res.json({ beaters: summary, totals })
  }))

  // GET /api/beaters/:id - bank details masked
  router.get('/:id', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfBeater(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')

    const beater = await prisma.beater.findUnique({
      where: { id: req.params.id },
      include: {
        payments: { orderBy: { createdAt: 'desc' }, take: 20, include: { shootDay: true } },
        bookings: { orderBy: { shootDay: { date: 'desc' } }, take: 10, include: { shootDay: true } },
      },
    })
    if (!beater) throw notFound('Beater not found')

    const [owed, paid] = await Promise.all([
      prisma.beaterPayment.aggregate({ where: { beaterId: beater.id, status: 'PENDING' }, _sum: { amount: true } }),
      prisma.beaterPayment.aggregate({ where: { beaterId: beater.id, status: 'PAID' }, _sum: { amount: true } }),
    ])

    res.json({
      ...maskBankDetails(beater),
      totalOwed: owed._sum.amount || 0,
      totalPaid: paid._sum.amount || 0,
    })
  }))

  // POST /api/beaters
  router.post('/', handle(async (req, res) => {
    const userId = userIdOf(req)
    const data = createBeaterSchema.parse(req.body)
    await requireSyndicateAccess(prisma, data.syndicateId, userId, 'captain')

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
    res.status(201).json(maskBankDetails(beater))
  }))

  // PATCH /api/beaters/:id
  router.patch('/:id', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfBeater(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')
    const data = updateBeaterSchema.parse(req.body)

    const beater = await prisma.beater.update({ where: { id: req.params.id }, data })
    res.json(maskBankDetails(beater))
  }))

  // DELETE /api/beaters/:id - mark inactive
  router.delete('/:id', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfBeater(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')

    const beater = await prisma.beater.update({
      where: { id: req.params.id },
      data: { status: 'INACTIVE' },
    })
    res.json(maskBankDetails(beater))
  }))

  // POST /api/beaters/:id/book - book beater for one of the same syndicate's shoots
  router.post('/:id/book', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfBeater(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')
    const { shootId, dayRate } = bookSchema.parse(req.body)

    const shootSyndicateId = await syndicateOfShoot(prisma, shootId)
    if (shootSyndicateId !== syndicateId) throw new HttpError(400, 'Shoot is not in this syndicate')

    const beater = await prisma.beater.findUnique({ where: { id: req.params.id }, select: { dayRate: true } })
    const booking = await prisma.beaterBooking.create({
      data: {
        syndicateId,
        beaterId: req.params.id,
        shootId,
        dayRate: dayRate ?? beater?.dayRate ?? 40,
        status: 'INVITED',
      },
    })
    res.status(201).json(booking)
  }))

  // POST /api/beaters/:id/pay - mark chosen payments paid
  router.post('/:id/pay', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfBeater(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')
    const { paymentIds, paymentReference } = paySchema.parse(req.body)

    const updated = await prisma.beaterPayment.updateMany({
      where: { id: { in: paymentIds }, beaterId: req.params.id, syndicateId },
      data: { status: 'PAID', paidDate: new Date(), paymentReference },
    })
    res.json({ updated: updated.count })
  }))

  // POST /api/beaters/pay-all/:id - mark all outstanding payments paid
  router.post('/pay-all/:id', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfBeater(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')
    const { paymentReference } = payAllSchema.parse(req.body ?? {})

    const updated = await prisma.beaterPayment.updateMany({
      where: { beaterId: req.params.id, syndicateId, status: 'PENDING' },
      data: { status: 'PAID', paidDate: new Date(), paymentReference },
    })
    res.json({ updated: updated.count })
  }))

  return router
}
