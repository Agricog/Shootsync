import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import type { Deps } from '../deps.js'
import {
  GUN_ROLES,
  HttpError,
  handle,
  notFound,
  queryString,
  requireSyndicateAccess,
  syndicateOfGuest,
  syndicateOfShoot,
} from '../access.js'

const optionalText = (max: number) => z.string().trim().max(max).optional()

/** Day fee is held in pence, the unit Stripe charges in. £50.00 = 5000. */
const DEFAULT_GUEST_DAY_FEE = 5000

/** In pence, but the captain types pounds, so the limits are worded in pounds. */
const dayFeePence = z
  .number()
  .int('Day fee must be whole pence.')
  .min(0, 'Day fee can’t be less than £0.')
  .max(100_000, 'Day fee must be £1,000 or less.')

const createGuestSchema = z.object({
  shootId: z.string().min(1),
  invitedByMemberId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  phone: optionalText(30),
  dayFee: dayFeePence.default(DEFAULT_GUEST_DAY_FEE),
})

const updateGuestSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(254).optional(),
  phone: optionalText(30),
  emergencyContactName: optionalText(100),
  emergencyContactPhone: optionalText(30),
  pegNumber: z.number().int().min(1).max(100).optional(),
  dayFee: dayFeePence.optional(),
  notes: optionalText(2000),
})

const acceptGuestSchema = z.object({
  emergencyContactName: z.string().trim().min(1).max(100),
  emergencyContactPhone: z.string().trim().min(1).max(30),
  waiverAccepted: z.literal(true, { error: 'Waiver must be accepted' }),
})

export const INVITE_TOKEN_PATTERN = /^[a-f0-9]{64}$/

const markPaidSchema = z.object({ paid: z.boolean() })

type PaymentFacts = { paymentStatus: string; dayFee: number; rsvpStatus: string; stripePaymentId: string | null }

function whyNotPaid(guest: PaymentFacts): string {
  if (guest.paymentStatus !== 'PENDING') return 'This guest is already marked paid.'
  if (guest.dayFee <= 0) return 'This guest has no day fee to pay.'
  return 'This guest has declined or been withdrawn, so there is nothing to mark paid.'
}

function whyNotUnpaid(guest: PaymentFacts): string {
  if (guest.paymentStatus !== 'PAID') return 'This guest isn’t marked paid.'
  return 'This guest paid by card through Stripe, so it can’t be undone here. Refund them in Stripe if they aren’t coming.'
}

/** A shoot day's date as "YYYY-MM-DD". Shoot dates are stored as midnight UTC of the day chosen. */
export const shootDateKey = (date: Date): string => date.toISOString().slice(0, 10)

/** "YYYY-MM-DD" plus a number of days. */
function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

/**
 * How long after the shoot day a guest's link still opens (read-only, showing the day is over).
 * After that it is treated as expired: the guest's details are no longer reachable from an old email.
 */
export const GUEST_LINK_DAYS_AFTER_SHOOT = 30

/**
 * Why a guest can no longer accept, decline or pay for a day, or null while they still can.
 * Open means the day is still scheduled and hasn't passed: a guest can still pay on the morning.
 */
export function guestDayClosed(shoot: { status: string; date: Date }, today: string): string | null {
  if (shoot.status === 'CANCELLED') return 'This shoot day has been cancelled, so the invitation is closed. Please contact the person who invited you.'
  if (shoot.status === 'COMPLETED' || shootDateKey(shoot.date) < today) return 'This shoot day has already taken place, so the invitation is closed.'
  return null
}

/** Whether a guest link has expired: some time after its shoot day. */
export function guestLinkExpired(shootDate: Date, today: string): boolean {
  return today > addDays(shootDateKey(shootDate), GUEST_LINK_DAYS_AFTER_SHOOT)
}

/** What a guest sees about their own invite. No other guest, member or payment data. */
const guestInviteSelect = {
  name: true,
  email: true,
  dayFee: true,
  rsvpStatus: true,
  paymentStatus: true,
  waiverAccepted: true,
  invitedByMember: { select: { name: true } },
  shootDay: {
    select: {
      date: true,
      locationName: true,
      locationAddress: true,
      locationPostcode: true,
      meetTime: true,
      syndicate: { select: { name: true } },
    },
  },
} as const

const guestListInclude = {
  invitedByMember: { select: { name: true, email: true } },
  shootDay: { select: { date: true, locationName: true } },
} as const

export function guestRoutes({ prisma, today }: Deps): Router {
  const router = Router()

  // ---- Public: the guest's own invite, authorised by the 64-hex token in the link ----

  async function guestByToken(token: string) {
    if (!INVITE_TOKEN_PATTERN.test(token)) throw notFound('This invitation is invalid or has expired.')
    const guest = await prisma.guestGun.findUnique({
      where: { inviteToken: token },
      select: { id: true, rsvpStatus: true, shootDay: { select: { status: true, date: true, syndicate: { select: { status: true } } } } },
    })
    // An archived syndicate is gone from the app, its guest links with it; and every link
    // expires a while after its day.
    if (!guest || guest.shootDay.syndicate.status !== 'ACTIVE' || guestLinkExpired(guest.shootDay.date, today())) {
      throw notFound('This invitation is invalid or has expired.')
    }
    return { id: guest.id, rsvpStatus: guest.rsvpStatus, closed: guestDayClosed(guest.shootDay, today()) }
  }

  // GET /api/guests/token/:token
  router.get('/token/:token', handle(async (req, res) => {
    const { id, closed } = await guestByToken(req.params.token)
    const guest = await prisma.guestGun.findUnique({ where: { id }, select: guestInviteSelect })
    res.set('Cache-Control', 'no-store')
    // closed: why nothing more can be done with this invitation (the page shows it), or null.
    res.json({ ...guest, closed })
  }))

  // POST /api/guests/token/:token/accept - RSVP yes and sign the waiver
  router.post('/token/:token/accept', handle(async (req, res) => {
    const guest = await guestByToken(req.params.token)
    if (guest.closed) throw new HttpError(409, guest.closed)
    if (guest.rsvpStatus === 'DECLINED') throw new HttpError(409, 'This invitation was declined.')
    const data = acceptGuestSchema.parse(req.body)

    const updated = await prisma.guestGun.update({
      where: { id: guest.id },
      data: {
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        waiverAccepted: true,
        waiverAcceptedAt: new Date(),
        rsvpStatus: 'CONFIRMED',
      },
      select: guestInviteSelect,
    })
    res.json(updated)
  }))

  // POST /api/guests/token/:token/decline
  router.post('/token/:token/decline', handle(async (req, res) => {
    const guest = await guestByToken(req.params.token)
    if (guest.closed) throw new HttpError(409, guest.closed)
    const updated = await prisma.guestGun.update({
      where: { id: guest.id },
      data: { rsvpStatus: 'DECLINED' },
      select: guestInviteSelect,
    })
    res.json(updated)
  }))

  // ---- Signed in: captain manages guests; a member may invite their own guests ----

  // GET /api/guests?shootId= or ?syndicateId= - captain only
  router.get('/', handle(async (req, res) => {
    const shootId = queryString(req.query.shootId)
    const syndicateId = shootId ? await syndicateOfShoot(prisma, shootId) : queryString(req.query.syndicateId)
    if (!syndicateId) throw new HttpError(400, 'shootId or syndicateId is required')
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')

    const guests = await prisma.guestGun.findMany({
      where: shootId ? { shootId } : { shootDay: { syndicateId } },
      include: guestListInclude,
      orderBy: { createdAt: 'desc' },
    })
    res.json(guests)
  }))

  // GET /api/guests/:id - captain only
  router.get('/:id', handle(async (req, res) => {
    const syndicateId = await syndicateOfGuest(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')

    const guest = await prisma.guestGun.findUnique({
      where: { id: req.params.id },
      include: {
        invitedByMember: { select: { name: true, email: true } },
        shootDay: {
          select: {
            date: true,
            locationName: true,
            locationAddress: true,
            locationPostcode: true,
            meetTime: true,
            syndicate: { select: { name: true } },
          },
        },
      },
    })
    if (!guest) throw notFound('That guest could not be found. It may have been removed.')
    res.json(guest)
  }))

  // POST /api/guests - invite a guest
  router.post('/', handle(async (req, res) => {
    const data = createGuestSchema.parse(req.body)
    const syndicateId = await syndicateOfShoot(prisma, data.shootId)
    const access = await requireSyndicateAccess(prisma, syndicateId, req, 'member')

    // The inviting member must be an active gun of the same syndicate, and a non-captain may only invite as themselves.
    const inviter = await prisma.member.findUnique({ where: { id: data.invitedByMemberId }, select: { syndicateId: true, status: true, role: true } })
    if (!inviter || inviter.syndicateId !== syndicateId) {
      throw new HttpError(400, 'Inviting member is not in this syndicate')
    }
    if (inviter.status !== 'ACTIVE' || !(GUN_ROLES as readonly string[]).includes(inviter.role)) {
      throw new HttpError(400, 'A guest has to be the guest of an active gun.')
    }
    if (!access.isCaptain && access.memberId !== data.invitedByMemberId) throw notFound()

    const shoot = await prisma.shootDay.findUniqueOrThrow({ where: { id: data.shootId }, select: { status: true, date: true } })
    if (guestDayClosed(shoot, today())) {
      throw new HttpError(409, 'Guests can only be invited to a day that is still scheduled and hasn’t happened yet.')
    }

    const guest = await prisma.guestGun.create({
      data: {
        shootId: data.shootId,
        invitedByMemberId: data.invitedByMemberId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        // Only the captain sets fees. A gun's invite always carries the standard fee.
        dayFee: access.isCaptain ? data.dayFee : DEFAULT_GUEST_DAY_FEE,
        inviteToken: randomBytes(32).toString('hex'),
        rsvpStatus: 'PENDING',
        paymentStatus: 'PENDING',
        waiverAccepted: false,
      },
      include: { shootDay: { select: { date: true, locationName: true } } },
    })
    res.status(201).json(guest)
  }))

  // PATCH /api/guests/:id - captain only
  router.patch('/:id', handle(async (req, res) => {
    const syndicateId = await syndicateOfGuest(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')
    const data = updateGuestSchema.parse(req.body)

    // The fee is fixed once the guest has accepted the invitation: that is the fee they agreed to
    // and the one their page tells them to pay. The condition is part of the write, so an acceptance
    // arriving at the same moment can't slip between a check and the change.
    if (data.dayFee !== undefined) {
      const changed = await prisma.guestGun.updateMany({
        where: { id: req.params.id, OR: [{ dayFee: data.dayFee }, { waiverAccepted: false, paymentStatus: 'PENDING' }] },
        data,
      })
      if (changed.count === 0) {
        throw new HttpError(409, 'This guest has already accepted the invitation at its day fee, so the fee can’t change now. Remove them and invite them again if it must.')
      }
      return res.json(await prisma.guestGun.findUniqueOrThrow({ where: { id: req.params.id } }))
    }
    const guest = await prisma.guestGun.update({ where: { id: req.params.id }, data })
    res.json(guest)
  }))

  // PATCH /api/guests/:id/payment { paid } - captain only. Guests pay the syndicate directly;
  // the captain records it here. A payment taken by card through Stripe can't be undone here:
  // that money has to be refunded in Stripe.
  router.patch('/:id/payment', handle(async (req, res) => {
    const syndicateId = await syndicateOfGuest(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')
    const { paid } = markPaidSchema.parse(req.body)

    const changed = paid
      ? await prisma.guestGun.updateMany({
          where: { id: req.params.id, paymentStatus: 'PENDING', dayFee: { gt: 0 }, rsvpStatus: { not: 'DECLINED' } },
          data: { paymentStatus: 'PAID' },
        })
      : await prisma.guestGun.updateMany({
          where: { id: req.params.id, paymentStatus: 'PAID', stripePaymentId: null },
          data: { paymentStatus: 'PENDING' },
        })
    if (changed.count === 0) {
      const guest = await prisma.guestGun.findUniqueOrThrow({ where: { id: req.params.id }, select: { paymentStatus: true, dayFee: true, rsvpStatus: true, stripePaymentId: true } })
      throw new HttpError(409, paid ? whyNotPaid(guest) : whyNotUnpaid(guest))
    }
    res.json(await prisma.guestGun.findUniqueOrThrow({ where: { id: req.params.id } }))
  }))

  // DELETE /api/guests/:id - captain only
  router.delete('/:id', handle(async (req, res) => {
    const syndicateId = await syndicateOfGuest(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')

    // Paid or refunded guests stay on record: removing them would delete the record of the money.
    // A guest who has signed the waiver is withdrawn (marked declined) rather than deleted: their
    // signed waiver stays on record, as does anything to refund against if a card payment from a
    // page opened before online payment was switched off still lands. Only a guest who never
    // accepted is deleted.
    // Each write carries its own condition, so a payment arriving at the same moment can't slip past.
    const guest = await prisma.guestGun.findUnique({ where: { id: req.params.id }, select: { paymentStatus: true, waiverAccepted: true } })
    if (!guest) throw notFound()
    if (guest.paymentStatus !== 'PENDING') {
      throw new HttpError(409, 'This guest has paid their day fee, so they stay on record. Refund them in Stripe if they are not coming.')
    }
    if (guest.waiverAccepted) {
      const withdrawn = await prisma.guestGun.updateMany({
        where: { id: req.params.id, paymentStatus: 'PENDING' },
        data: { rsvpStatus: 'DECLINED' },
      })
      if (withdrawn.count === 0) throw new HttpError(409, 'This guest has just paid, so they stay on record.')
      return res.json({ success: true, withdrawn: true })
    }
    const removed = await prisma.guestGun.deleteMany({ where: { id: req.params.id, paymentStatus: 'PENDING', waiverAccepted: false } })
    if (removed.count === 0) throw new HttpError(409, 'This guest’s status has just changed. Reload the page and try again.')
    res.json({ success: true })
  }))

  return router
}
