import type { NotificationType } from '@prisma/client'
import { prisma } from './prisma.js'

/**
 * Lightweight owner inbox — dedupes same title within 6h so spikes don't spam.
 */
export async function createOwnerAlert(opts: {
  businessId: string
  type?: NotificationType
  title: string
  body: string
  meta?: Record<string, unknown>
}): Promise<void> {
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000)
  const existing = await prisma.notification.findFirst({
    where: {
      businessId: opts.businessId,
      title: opts.title,
      createdAt: { gte: since },
    },
    select: { id: true },
  })
  if (existing) return

  await prisma.notification.create({
    data: {
      businessId: opts.businessId,
      type: opts.type || 'RISK',
      title: opts.title,
      body: opts.body,
      metaJson: JSON.stringify(opts.meta || {}),
    },
  })
}
