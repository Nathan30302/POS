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
    const { extractAccessToken } = await import('./sessionCookie.js')
    const token = extractAccessToken(req)
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const payload = await verifyToken(token)
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

/** Mutating platform ops — SUPER_ADMIN only (SUPPORT is read-only). */
export function requirePlatformSuperAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.auth?.kind !== 'platform') {
    return res.status(403).json({ error: 'Platform admin only' })
  }
  if (req.auth.role !== 'SUPER_ADMIN') {
    return res
      .status(403)
      .json({ error: 'Super admin only — support accounts are read-only' })
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
      // SUPPORT may inspect a tenant; only SUPER_ADMIN gets OWNER-level mutations
      if (req.auth.role === 'SUPPORT' && req.method !== 'GET' && req.method !== 'HEAD') {
        return res
          .status(403)
          .json({ error: 'Support accounts are read-only for shop data' })
      }
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
      const { refreshSubscriptionState, accessFromBusiness } = await import(
        './subscription.js'
      )
      const live = await refreshSubscriptionState(business.id)
      const gate = accessFromBusiness(live)
      if (gate.access === 'blocked') {
        return res.status(403).json({ error: gate.accessMessage })
      }
      req.businessId = live.id
      if (req.auth.role === 'SUPPORT') {
        req.permissions = ['ledger', 'pulse', 'customers']
        req.membershipRole = 'ACCOUNTANT'
      } else {
        req.permissions = [...effectivePermissions('OWNER', '[]')]
        req.membershipRole = 'OWNER'
      }
      return next()
    }

    if (!req.auth.businessId || !req.auth.membershipId) {
      return res.status(403).json({ error: 'Business membership required' })
    }

    const { refreshSubscriptionState, accessFromBusiness } = await import(
      './subscription.js'
    )
    const liveBiz = await refreshSubscriptionState(req.auth.businessId)
    const gate = accessFromBusiness(liveBiz)
    if (gate.access === 'blocked') {
      return res.status(403).json({ error: gate.accessMessage })
    }

    const membership = await prisma.membership.findFirst({
      where: {
        id: req.auth.membershipId,
        userId: req.auth.sub,
        businessId: req.auth.businessId,
        active: true,
      },
      include: { user: { select: { active: true } } },
    })

    if (!membership) {
      return res.status(403).json({ error: 'Membership not found or inactive' })
    }
    if (!membership.user.active) {
      return res.status(403).json({ error: 'Account deactivated' })
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
    if (headerBranch === '__all__') {
      req.orgView = true
      req.branchId = undefined
    } else if (headerBranch) {
      const branch = await prisma.branch.findFirst({
        where: { id: headerBranch, businessId: membership.businessId },
      })
      if (branch) {
        req.branchId = branch.id
        req.orgView = false
      } else {
        // Stale localStorage from a previous shop/demo — soft-recover instead of 400
        const { ensureMainBranch } = await import('./branchStock.js')
        let fallbackId = membership.branchId
        if (fallbackId) {
          const owned = await prisma.branch.findFirst({
            where: { id: fallbackId, businessId: membership.businessId },
            select: { id: true },
          })
          if (!owned) fallbackId = null
        }
        if (!fallbackId) {
          fallbackId = await ensureMainBranch(membership.businessId)
        }
        if (!fallbackId) {
          return res.status(400).json({ error: 'Unknown branch for this shop' })
        }
        req.branchId = fallbackId
        req.orgView = false
      }
    } else if (membership.branchId) {
      req.branchId = membership.branchId
      req.orgView = false
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

/**
 * Soft commercial gate — plan must include the feature.
 * TRIAL shops are unlocked so evaluation is not plan-limited.
 * Use after requireBusinessMember.
 */
export function requirePlanFeature(feature: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = req.businessId
      if (!businessId) {
        return res.status(403).json({ error: 'Business required' })
      }
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { plan: true, status: true },
      })
      if (!business) {
        return res.status(404).json({ error: 'Business not found' })
      }
      if (business.status === 'TRIAL') return next()
      const { planIncludesFeature } = await import('./plans.js')
      if (planIncludesFeature(business.plan, feature)) return next()
      return res.status(403).json({
        error: `Your plan does not include “${feature}”. Upgrade to unlock it.`,
        feature,
        plan: business.plan,
      })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Plan check failed' })
    }
  }
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
  const { AUDIT_GENESIS, hashAuditPayload } = await import('./auditChain.js')
  const meta = {
    ...(opts.meta && typeof opts.meta === 'object'
      ? (opts.meta as Record<string, unknown>)
      : opts.meta
        ? { value: opts.meta }
        : {}),
    ...(opts.before !== undefined ? { before: opts.before } : {}),
    ...(opts.after !== undefined ? { after: opts.after } : {}),
  }
  const metaJson = JSON.stringify(meta)
  const businessId = opts.businessId || null

  // Transaction serializes prior-hash read + append (reduces chain races under load)
  await prisma.$transaction(async (tx) => {
    const prior = await tx.auditLog.findFirst({
      where: businessId
        ? { businessId, entryHash: { not: null } }
        : { businessId: null, entryHash: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { entryHash: true },
    })
    const prevHash = prior?.entryHash || AUDIT_GENESIS
    const createdAt = new Date()
    const entryHash = hashAuditPayload({
      prevHash,
      action,
      entity: opts.entity,
      entityId: opts.entityId,
      metaJson,
      userId: opts.userId || null,
      businessId,
      createdAtIso: createdAt.toISOString(),
    })

    await tx.auditLog.create({
      data: {
        action,
        businessId,
        userId: opts.userId || null,
        entity: opts.entity,
        entityId: opts.entityId,
        metaJson,
        prevHash,
        entryHash,
        createdAt,
      },
    })
  })
}

/** @deprecated use writeAudit */
export const audit = writeAudit
