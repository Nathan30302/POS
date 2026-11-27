import { createHash } from 'node:crypto'

/** Genesis sentinel when no prior chained entry exists for the tenant. */
export const AUDIT_GENESIS = 'GENESIS'

export function hashAuditPayload(parts: {
  prevHash: string
  action: string
  entity: string | null | undefined
  entityId: string | null | undefined
  metaJson: string
  userId: string | null | undefined
  businessId: string | null | undefined
  createdAtIso: string
}): string {
  const material = [
    parts.prevHash,
    parts.action,
    parts.entity || '',
    parts.entityId || '',
    parts.metaJson,
    parts.userId || '',
    parts.businessId || '',
    parts.createdAtIso,
  ].join('|')
  return createHash('sha256').update(material).digest('hex')
}

export function recomputeEntryHash(row: {
  prevHash: string | null
  action: string
  entity: string | null
  entityId: string | null
  metaJson: string
  userId: string | null
  businessId: string | null
  createdAt: Date
}): string {
  return hashAuditPayload({
    prevHash: row.prevHash || AUDIT_GENESIS,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    metaJson: row.metaJson || '{}',
    userId: row.userId,
    businessId: row.businessId,
    createdAtIso: row.createdAt.toISOString(),
  })
}
