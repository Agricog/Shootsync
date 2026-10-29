import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import type { Deps } from '../deps.js'
import { lockShoot } from '../beaterPay.js'
import {
  HttpError,
  handle,
  notFound,
  queryString,
  requireSyndicateAccess,
  syndicateOfBag,
  syndicateOfShoot,
  withoutCaptainOnlyFields,
} from '../access.js'

const count = z.number().int().min(0).max(100_000).optional()
// The note and the "other" description may be blank or null (cleared), on recording and editing.
const clearable = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v === '' ? null : v))

const createBagSchema = z.object({
  shootId: z.string().min(1),
  driveNumber: z.number().int().min(1).max(50),
  pheasant: count,
  partridge: count,
  duck: count,
  woodcock: count,
  other: count,
  otherDescription: clearable(200),
  notes: clearable(2000),
})

const updateBagSchema = createBagSchema
  .omit({ shootId: true, otherDescription: true, notes: true })
  .partial()
  .extend({ otherDescription: clearable(200), notes: clearable(2000) })

const SPECIES = ['pheasant', 'partridge', 'duck', 'woodcock', 'other'] as const
type Totals = Record<(typeof SPECIES)[number], number> & { total: number }
const emptyTotals = (): Totals => ({ pheasant: 0, partridge: 0, duck: 0, woodcock: 0, other: 0, total: 0 })
const addTo = (t: Totals, bag: Record<(typeof SPECIES)[number], number>) => {
  for (const species of SPECIES) {
    t[species] += bag[species]
    t.total += bag[species]
  }
}

/** One drive number per shoot day: two people recording "drive 2" would count the bag twice. */
async function requireFreeDrive(tx: Prisma.TransactionClient, shootId: string, driveNumber: number, exceptId?: string) {
  const taken = await tx.bagRecord.findFirst({ where: { shootId, driveNumber, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } })
  if (taken) throw new HttpError(409, `Drive ${driveNumber} is already recorded for this day. Edit it instead.`)
}

// Per the role matrix, captain and guns may record and view bags.
export function bagRoutes({ prisma }: Deps): Router {
  const router = Router()

  // GET /api/bags?shootId=
  router.get('/', handle(async (req, res) => {
    const shootId = queryString(req.query.shootId)
    const syndicateId = await syndicateOfShoot(prisma, shootId)
    await requireSyndicateAccess(prisma, syndicateId, req, 'member')

    const bags = await prisma.bagRecord.findMany({
      where: { shootId },
      orderBy: { driveNumber: 'asc' },
    })
    res.json(bags)
  }))

  // GET /api/bags/season?syndicateId= - the season's game book: totals by species, and each
  // shoot day's bag. "The season" is the syndicate's season dates; cancelled days are left out.
  router.get('/season', handle(async (req, res) => {
    const syndicateId = queryString(req.query.syndicateId)
    await requireSyndicateAccess(prisma, syndicateId, req, 'member')

    const syndicate = await prisma.syndicate.findUniqueOrThrow({ where: { id: syndicateId }, select: { seasonStart: true, seasonEnd: true } })
    // The whole of the last day counts, whatever time of day the dates were stored with.
    const seasonEndExclusive = new Date(syndicate.seasonEnd.getTime() + 24 * 60 * 60 * 1000)
    const inSeason = { gte: syndicate.seasonStart, lt: seasonEndExclusive }
    const [shoots, outsideSeason] = await Promise.all([prisma.shootDay.findMany({
      where: { syndicateId, status: { not: 'CANCELLED' }, date: inSeason },
      select: { id: true, date: true, locationName: true, status: true, bagRecords: { select: { pheasant: true, partridge: true, duck: true, woodcock: true, other: true } } },
      orderBy: { date: 'asc' },
    }),
      // Days with a bag that fall outside the season dates: usually the dates in Settings
      // haven't been moved on to the new season. The page says so rather than showing 0.
      prisma.shootDay.count({
        where: { syndicateId, status: { not: 'CANCELLED' }, bagRecords: { some: {} }, NOT: { date: inSeason } },
      }),
    ])

    const season = emptyTotals()
    const days = shoots.map((shoot) => {
      const day = emptyTotals()
      for (const bag of shoot.bagRecords) {
        addTo(day, bag)
        addTo(season, bag)
      }
      return { shootId: shoot.id, date: shoot.date, locationName: shoot.locationName, status: shoot.status, drives: shoot.bagRecords.length, ...day }
    })
    const shootsCompleted = shoots.filter((s) => s.status === 'COMPLETED').length

    res.json({
      ...season,
      shootsCompleted,
      outsideSeason,
      season: { start: syndicate.seasonStart, end: syndicate.seasonEnd },
      days: days.filter((d) => d.drives > 0 || d.status === 'COMPLETED'),
    })
  }))

  // GET /api/bags/:id
  router.get('/:id', handle(async (req, res) => {
    const syndicateId = await syndicateOfBag(prisma, req.params.id)
    const access = await requireSyndicateAccess(prisma, syndicateId, req, 'member')

    const bag = await prisma.bagRecord.findUnique({
      where: { id: req.params.id },
      include: { shootDay: true },
    })
    if (!bag) throw notFound('Bag record not found')
    // A gun sees the day, never the captain's private notes (same rule as the shoots list).
    res.json(access.isCaptain ? bag : { ...bag, shootDay: withoutCaptainOnlyFields(bag.shootDay) })
  }))

  // POST /api/bags
  router.post('/', handle(async (req, res) => {
    const data = createBagSchema.parse(req.body)
    const syndicateId = await syndicateOfShoot(prisma, data.shootId)
    const access = await requireSyndicateAccess(prisma, syndicateId, req, 'member')

    const bag = await prisma.$transaction(async (tx) => {
      await lockShoot(tx, data.shootId)
      const shoot = await tx.shootDay.findUnique({ where: { id: data.shootId }, select: { status: true } })
      if (shoot?.status === 'CANCELLED') throw new HttpError(400, 'This shoot day was cancelled, so no bag can be recorded for it')
      await requireFreeDrive(tx, data.shootId, data.driveNumber)
      return tx.bagRecord.create({
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
    })
    res.status(201).json(bag)
  }))

  // PATCH /api/bags/:id
  router.patch('/:id', handle(async (req, res) => {
    const syndicateId = await syndicateOfBag(prisma, req.params.id)
    const access = await requireSyndicateAccess(prisma, syndicateId, req, 'member')
    const data = updateBagSchema.parse(req.body)

    // The captain can correct any bag; a gun only the ones they recorded.
    if (!access.isCaptain) {
      const bag = await prisma.bagRecord.findUnique({ where: { id: req.params.id }, select: { recordedByMemberId: true } })
      if (!bag || bag.recordedByMemberId !== access.memberId) throw notFound()
    }

    const bag = await prisma.$transaction(async (tx) => {
      const { shootId } = await tx.bagRecord.findUniqueOrThrow({ where: { id: req.params.id }, select: { shootId: true } })
      await lockShoot(tx, shootId)
      const current = await tx.bagRecord.findUniqueOrThrow({ where: { id: req.params.id }, select: { driveNumber: true, shootDay: { select: { status: true } } } })
      if (current.shootDay.status === 'CANCELLED') throw new HttpError(400, 'This shoot day was cancelled, so its bag can no longer change')
      // Only a change of drive number can clash (records made before this rule may share a number).
      if (data.driveNumber !== undefined && data.driveNumber !== current.driveNumber) await requireFreeDrive(tx, shootId, data.driveNumber, req.params.id)
      return tx.bagRecord.update({ where: { id: req.params.id }, data })
    })
    res.json(bag)
  }))

  // DELETE /api/bags/:id - captain only
  router.delete('/:id', handle(async (req, res) => {
    const syndicateId = await syndicateOfBag(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')

    await prisma.bagRecord.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  }))

  return router
}
