import type { NextFunction, Response } from 'express'
import { verifyToken, type AuthRequest } from './auth.js'
import {
  effectivePermissions,
  MANAGER_ROLES,
  type Permission,
} from './permissions.js'
import { prisma } from './prisma.js'
import type { MembershipRole } from '@prisma/client'

export type { AuthRequest }
export type AuthedRequest = AuthRequest

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const payload = await verifyToken(header.slice(7))
    req.auth = payload
    req.user = payload
    if (payload.kind === 'business' && payload.businessId) {
      req.businessId = payload.businessId
      req.membershipRole = payload.role
    }
    return next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }
}

export function requirePlatformAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.auth?.kind !== 'platform') {
    return res.status(403).json({ error: 'Platform admin only' })
  }
  return next()
}

export function requireBusiness(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.auth?.kind !== 'business' || !req.auth.businessId) {
    return res.status(403).json({ error: 'Business membership required' })
  }
  req.businessId = req.auth.businessId
  req.membershipRole = req.auth.role
  return next()
}

/** Loads active membership from DB (refreshes role — do not trust stale JWT role). */
export async function requireBusinessMember(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (req.auth.kind === 'platform') {
      const businessId =
        (req.headers['x-business-id'] as string | undefined) ||
        (req.query.businessId as string | undefined) ||
        (req.body?.businessId as string | undefined)
      if (!businessId) {
        return res
          .status(400)
          .json({ error: 'businessId required for platform access' })
      }
      const business = await prisma.business.findUnique({
        where: { id: businessId },
      })
      if (!business) return res.status(404).json({ error: 'Business not found' })
      if (business.status === 'SUSPENDED') {
        return res.status(403).json({ error: 'Business account is suspended' })
      }
      req.businessId = business.id
      req.permissions = [...effectivePermissions('OWNER', '[]')]
      req.membershipRole = 'OWNER'
      return next()
    }

    if (!req.auth.businessId || !req.auth.membershipId) {
      return res.status(403).json({ error: 'Business membership required' })
    }

    const membership = await prisma.membership.findFirst({
      where: {
        id: req.auth.membershipId,
        userId: req.auth.sub,
        businessId: req.auth.businessId,
        active: true,
      },
      include: { business: { select: { status: true } } },
    })

    if (!membership) {
      return res.status(403).json({ error: 'Membership not found or inactive' })
    }
    if (membership.business.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Business account is suspended' })
    }

    req.businessId = membership.businessId
    req.membershipId = membership.id
    req.membershipRole = membership.role
    req.auth.role = membership.role
    req.permissions = effectivePermissions(
      membership.role,
      membership.permissions,
    )

    const headerBranch = String(req.headers['x-branch-id'] || '').trim()
    if (headerBranch) {
      const branch = await prisma.branch.findFirst({
        where: { id: headerBranch, businessId: membership.businessId },
      })
      if (!branch) {
        return res.status(400).json({ error: 'Unknown branch for this shop' })
      }
      req.branchId = branch.id
    } else if (membership.branchId) {
      req.branchId = membership.branchId
    }

    return next()
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to resolve membership' })
  }
}

function ensurePerms(req: AuthRequest): string[] {
  if (req.permissions?.length) return req.permissions
  return effectivePermissions(req.membershipRole, '[]')
}

/**
 * Require every listed permission.
 * Use after requireAuth + requireBusinessMember.
 */
export function requirePermission(...needed: Permission[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const perms = ensurePerms(req)
    const missing = needed.filter((p) => !perms.includes(p))
    if (missing.length) {
      return res.status(403).json({
        error: `Missing permission: ${missing.join(', ')}`,
      })
    }
    return next()
  }
}

/** Require at least one of the listed permissions. */
export function requireAnyPermission(...needed: Permission[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const perms = ensurePerms(req)
    if (!needed.some((p) => perms.includes(p))) {
      return res.status(403).json({
        error: `Requires one of: ${needed.join(', ')}`,
      })
    }
    return next()
  }
}

/** Owner / Admin / Branch manager — audit & sensitive ops. */
export function requireManager(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const role = String(req.membershipRole || req.auth?.role || '')
  const ok =
    MANAGER_ROLES.includes(role as MembershipRole) ||
    role === 'BRANCH_MANAGER' ||
    ensurePerms(req).includes('team')
  if (!ok) {
    return res.status(403).json({ error: 'Manager access required' })
  }
  return next()
}

/** Ensure a resource's businessId matches the authenticated tenant. */
export function tenantGuard(
  resourceBusinessId: string | null | undefined,
  req: AuthRequest,
): boolean {
  const tenantId = req.businessId || req.auth?.businessId
  if (!tenantId || !resourceBusinessId) return false
  return resourceBusinessId === tenantId
}

export async function writeAudit(
  action: string,
  opts: {
    businessId?: string | null
    userId?: string | null
    entity?: string
    entityId?: string
    before?: unknown
    after?: unknown
    meta?: unknown
  } = {},
) {
  const meta = {
    ...(opts.meta && typeof opts.meta === 'object'
      ? (opts.meta as Record<string, unknown>)
      : opts.meta
        ? { value: opts.meta }
        : {}),
    ...(opts.before !== undefined ? { before: opts.before } : {}),
    ...(opts.after !== undefined ? { after: opts.after } : {}),
  }
  await prisma.auditLog.create({
    data: {
      action,
      businessId: opts.businessId || null,
      userId: opts.userId || null,
      entity: opts.entity,
      entityId: opts.entityId,
      metaJson: JSON.stringify(meta),
    },
  })
}

/** @deprecated use writeAudit */
export const audit = writeAudit
