import { Router } from 'express'
import {
  requireAuth,
  requireBusinessMember,
  requireManager,
  type AuthedRequest,
} from '../middleware.js'
import { prisma } from '../prisma.js'

export const auditRouter = Router()
auditRouter.use(requireAuth, requireBusinessMember, requireManager)

auditRouter.get('/', async (req: AuthedRequest, res) => {
  const take = Math.min(Number(req.query.limit) || 100, 300)
  const action = String(req.query.action || '').trim()
  const logs = await prisma.auditLog.findMany({
    where: {
      businessId: req.businessId!,
      ...(action ? { action: { contains: action } } : {}),
    },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take,
  })

  res.json({
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      createdAt: log.createdAt,
      user: log.user,
      meta: (() => {
        try {
          return JSON.parse(log.metaJson || '{}')
        } catch {
          return {}
        }
      })(),
    })),
  })
})
