import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Deps } from '../deps.js'
import { assertRoomFor, lockSyndicate } from '../planLimits.js'
import {
  GUN_ROLES,
  handle,
  notFound,
  queryString,
  requireSyndicateAccess,
  syndicateOfMember,
} from '../access.js'

const optionalText = (max: number) => z.string().trim().max(max).optional()
const dateString = z.string().min(1).refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date')

// clerkUserId is never taken from the browser: a member added by the captain gets a
// server-generated placeholder, which no sign-in can ever match.
const createMemberSchema = z.object({
  syndicateId: z.string().min(1),
  email: z.string().trim().email().max(254),
  name: z.string().trim().min(1).max(100),
  phone: optionalText(30),
  // Members are guns. Beaters are kept on the Beaters page, with their day rate and pay.
  role: z.enum(['GUN']).optional(),
  bascNumber: optionalText(30),
  insuranceExpiry: dateString.transform((s) => new Date(s)).optional(),
  emergencyContactName: optionalText(100),
  emergencyContactPhone: optionalText(30),
})

const updateMemberSchema = createMemberSchema.omit({ syndicateId: true }).partial()

const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'PENDING', 'INACTIVE']),
})

const statusFilter = z.enum(['ACTIVE', 'PENDING', 'INACTIVE']).optional()
const roleFilter = z.enum(['CAPTAIN', 'GUN', 'BEATER', 'HYBRID']).optional()

const isGunRole = (role: string) => (GUN_ROLES as readonly string[]).includes(role)

export function memberRoutes({ prisma }: Deps): Router {
  const router = Router()

  // GET /api/members?syndicateId= - captain only (contact and insurance details)
  router.get('/', handle(async (req, res) => {
    const syndicateId = queryString(req.query.syndicateId)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')
    const status = statusFilter.parse(queryString(req.query.status))
    const role = roleFilter.parse(queryString(req.query.role))

    const members = await prisma.member.findMany({
      where: { syndicateId, ...(status ? { status } : {}), ...(role ? { role } : {}) },
      orderBy: { name: 'asc' },
    })
    res.json(members)
  }))

  // GET /api/members/:id - captain only
  router.get('/:id', handle(async (req, res) => {
    const syndicateId = await syndicateOfMember(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')

    const member = await prisma.member.findUnique({
      where: { id: req.params.id },
      include: {
        shootAttendances: {
          include: { shootDay: true },
          orderBy: { shootDay: { date: 'desc' } },
          take: 10,
        },
        memberPayments: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })
    if (!member) throw notFound('Member not found')
    res.json(member)
  }))

  // POST /api/members - add a gun to the list, captain only
  router.post('/', handle(async (req, res) => {
    const data = createMemberSchema.parse(req.body)
    await requireSyndicateAccess(prisma, data.syndicateId, req, 'captain')

    const member = await prisma.$transaction(async (tx) => {
      await assertRoomFor(tx, data.syndicateId, 'guns')
      return tx.member.create({
        data: {
          syndicateId: data.syndicateId,
          clerkUserId: `pending_${randomUUID()}`,
          email: data.email,
          name: data.name,
          phone: data.phone,
          role: data.role ?? 'GUN',
          bascNumber: data.bascNumber,
          insuranceExpiry: data.insuranceExpiry,
          emergencyContactName: data.emergencyContactName,
          emergencyContactPhone: data.emergencyContactPhone,
          // On the gun list from the moment the captain adds them. Nothing is sent to them:
          // their own sign-in is a separate, later step.
          status: 'ACTIVE',
        },
      })
    })
    res.status(201).json(member)
  }))

  // PATCH /api/members/:id - captain only
  router.patch('/:id', handle(async (req, res) => {
    const syndicateId = await syndicateOfMember(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')
    const data = updateMemberSchema.parse(req.body)

    const member = await prisma.$transaction(async (tx) => {
      // Lock before reading, so a role change and a status change at the same moment can't both slip past.
      await lockSyndicate(tx, syndicateId)
      // Turning an active non-gun record into a gun adds a gun to the plan's count.
      const current = await tx.member.findUniqueOrThrow({ where: { id: req.params.id }, select: { role: true, status: true } })
      const becomesGun = data.role !== undefined && !isGunRole(current.role) && isGunRole(data.role)
      if (becomesGun && current.status === 'ACTIVE') await assertRoomFor(tx, syndicateId, 'guns')
      return tx.member.update({ where: { id: req.params.id }, data })
    })
    res.json(member)
  }))

  // PATCH /api/members/:id/status - captain only
  router.patch('/:id/status', handle(async (req, res) => {
    const syndicateId = await syndicateOfMember(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')
    const { status } = updateStatusSchema.parse(req.body)

    const member = await prisma.$transaction(async (tx) => {
      await lockSyndicate(tx, syndicateId)
      const existing = await tx.member.findUniqueOrThrow({
        where: { id: req.params.id },
        select: { acceptedAt: true, status: true, role: true },
      })
      // Making an inactive gun active again takes a place on the plan.
      if (status === 'ACTIVE' && existing.status !== 'ACTIVE' && isGunRole(existing.role)) {
        await assertRoomFor(tx, syndicateId, 'guns')
      }
      return tx.member.update({
        where: { id: req.params.id },
        data: {
          status,
          ...(status === 'ACTIVE' && !existing.acceptedAt ? { acceptedAt: new Date() } : {}),
        },
      })
    })
    res.json(member)
  }))

  // DELETE /api/members/:id - mark inactive, captain only
  router.delete('/:id', handle(async (req, res) => {
    const syndicateId = await syndicateOfMember(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain')

    const member = await prisma.member.update({
      where: { id: req.params.id },
      data: { status: 'INACTIVE' },
    })
    res.json(member)
  }))

  return router
}
