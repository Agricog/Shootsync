import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Deps } from '../deps.js'
import {
  handle,
  notFound,
  queryString,
  requireSyndicateAccess,
  syndicateOfMember,
  syndicateSelect,
  userIdOf,
} from '../access.js'

const optionalText = (max: number) => z.string().trim().max(max).optional()
const dateString = z.string().min(1).refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date')

// clerkUserId is never taken from the browser: an invited member gets a server-generated
// placeholder until they sign in and accept.
const createMemberSchema = z.object({
  syndicateId: z.string().min(1),
  email: z.string().trim().email().max(254),
  name: z.string().trim().min(1).max(100),
  phone: optionalText(30),
  role: z.enum(['CAPTAIN', 'GUN', 'BEATER', 'HYBRID']).optional(),
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

export function memberRoutes({ prisma }: Deps): Router {
  const router = Router()

  // GET /api/members?syndicateId= - captain only (contact and insurance details)
  router.get('/', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = queryString(req.query.syndicateId)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')
    const status = statusFilter.parse(queryString(req.query.status))
    const role = roleFilter.parse(queryString(req.query.role))

    const members = await prisma.member.findMany({
      where: { syndicateId, ...(status ? { status } : {}), ...(role ? { role } : {}) },
      orderBy: { name: 'asc' },
    })
    res.json(members)
  }))

  // GET /api/members/by-clerk/:clerkUserId - the signed-in user's own membership only
  router.get('/by-clerk/:clerkUserId', handle(async (req, res) => {
    const userId = userIdOf(req)
    if (req.params.clerkUserId !== userId) throw notFound('Member not found')
    const syndicateId = queryString(req.query.syndicateId)

    const member = await prisma.member.findFirst({
      where: { clerkUserId: userId, ...(syndicateId ? { syndicateId } : {}) },
      include: { syndicate: { select: syndicateSelect } },
    })
    if (!member) throw notFound('Member not found')
    res.json(member)
  }))

  // GET /api/members/:id - captain only
  router.get('/:id', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfMember(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')

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

  // POST /api/members - invite, captain only
  router.post('/', handle(async (req, res) => {
    const userId = userIdOf(req)
    const data = createMemberSchema.parse(req.body)
    await requireSyndicateAccess(prisma, data.syndicateId, userId, 'captain')

    const member = await prisma.member.create({
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
        invitedAt: new Date(),
        status: 'PENDING',
      },
    })
    res.status(201).json(member)
  }))

  // PATCH /api/members/:id - captain only
  router.patch('/:id', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfMember(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')
    const data = updateMemberSchema.parse(req.body)

    const member = await prisma.member.update({ where: { id: req.params.id }, data })
    res.json(member)
  }))

  // PATCH /api/members/:id/status - captain only
  router.patch('/:id/status', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfMember(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')
    const { status } = updateStatusSchema.parse(req.body)

    const existing = await prisma.member.findUnique({
      where: { id: req.params.id },
      select: { acceptedAt: true },
    })
    const member = await prisma.member.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === 'ACTIVE' && !existing?.acceptedAt ? { acceptedAt: new Date() } : {}),
      },
    })
    res.json(member)
  }))

  // POST /api/members/:id/accept - only the invited person themselves
  router.post('/:id/accept', handle(async (req, res) => {
    const userId = userIdOf(req)
    const existing = await prisma.member.findUnique({
      where: { id: req.params.id },
      select: { clerkUserId: true },
    })
    if (!existing || existing.clerkUserId !== userId) throw notFound('Member not found')

    const member = await prisma.member.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE', acceptedAt: new Date() },
    })
    res.json(member)
  }))

  // DELETE /api/members/:id - mark inactive, captain only
  router.delete('/:id', handle(async (req, res) => {
    const userId = userIdOf(req)
    const syndicateId = await syndicateOfMember(prisma, req.params.id)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')

    const member = await prisma.member.update({
      where: { id: req.params.id },
      data: { status: 'INACTIVE' },
    })
    res.json(member)
  }))

  return router
}
