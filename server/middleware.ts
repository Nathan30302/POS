import type { NextFunction, Response } from 'express'
import { verifyToken, type AuthRequest } from './auth.js'
import { prisma } from './prisma.js'

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

/** Loads membership, attaches businessId + role onto the request. */
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
        return res.status(400).json({ error: 'businessId required for platform access' })
      }
      const business = await prisma.business.findUnique({ where: { id: businessId } })
      if (!business) return res.status(404).json({ error: 'Business not found' })
      req.businessId = business.id
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
    })

    if (!membership) {
      return res.status(403).json({ error: 'Membership not found or inactive' })
    }

    req.businessId = membership.businessId
    req.membershipRole = membership.role
    req.auth.role = membership.role
    return next()
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to resolve membership' })
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

export async function audit(
  action: string,
  opts: {
    businessId?: string | null
    userId?: string | null
    entity?: string
    entityId?: string
    meta?: unknown
  } = {},
) {
  await prisma.auditLog.create({
    data: {
      action,
      businessId: opts.businessId || null,
      userId: opts.userId || null,
      entity: opts.entity,
      entityId: opts.entityId,
      metaJson: JSON.stringify(opts.meta || {}),
    },
  })
}
