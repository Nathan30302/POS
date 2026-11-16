import { Router } from 'express'
import { z } from 'zod'
import type { MembershipRole } from '@prisma/client'
import { hashPassword } from '../auth.js'
import {
  ALL_PERMISSIONS,
  MANAGER_ROLES,
  defaultsForRole,
  effectivePermissions,
} from '../permissions.js'
import {
  audit,
  requireAuth,
  requireBusiness,
  type AuthedRequest,
} from '../middleware.js'
import { prisma } from '../prisma.js'

export const teamRouter = Router()
teamRouter.use(requireAuth, requireBusiness)

const staffRoles = z.enum([
  'ADMIN',
  'BRANCH_MANAGER',
  'ACCOUNTANT',
  'INVENTORY_MANAGER',
  'CASHIER',
  'SALES',
  'CUSTOM',
])

function requireManager(req: AuthedRequest, res: import('express').Response) {
  const role = (req.auth?.role || req.membershipRole || '') as MembershipRole
  if (!MANAGER_ROLES.includes(role)) {
    res.status(403).json({ error: 'Owner or admin only' })
    return false
  }
  return true
}

teamRouter.get('/roles', (_req, res) => {
  res.json({
    roles: staffRoles.options,
    permissions: ALL_PERMISSIONS,
    defaults: {
      ADMIN: defaultsForRole('ADMIN'),
      BRANCH_MANAGER: defaultsForRole('BRANCH_MANAGER'),
      ACCOUNTANT: defaultsForRole('ACCOUNTANT'),
      INVENTORY_MANAGER: defaultsForRole('INVENTORY_MANAGER'),
      CASHIER: defaultsForRole('CASHIER'),
      SALES: defaultsForRole('SALES'),
      CUSTOM: defaultsForRole('CUSTOM'),
    },
  })
})

teamRouter.get('/', async (req: AuthedRequest, res) => {
  if (!requireManager(req, res)) return

  const members = await prisma.membership.findMany({
    where: { businessId: req.auth!.businessId! },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          active: true,
          createdAt: true,
        },
      },
      branch: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  res.json({
    members: members.map((m) => ({
      membershipId: m.id,
      role: m.role,
      active: m.active,
      permissions: effectivePermissions(m.role, m.permissions),
      permissionsCustom: JSON.parse(m.permissions || '[]'),
      branch: m.branch,
      user: m.user,
      createdAt: m.createdAt,
    })),
  })
})

teamRouter.post('/', async (req: AuthedRequest, res) => {
  if (!requireManager(req, res)) return

  const body = z
    .object({
      fullName: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8),
      phone: z.string().optional(),
      role: staffRoles,
      permissions: z
        .array(z.enum(ALL_PERMISSIONS as unknown as [string, ...string[]]))
        .optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    return res.status(400).json({ error: 'Invalid staff payload' })
  }

  const email = body.data.email.toLowerCase().trim()
  const businessId = req.auth!.businessId!

  const platformClash = await prisma.platformUser.findUnique({ where: { email } })
  if (platformClash) {
    return res.status(409).json({ error: 'Email is reserved for platform use' })
  }

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    const already = await prisma.membership.findUnique({
      where: {
        businessId_userId: { businessId, userId: existingUser.id },
      },
    })
    if (already) {
      return res.status(409).json({ error: 'This person is already on your team' })
    }
  }

  const permissions =
    body.data.permissions && body.data.permissions.length
      ? body.data.permissions
      : defaultsForRole(body.data.role as MembershipRole)

  const passwordHash = await hashPassword(body.data.password)
  const branch = await prisma.branch.findFirst({
    where: { businessId, isMain: true },
  })

  const result = await prisma.$transaction(async (tx) => {
    const user =
      existingUser ||
      (await tx.user.create({
        data: {
          email,
          fullName: body.data.fullName.trim(),
          phone: body.data.phone?.trim() || null,
          passwordHash,
          active: true,
        },
      }))

    if (existingUser) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          fullName: body.data.fullName.trim(),
          phone: body.data.phone?.trim() || existingUser.phone,
          passwordHash,
          active: true,
        },
      })
    }

    const membership = await tx.membership.create({
      data: {
        businessId,
        userId: user.id,
        branchId: branch?.id,
        role: body.data.role as MembershipRole,
        permissions: JSON.stringify(permissions),
        active: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            active: true,
          },
        },
      },
    })

    return membership
  })

  await audit('team.member_created', {
    businessId,
    userId: req.auth!.sub,
    entity: 'Membership',
    entityId: result.id,
    meta: { email, role: body.data.role },
  })

  res.status(201).json({
    member: {
      membershipId: result.id,
      role: result.role,
      active: result.active,
      permissions,
      user: result.user,
    },
  })
})

teamRouter.patch('/:membershipId', async (req: AuthedRequest, res) => {
  if (!requireManager(req, res)) return

  const body = z
    .object({
      fullName: z.string().min(2).optional(),
      phone: z.string().optional().nullable(),
      role: staffRoles.optional(),
      permissions: z
        .array(z.enum(ALL_PERMISSIONS as unknown as [string, ...string[]]))
        .optional(),
      active: z.boolean().optional(),
      password: z.string().min(8).optional(),
    })
    .safeParse(req.body)

  if (!body.success) return res.status(400).json({ error: 'Invalid update' })

  const membership = await prisma.membership.findFirst({
    where: {
      id: req.params.membershipId,
      businessId: req.auth!.businessId!,
    },
    include: { user: true },
  })
  if (!membership) return res.status(404).json({ error: 'Team member not found' })

  if (membership.role === 'OWNER' && membership.userId !== req.auth!.sub) {
    return res.status(403).json({ error: 'Cannot edit another owner this way' })
  }

  if (membership.userId === req.auth!.sub && body.data.active === false) {
    return res.status(400).json({ error: 'You cannot deactivate yourself' })
  }

  const nextRole = (body.data.role || membership.role) as MembershipRole
  if (nextRole === 'OWNER' && membership.role !== 'OWNER') {
    return res.status(400).json({ error: 'Cannot promote to owner from Team' })
  }

  const permissions =
    body.data.permissions !== undefined
      ? body.data.permissions
      : body.data.role
        ? defaultsForRole(nextRole)
        : undefined

  const updated = await prisma.$transaction(async (tx) => {
    if (
      body.data.fullName ||
      body.data.phone !== undefined ||
      body.data.password ||
      body.data.active !== undefined
    ) {
      await tx.user.update({
        where: { id: membership.userId },
        data: {
          fullName: body.data.fullName?.trim() ?? undefined,
          phone:
            body.data.phone === undefined
              ? undefined
              : body.data.phone?.trim() || null,
          passwordHash: body.data.password
            ? await hashPassword(body.data.password)
            : undefined,
          active: body.data.active ?? undefined,
        },
      })
    }

    return tx.membership.update({
      where: { id: membership.id },
      data: {
        role: body.data.role ? (body.data.role as MembershipRole) : undefined,
        permissions:
          permissions !== undefined ? JSON.stringify(permissions) : undefined,
        active: body.data.active ?? undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            active: true,
          },
        },
      },
    })
  })

  await audit('team.member_updated', {
    businessId: req.auth!.businessId!,
    userId: req.auth!.sub,
    entity: 'Membership',
    entityId: membership.id,
    meta: body.data,
  })

  res.json({
    member: {
      membershipId: updated.id,
      role: updated.role,
      active: updated.active,
      permissions: effectivePermissions(updated.role, updated.permissions),
      user: updated.user,
    },
  })
})

teamRouter.delete('/:membershipId', async (req: AuthedRequest, res) => {
  if (!requireManager(req, res)) return

  const membership = await prisma.membership.findFirst({
    where: {
      id: req.params.membershipId,
      businessId: req.auth!.businessId!,
    },
  })
  if (!membership) return res.status(404).json({ error: 'Team member not found' })
  if (membership.role === 'OWNER') {
    return res.status(403).json({ error: 'Cannot remove the owner' })
  }
  if (membership.userId === req.auth!.sub) {
    return res.status(400).json({ error: 'You cannot remove yourself' })
  }

  await prisma.membership.update({
    where: { id: membership.id },
    data: { active: false },
  })
  await prisma.user.update({
    where: { id: membership.userId },
    data: { active: false },
  })

  await audit('team.member_deactivated', {
    businessId: req.auth!.businessId!,
    userId: req.auth!.sub,
    entity: 'Membership',
    entityId: membership.id,
  })

  res.json({ ok: true })
})
