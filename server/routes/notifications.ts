import { Router } from 'express'
import {
  requireAuth,
  requireBusinessMember,
  requireManager,
  type AuthedRequest,
} from '../middleware.js'
import { prisma } from '../prisma.js'

export const notificationsRouter = Router()
notificationsRouter.use(requireAuth, requireBusinessMember, requireManager)

notificationsRouter.get('/', async (req: AuthedRequest, res) => {
  const unreadOnly = String(req.query.unread || '') === '1'
  const take = Math.min(Number(req.query.limit) || 40, 100)
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        businessId: req.businessId!,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    }),
    prisma.notification.count({
      where: { businessId: req.businessId!, read: false },
    }),
  ])

  res.json({
    unreadCount,
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      read: n.read,
      createdAt: n.createdAt,
      meta: (() => {
        try {
          return JSON.parse(n.metaJson || '{}')
        } catch {
          return {}
        }
      })(),
    })),
  })
})

notificationsRouter.post('/:id/read', async (req: AuthedRequest, res) => {
  const existing = await prisma.notification.findFirst({
    where: { id: req.params.id, businessId: req.businessId! },
  })
  if (!existing) return res.status(404).json({ error: 'Not found' })
  const notification = await prisma.notification.update({
    where: { id: existing.id },
    data: { read: true },
  })
  res.json({ notification: { id: notification.id, read: notification.read } })
})

notificationsRouter.post('/read-all', async (req: AuthedRequest, res) => {
  await prisma.notification.updateMany({
    where: { businessId: req.businessId!, read: false },
    data: { read: true },
  })
  res.json({ ok: true })
})
