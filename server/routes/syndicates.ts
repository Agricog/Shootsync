import { Router } from 'express'
import { z } from 'zod'
import type { Deps } from '../deps.js'
import { dateString, HIDDEN_CHARACTERS } from '../validation.js'
import { HttpError, handle, notFound, requireSyndicateAccess, syndicateSelect, userIdOf, withoutCaptainOnlyFields } from '../access.js'
import { addAuditDetails, noteAuditContext, noteAuditTarget } from '../audit.js'
import { buildSyndicateExport } from '../syndicateExport.js'
import { dayRatePence } from '../beaterPay.js'

/** Plan states in which nothing more will be charged. */
const SUBSCRIPTION_ENDED = new Set(['CANCELLED'])


// The captain is always the signed-in user. A captainClerkId sent by the browser is ignored.
const createSyndicateSchema = z.object({
  // One line: it heads every page and the subject of every email ShootSync sends about it.
  name: z.string().trim().min(1).max(100).refine((name) => !HIDDEN_CHARACTERS.test(name), 'The name must be on one line, with no hidden characters.'),
  seasonStart: dateString.transform((s) => new Date(s)),
  seasonEnd: dateString.transform((s) => new Date(s)),
  defaultBeaterRatePence: dayRatePence.optional(),
  pegRotationRule: z.enum(['FAIR_ROTATION', 'RANDOM', 'MANUAL']).optional(),
})

const updateSyndicateSchema = createSyndicateSchema.partial().extend({
  /** Clauses added under the standard guest acknowledgement. Empty clears them. */
  waiverExtra: z.string().trim().max(2000).nullable().optional(),
})

const activityQuery = z.object({
  /** The oldest entry already shown: the next page starts after it. */
  after: z.string().min(1).max(64).optional(),
})

const PAGE = 50

export function syndicateRoutes({ prisma, config, now }: Deps): Router {
  const router = Router()

  // POST /api/syndicates/:id/export - everything held for the syndicate, in one file, captain
  // only. A POST so it is never cached or prefetched; recorded in the audit trail. Open whatever
  // the plan: getting your records back is never held back.
  router.post('/:id/export', handle(async (req, res) => {
    await requireSyndicateAccess(prisma, req.params.id, req, 'captain', { allowLapsed: true })
    const { document, unreadable } = await buildSyndicateExport(prisma, req.params.id, config.bankKeys, now())
    addAuditDetails(res, { members: document.members.length, beaters: document.beaters.length, guests: document.guests.length, ...(unreadable.length ? { bankDetailsUnreadable: unreadable } : {}) })
    res.set('Cache-Control', 'no-store')
    res.json(document)
  }))

  // GET /api/syndicates/:id/activity?after= - the audit trail, newest first, captain only.
  // Names are looked up now, never stored in the trail: someone since erased shows as such.
  router.get('/:id/activity', handle(async (req, res) => {
    await requireSyndicateAccess(prisma, req.params.id, req, 'captain')
    const { after } = activityQuery.parse(req.query)
    // A cursor on the entry itself, so entries written in the same millisecond are never skipped.
    const from = after ? await prisma.activityLog.findFirst({ where: { id: after, syndicateId: req.params.id }, select: { id: true } }) : null
    if (after && !from) throw new HttpError(400, 'That page of the activity log is no longer there. Reload it.')
    const entries = await prisma.activityLog.findMany({
      where: { syndicateId: req.params.id },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      ...(from ? { cursor: { id: from.id }, skip: 1 } : {}),
      take: PAGE + 1,
    })
    const page = entries.slice(0, PAGE)
    const ids = (type: string) => [...new Set(page.filter((e) => e.targetType === type && e.targetId).map((e) => e.targetId!))]
    const [syndicate, members, beaters, guests, shoots, bags] = await Promise.all([
      prisma.syndicate.findUniqueOrThrow({ where: { id: req.params.id }, select: { captainClerkId: true } }),
      prisma.member.findMany({ where: { syndicateId: req.params.id, id: { in: [...ids('member'), ...page.map((e) => e.actorMemberId).filter((x): x is string => Boolean(x))] } }, select: { id: true, name: true } }),
      prisma.beater.findMany({ where: { syndicateId: req.params.id, id: { in: ids('beater') } }, select: { id: true, name: true } }),
      prisma.guestGun.findMany({ where: { shootDay: { syndicateId: req.params.id }, id: { in: ids('guest') } }, select: { id: true, name: true } }),
      prisma.shootDay.findMany({ where: { syndicateId: req.params.id, id: { in: ids('shoot') } }, select: { id: true, locationName: true, date: true } }),
      prisma.bagRecord.findMany({ where: { shootDay: { syndicateId: req.params.id }, id: { in: ids('bag') } }, select: { id: true, driveNumber: true, shootDay: { select: { locationName: true, date: true } } } }),
    ])
    const memberName = new Map(members.map((m) => [m.id, m.name]))
    const day = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    const label = new Map<string, string>([
      ...members.map((m) => [m.id, m.name] as [string, string]),
      ...beaters.map((b) => [b.id, b.name] as [string, string]),
      ...guests.map((g) => [g.id, g.name] as [string, string]),
      ...shoots.map((s) => [s.id, `${s.locationName}, ${day(s.date)}`] as [string, string]),
      ...bags.map((b) => [b.id, `Drive ${b.driveNumber}, ${b.shootDay.locationName}, ${day(b.shootDay.date)}`] as [string, string]),
    ])
    const who = (e: (typeof page)[number]) => {
      if (e.actorRole === 'stripe') return 'Stripe'
      if (e.actorRole === 'system') return 'ShootSync'
      if (e.actorRole === 'guest') return 'The guest'
      if (e.actorUserId && e.actorUserId === syndicate.captainClerkId) return 'Captain'
      return (e.actorMemberId && memberName.get(e.actorMemberId)) ?? 'A member who has since left'
    }
    res.set('Cache-Control', 'no-store')
    res.json({
      entries: page.map((e) => ({
        id: e.id,
        at: e.timestamp,
        action: e.action,
        who: who(e),
        target: e.targetId ? (label.get(e.targetId) ?? (e.targetType === 'syndicate' ? null : 'Removed since')) : null,
        fields: Array.isArray((e.details as { fields?: unknown } | null)?.fields) ? (e.details as { fields: string[] }).fields : [],
      })),
      more: entries.length > PAGE,
    })
  }))

  // GET /api/syndicates - syndicates the signed-in user captains (archived ones are gone from the app)
  router.get('/', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicates = await prisma.syndicate.findMany({
      where: { captainClerkId: userId, status: 'ACTIVE' },
      select: syndicateSelect,
      orderBy: { createdAt: 'desc' },
    })
    res.json(syndicates)
  }))

  // GET /api/syndicates/:id
  router.get('/:id', handle(async (req, res) => {
    const access = await requireSyndicateAccess(prisma, req.params.id, req, 'member')

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
          select: { id: true, name: true, dayRatePence: true, status: true },
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
    if (data.seasonEnd <= data.seasonStart) {
      return res.status(400).json({ error: 'Season end must be after season start' })
    }

    const syndicate = await prisma.syndicate.create({
      data: {
        name: data.name,
        captainClerkId: userId,
        seasonStart: data.seasonStart,
        seasonEnd: data.seasonEnd,
        defaultBeaterRatePence: data.defaultBeaterRatePence ?? 4000,
        pegRotationRule: data.pegRotationRule ?? 'FAIR_ROTATION',
      },
      select: syndicateSelect,
    })
    noteAuditContext(res, { syndicateId: syndicate.id, actorUserId: userId, actorMemberId: null, actorRole: 'captain' })
    noteAuditTarget(res, syndicate.id)
    res.status(201).json(syndicate)
  }))

  // PATCH /api/syndicates/:id - captain only
  router.patch('/:id', handle(async (req, res) => {
    await requireSyndicateAccess(prisma, req.params.id, req, 'captain')
    const data = updateSyndicateSchema.parse(req.body)

    // The season must still end after it starts once this change is applied, whichever end moves.
    if (data.seasonStart || data.seasonEnd) {
      const current = await prisma.syndicate.findUniqueOrThrow({ where: { id: req.params.id }, select: { seasonStart: true, seasonEnd: true } })
      if ((data.seasonEnd ?? current.seasonEnd) <= (data.seasonStart ?? current.seasonStart)) {
        return res.status(400).json({ error: 'Season end must be after season start' })
      }
    }

    const syndicate = await prisma.syndicate.update({
      where: { id: req.params.id },
      data,
      select: syndicateSelect,
    })
    res.json(syndicate)
  }))

  // DELETE /api/syndicates/:id - archive, captain only. The syndicate disappears from the app;
  // its records are kept 90 days from when the plan ended (or from now, if it never had one) and
  // then deleted (server/retention.ts). Never while a plan is still being charged for it.
  router.delete('/:id', handle(async (req, res) => {
    // Archiving needs the plan to have ended, so it is always open to a lapsed syndicate.
    await requireSyndicateAccess(prisma, req.params.id, req, 'captain', { allowLapsed: true })

    const { stripeSubscriptionStatus } = await prisma.syndicate.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { stripeSubscriptionStatus: true },
    })
    if (stripeSubscriptionStatus && !SUBSCRIPTION_ENDED.has(stripeSubscriptionStatus)) {
      throw new HttpError(409, 'Cancel the plan for this syndicate first, in Settings, Manage billing. You can archive it once the plan has ended.')
    }

    const current = await prisma.syndicate.findUniqueOrThrow({ where: { id: req.params.id }, select: { planEndedAt: true } })
    const syndicate = await prisma.syndicate.update({
      where: { id: req.params.id },
      data: { status: 'ARCHIVED', ...(current.planEndedAt ? {} : { planEndedAt: new Date() }) },
      select: syndicateSelect,
    })
    res.json(syndicate)
  }))

  return router
}
