import { Router } from 'express'
import { z } from 'zod'
import type { Deps } from '../deps.js'
import { assertRoomFor, lockSyndicate } from '../planLimits.js'
import {
  HttpError,
  handle,
  maskBankDetails,
  notFound,
  queryString,
  requireSyndicateAccess,
  syndicateOfBeater,
} from '../access.js'
import { HMRC_CASUAL_DAY_LIMIT, lockShoots, normaliseAccountNumber, normaliseSortCode, poundsToPence, taxYearOf } from '../beaterPay.js'

const optionalText = (max: number) => z.string().trim().max(max).optional()

const createBeaterSchema = z.object({
  syndicateId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254).optional().or(z.literal('').transform(() => undefined)),
  phone: optionalText(30),
  dayRate: z.number().int().min(0).max(1000).optional(),
  bankName: optionalText(100),
  bankSortCode: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined
      const sortCode = normaliseSortCode(v)
      if (!sortCode) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Sort code must be 6 digits, like 12-34-56' })
      return sortCode ?? undefined
    }),
  bankAccountNumber: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined
      const account = normaliseAccountNumber(v)
      if (!account) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Account number must be 8 digits' })
      return account ?? undefined
    }),
  notes: optionalText(2000),
})

const bothOrNeither = {
  message: 'Enter both the sort code and the account number',
  path: ['bankAccountNumber'],
}

const createBeaterInput = createBeaterSchema.refine((d) => Boolean(d.bankSortCode) === Boolean(d.bankAccountNumber), bothOrNeither)

// Editing: a blank or null text field clears it; bank numbers are replaced only when new
// ones are sent (they are never sent to the browser to be edited), or removed with clearBankDetails.
const clearable = (max: number) =>
  z.string().trim().max(max).nullable().optional().transform((v) => (v === '' ? null : v))

const updateBeaterSchema = createBeaterSchema
  .omit({ syndicateId: true, email: true, phone: true, bankName: true, notes: true })
  .partial()
  .extend({
    email: z
      .string()
      .trim()
      .max(254)
      .nullable()
      .optional()
      .transform((v) => (v === '' ? null : v))
      .refine((v) => v == null || z.string().email().safeParse(v).success, 'That email address doesn’t look right'),
    phone: clearable(30),
    bankName: clearable(100),
    notes: clearable(2000),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    clearBankDetails: z.literal(true).optional(),
  })
  // A new sort code with the old account number (or the reverse) would pay the wrong account.
  .refine((d) => Boolean(d.bankSortCode) === Boolean(d.bankAccountNumber), bothOrNeither)

const paySchema = z.object({
  payments: z
    .array(z.object({ paymentId: z.string().min(1).max(64), amount: z.number().int().min(0) }))
    .min(1)
    .max(500)
    .refine((list) => new Set(list.map((p) => p.paymentId)).size === list.length, 'A payment is listed twice'),
  paymentReference: optionalText(100),
})

const statusFilter = z.enum(['ACTIVE', 'INACTIVE']).optional()

// Every beater route is captain only: beaters' contact and bank details are the captain's to manage.
export function beaterRoutes({ prisma }: Deps): Router {
  const router = Router()

  // GET /api/beaters?syndicateId= - bank details masked
  router.get('/', handle(async (req, res) => {
    const syndicateId = queryString(req.query.syndicateId)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')
    const status = statusFilter.parse(queryString(req.query.status))

    const beaters = await prisma.beater.findMany({
      where: { syndicateId, ...(status ? { status } : {}) },
      orderBy: { name: 'asc' },
    })
    res.json(beaters.map(maskBankDetails))
  }))

  // GET /api/beaters/payments/summary?syndicateId= - full bank details, needed to pay beaters.
  // Money is in pence. A day counts once the shoot is completed and the beater was confirmed
  // (server/beaterPay.ts). Inactive beaters still appear while they are owed money.
  router.get('/payments/summary', handle(async (req, res) => {
    const syndicateId = queryString(req.query.syndicateId)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')
    const taxYear = taxYearOf(new Date())

    const beaters = await prisma.beater.findMany({
      where: { syndicateId, OR: [{ status: 'ACTIVE' }, { payments: { some: { status: 'PENDING' } } }] },
      include: {
        payments: {
          include: { shootDay: { select: { date: true, locationName: true } } },
          orderBy: { shootDay: { date: 'asc' } },
        },
        // Days still to come this tax year that the beater has confirmed for: HMRC's test is
        // whether a casual is expected to go over the limit, not only whether they already have.
        bookings: {
          where: {
            status: 'CONFIRMED',
            shootDay: { status: 'SCHEDULED', date: { gte: taxYear.start, lt: taxYear.end } },
          },
          select: { shootDay: { select: { date: true } } },
        },
      },
      orderBy: { name: 'asc' },
    })

    const summary = beaters.map((beater) => {
      const pending = beater.payments.filter((p) => p.status === 'PENDING')
      const paid = beater.payments.filter((p) => p.status === 'PAID')
      const total = (list: typeof beater.payments) => list.reduce((sum, p) => sum + p.amount, 0)
      // Days are calendar dates: a morning and an afternoon shoot on one date are one day.
      const dayKey = (d: Date) => d.toISOString().slice(0, 10)
      const worked = new Set(
        beater.payments.filter((p) => p.shootDay.date >= taxYear.start && p.shootDay.date < taxYear.end).map((p) => dayKey(p.shootDay.date))
      )
      const expected = new Set([...worked, ...beater.bookings.map((b) => dayKey(b.shootDay.date))])
      const daysThisTaxYear = worked.size
      const daysExpectedThisTaxYear = expected.size

      return {
        id: beater.id,
        name: beater.name,
        email: beater.email,
        phone: beater.phone,
        status: beater.status,
        bankName: beater.bankName,
        bankSortCode: beater.bankSortCode,
        bankAccountNumber: beater.bankAccountNumber,
        dayRatePence: poundsToPence(beater.dayRate),
        daysWorked: new Set(beater.payments.map((p) => dayKey(p.shootDay.date))).size,
        daysThisTaxYear,
        daysExpectedThisTaxYear,
        // over: already past the limit. expectedOver: booked days will take them past it.
        // atLimit: exactly at it, so the next day takes them over.
        casualLimit:
          daysThisTaxYear > HMRC_CASUAL_DAY_LIMIT
            ? 'over'
            : daysExpectedThisTaxYear > HMRC_CASUAL_DAY_LIMIT
              ? 'expectedOver'
              : daysExpectedThisTaxYear === HMRC_CASUAL_DAY_LIMIT
                ? 'atLimit'
                : 'under',
        totalEarned: total(beater.payments),
        totalPaid: total(paid),
        totalOutstanding: total(pending),
        owed: pending.map((p) => ({
          paymentId: p.id,
          amount: p.amount,
          shootDate: p.shootDay.date,
          locationName: p.shootDay.locationName,
        })),
      }
    })

    const totals = {
      totalOutstanding: summary.reduce((sum, b) => sum + b.totalOutstanding, 0),
      totalPaid: summary.reduce((sum, b) => sum + b.totalPaid, 0),
      totalEarned: summary.reduce((sum, b) => sum + b.totalEarned, 0),
    }

    res.set('Cache-Control', 'no-store')
    res.json({ beaters: summary, totals, taxYear, casualDayLimit: HMRC_CASUAL_DAY_LIMIT })
  }))

  // GET /api/beaters/payments/owed?syndicateId= - just the total owed, in pence, for the
  // dashboard: no names or bank details travel for a single figure.
  router.get('/payments/owed', handle(async (req, res) => {
    const syndicateId = queryString(req.query.syndicateId)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')
    const owed = await prisma.beaterPayment.aggregate({ where: { syndicateId, status: 'PENDING' }, _sum: { amount: true } })
    res.set('Cache-Control', 'no-store')
    res.json({ totalOutstanding: owed._sum.amount ?? 0 })
  }))

  // GET /api/beaters/:id - bank details masked
  router.get('/:id', handle(async (req, res) => {
    const syndicateId = await syndicateOfBeater(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')

    const beater = await prisma.beater.findUnique({
      where: { id: req.params.id },
      include: {
        payments: { orderBy: { createdAt: 'desc' }, take: 20, include: { shootDay: true } },
        bookings: { orderBy: { shootDay: { date: 'desc' } }, take: 10, include: { shootDay: true } },
      },
    })
    if (!beater) throw notFound('That beater could not be found. It may have been removed.')

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
    const data = createBeaterInput.parse(req.body)
    await requireSyndicateAccess(prisma, data.syndicateId, req, 'captain')

    const beater = await prisma.$transaction(async (tx) => {
      await assertRoomFor(tx, data.syndicateId, 'beaters')
      return tx.beater.create({
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
    })
    res.status(201).json(maskBankDetails(beater))
  }))

  // PATCH /api/beaters/:id
  router.patch('/:id', handle(async (req, res) => {
    const syndicateId = await syndicateOfBeater(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')
    const { clearBankDetails, ...data } = updateBeaterSchema.parse(req.body)

    const beater = await prisma.$transaction(async (tx) => {
      // Bringing an inactive beater back takes a place on the plan.
      if (data.status === 'ACTIVE') {
        await lockSyndicate(tx, syndicateId)
        const current = await tx.beater.findUniqueOrThrow({ where: { id: req.params.id }, select: { status: true } })
        if (current.status !== 'ACTIVE') await assertRoomFor(tx, syndicateId, 'beaters')
      }
      return tx.beater.update({
        where: { id: req.params.id },
        data: { ...data, ...(clearBankDetails ? { bankSortCode: null, bankAccountNumber: null, bankName: null } : {}) },
      })
    })
    res.json(maskBankDetails(beater))
  }))

  // DELETE /api/beaters/:id - mark inactive
  router.delete('/:id', handle(async (req, res) => {
    const syndicateId = await syndicateOfBeater(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')

    const beater = await prisma.beater.update({
      where: { id: req.params.id },
      data: { status: 'INACTIVE' },
    })
    res.json(maskBankDetails(beater))
  }))

  // POST /api/beaters/:id/pay - mark exactly what the captain saw as paid.
  // Each line names the payment and the amount shown. If any is no longer owed at that
  // amount (paid elsewhere, rate changed, day changed), nothing is marked and the page reloads.
  router.post('/:id/pay', handle(async (req, res) => {
    const syndicateId = await syndicateOfBeater(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')
    const { payments, paymentReference } = paySchema.parse(req.body)
    const ids = payments.map((p) => p.paymentId)

    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.beaterPayment.findMany({
        where: { id: { in: ids }, beaterId: req.params.id, syndicateId: syndicateId! },
        select: { shootId: true },
      })
      await lockShoots(tx, rows.map((r) => r.shootId))
      const owed = await tx.beaterPayment.findMany({
        where: { id: { in: ids }, beaterId: req.params.id, syndicateId: syndicateId!, status: 'PENDING' },
        select: { id: true, amount: true },
      })
      const current = new Map(owed.map((p) => [p.id, p.amount]))
      const stale = payments.some((p) => current.get(p.paymentId) !== p.amount)
      if (stale) throw new HttpError(409, 'What this beater is owed has changed since the page loaded. Check the amounts and try again.')

      const updated = await tx.beaterPayment.updateMany({
        where: { id: { in: ids }, status: 'PENDING' },
        data: { status: 'PAID', paidDate: new Date(), paymentReference },
      })
      return { updated: updated.count, total: owed.reduce((sum, p) => sum + p.amount, 0) }
    })
    res.json(result)
  }))

  return router
}
