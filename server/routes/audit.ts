import { Router } from 'express'
import { recomputeEntryHash } from '../auditChain.js'
import {
  requireAuth,
  requireBusinessMember,
  requireManager,
  type AuthedRequest,
} from '../middleware.js'
import { prisma } from '../prisma.js'

export const auditRouter = Router()
auditRouter.use(requireAuth, requireBusinessMember, requireManager)

/** Append-only: GET list only — no update/delete routes by design. */
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
      entryHash: log.entryHash,
      prevHash: log.prevHash,
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

/**
 * Verify hash chain for this tenant's chained audit rows.
 * Legacy rows (entryHash null) are reported but do not fail the chain.
 */
auditRouter.get('/verify', async (req: AuthedRequest, res) => {
  const businessId = req.businessId!
  const logs = await prisma.auditLog.findMany({
    where: { businessId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      metaJson: true,
      userId: true,
      businessId: true,
      createdAt: true,
      prevHash: true,
      entryHash: true,
    },
  })

  const chained = logs.filter((l) => l.entryHash)
  const legacyCount = logs.length - chained.length
  const breaks: Array<{ id: string; action: string; reason: string }> = []

  for (let i = 0; i < chained.length; i++) {
    const row = chained[i]
    const expected = recomputeEntryHash(row)
    if (row.entryHash !== expected) {
      breaks.push({
        id: row.id,
        action: row.action,
        reason: 'entryHash mismatch — row may have been altered',
      })
      continue
    }
    if (i > 0) {
      const prev = chained[i - 1]
      if (row.prevHash !== prev.entryHash) {
        breaks.push({
          id: row.id,
          action: row.action,
          reason: 'prevHash does not match prior entryHash',
        })
      }
    }
  }

  res.json({
    ok: breaks.length === 0,
    total: logs.length,
    chained: chained.length,
    legacy: legacyCount,
    breaks,
    checkedAt: new Date().toISOString(),
  })
})
