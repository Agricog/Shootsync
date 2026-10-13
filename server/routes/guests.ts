import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import type { Deps } from '../deps.js'
import {
  HttpError,
  handle,
  notFound,
  queryString,
  requireSyndicateAccess,
  syndicateOfGuest,
  syndicateOfMember,
  syndicateOfShoot,
  userIdOf,
} from '../access.js'

const optionalText = (max: number) => z.string().trim().max(max).optional()

/** Day fee is held in pence, the unit Stripe charges in. £50.00 = 5000. */
const DEFAULT_GUEST_DAY_FEE = 5000

const createGuestSchema = z.object({
  shootId: z.string().min(1),
  invitedByMemberId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  phone: optionalText(30),
  dayFee: z.number().int().min(0).max(100_000).default(DEFAULT_GUEST_DAY_FEE),
})

const updateGuestSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(254).optional(),
  phone: optionalText(30),
  emergencyContactName: optionalText(100),
  emergencyContactPhone: optionalText(30),
  pegNumber: z.number().int().min(1).max(100).optional(),
  dayFee: z.number().int().min(0).max(100_000).optional(),
  notes: optionalText(2000),
})

const acceptGuestSchema = z.object({
  emergencyContactName: z.string().trim().min(1).max(100),
  emergencyContactPhone: z.string().trim().min(1).max(30),
  waiverAccepted: z.literal(true, { errorMap: () => ({ message: 'Waiver must be accepted' }) }),
})

export const INVITE_TOKEN_PATTERN = /^[a-f0-9]{64}$/

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

export function guestRoutes({ prisma }: Deps): Router {
  const router = Router()

  // ---- Public: the guest's own invite, authorised by the 64-hex token in the link ----

  async function guestByToken(token: string) {
    if (!INVITE_TOKEN_PATTERN.test(token)) throw notFound('This invitation is invalid or has expired.')
    const guest = await prisma.guestGun.findUnique({ where: { inviteToken: token }, select: { id: true, rsvpStatus: true } })
    if (!guest) throw notFound('This invitation is invalid or has expired.')
    return guest
  }

  // GET /api/guests/token/:token
  router.get('/token/:token', handle(async (req, res) => {
    const { id } = await guestByToken(req.params.token)
    const guest = await prisma.guestGun.findUnique({ where: { id }, select: guestInviteSelect })
    res.set('Cache-Control', 'no-store')
    res.json(guest)
  }))

  // POST /api/guests/token/:token/accept - RSVP yes and sign the waiver
  router.post('/token/:token/accept', handle(async (req, res) => {
    const guest = await guestByToken(req.params.token)
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
    const userId = userIdOf(req)
    const shootId = queryString(req.query.shootId)
    const syndicateId = shootId ? await syndicateOfShoot(prisma, shootId) : queryString(req.query.syndicateId)
    if (!syndicateId) throw new HttpError(400, 'shootId or syndicateId is required')
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')

    const guests = await prisma.guestGun.findMany({
      where: shootId ? { shootId } : { shootDay: { syndicateId } },
      include: guestListInclude,
      orderBy: { createdAt: 'desc' },
    })
    res.json(guests)
  }))

  // GET /api/guests/:id - captain only
  router.get('/:id', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfGuest(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')

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
    if (!guest) throw notFound('Guest not found')
    res.json(guest)
  }))

  // POST /api/guests - invite a guest
  router.post('/', handle(async (req, res) => {
    const userId = userIdOf(req)
    const data = createGuestSchema.parse(req.body)
    const syndicateId = await syndicateOfShoot(prisma, data.shootId)
    const access = await requireSyndicateAccess(prisma, syndicateId, userId, 'member')

    // The inviting member must belong to the same syndicate, and a non-captain may only invite as themselves.
    if ((await syndicateOfMember(prisma, data.invitedByMemberId)) !== syndicateId) {
      throw new HttpError(400, 'Inviting member is not in this syndicate')
    }
    if (!access.isCaptain && access.memberId !== data.invitedByMemberId) throw notFound()

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
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfGuest(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')
    const data = updateGuestSchema.parse(req.body)

    const guest = await prisma.guestGun.update({ where: { id: req.params.id }, data })
    res.json(guest)
  }))

  // DELETE /api/guests/:id - captain only
  router.delete('/:id', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfGuest(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')

    // Paid or refunded guests stay on record: removing them would delete the record of the money.
    // A guest who has signed the waiver may be on the card page right now, so they are withdrawn
    // (marked declined, which the checkout refuses) rather than deleted: if a payment still lands,
    // the record is there to refund against. Only a guest who never reached payment is deleted.
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
