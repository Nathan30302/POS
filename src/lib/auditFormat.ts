import { formatZMW } from '@/lib/money'

const ACTION_LABELS: Record<string, string> = {
  'product.create': 'Created product',
  'product.update': 'Updated product',
  'product.deactivate': 'Deactivated product',
  'product.receive_stock': 'Received stock',
  'sale.create': 'Sale completed',
  'sale.void': 'Sale voided',
  'product.stock_shrink': 'Stock decreased',
  'stock_conflict.resolve': 'Resolved stock conflict',
  'shift.open': 'Opened cash shift',
  'shift.close': 'Closed cash shift',
  'branch.create': 'Created branch',
  'branch.update': 'Updated branch',
  'business.update': 'Updated shop settings',
  'team.member_created': 'Added team member',
  'team.member_updated': 'Updated team member',
  'team.member_deactivated': 'Deactivated team member',
  'team.manager_pin_set': 'Set manager PIN',
  'team.manager_pin_cleared': 'Cleared manager PIN',
  'payment.initiate': 'Started payment',
  'payment.confirm': 'Confirmed payment',
  'platform.create_business': 'Created business',
  'platform.update_business': 'Updated business settings',
  'platform.update_business_status': 'Updated business status',
  'self-create': 'Account created',
  'self.create': 'Account created',
}

function titleCaseKey(action: string): string {
  return action
    .replace(/[._-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function auditActionLabel(action: string): string {
  const key = action.trim()
  if (ACTION_LABELS[key]) return ACTION_LABELS[key]
  const lower = key.toLowerCase()
  if (ACTION_LABELS[lower]) return ACTION_LABELS[lower]
  return titleCaseKey(key) || 'Activity'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function str(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function money(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return formatZMW(value)
  if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
    return formatZMW(Number(value))
  }
  return null
}

function pickName(...sources: Array<Record<string, unknown> | null>): string | null {
  for (const src of sources) {
    if (!src) continue
    for (const key of ['name', 'productName', 'product_name', 'branchName', 'fullName']) {
      const v = str(src[key])
      if (v) return v
    }
  }
  return null
}

/** One short line of what changed, when metadata exists. */
export function auditDetailLine(
  action: string,
  meta: Record<string, unknown>,
  entity: string | null,
): string | null {
  const before = asRecord(meta.before)
  const after = asRecord(meta.after)
  const parts: string[] = []

  const name = pickName(after, before, meta)
  if (name) parts.push(name)

  const email = str(meta.email) || str(after?.email) || str(before?.email)
  if (email && !parts.includes(email)) parts.push(email)

  const role = str(meta.role) || str(after?.role)
  if (role) parts.push(role.replace(/_/g, ' '))

  const receipt =
    str(after?.receiptNo) || str(after?.receipt_no) || str(meta.receiptNo)
  if (receipt) parts.push(`Receipt ${receipt}`)

  const cashier =
    str(after?.cashier) || str(before?.cashier) || str(meta.cashier)
  if (cashier) parts.push(cashier)

  const reason =
    str(after?.reason) ||
    str(meta.reason) ||
    str(after?.discountReason) ||
    str(meta.discountReason)
  if (reason) parts.push(`Reason: ${reason}`)

  const total = money(after?.total) || money(meta.total) || money(meta.amount)
  if (total && /sale|payment/i.test(action)) parts.push(total)

  if (/shift\.close/i.test(action)) {
    const expected = money(after?.expectedCash)
    const declared = money(after?.declaredCash)
    const disc = money(after?.discrepancy)
    if (expected) parts.push(`Expected ${expected}`)
    if (declared) parts.push(`Declared ${declared}`)
    if (disc) parts.push(`Δ ${disc}`)
    const discReason = str(after?.discrepancyReason)
    if (discReason) parts.push(`Reason: ${discReason}`)
  }
  if (/shift\.open/i.test(action)) {
    const flt = money(after?.openingFloat)
    if (flt) parts.push(`Float ${flt}`)
  }

  const discount = money(after?.discount)
  if (discount && /sale\.create/i.test(action) && after?.discount) {
    parts.push(`Disc ${discount}`)
  }

  const amount = money(after?.amount) || money(meta.amount)
  if (amount && !parts.includes(amount) && /payment/i.test(action)) {
    parts.push(amount)
  }

  const paymentMethod =
    str(after?.paymentMethod) || str(after?.payment_method) || str(meta.paymentMethod)
  if (paymentMethod) parts.push(paymentMethod)

  const itemCount = after?.itemCount ?? meta.itemCount
  if (typeof itemCount === 'number' && itemCount > 0) {
    parts.push(`${itemCount} item${itemCount === 1 ? '' : 's'}`)
  }

  const received = after?.received ?? meta.received
  if (typeof received === 'number' && Number.isFinite(received)) {
    const from = before?.stockQuantity ?? before?.stock_quantity
    const to = after?.stockQuantity ?? after?.stock_quantity
    if (typeof from === 'number' && typeof to === 'number') {
      parts.push(`+${received} stock (${from} → ${to})`)
    } else {
      parts.push(`+${received} units`)
    }
  } else {
    const stockFrom = before?.stockQuantity ?? before?.stock_quantity
    const stockTo = after?.stockQuantity ?? after?.stock_quantity
    if (
      typeof stockFrom === 'number' &&
      typeof stockTo === 'number' &&
      stockFrom !== stockTo
    ) {
      parts.push(`Stock ${stockFrom} → ${stockTo}`)
    }
  }

  const priceFrom = before?.sellingPrice ?? before?.selling_price
  const priceTo = after?.sellingPrice ?? after?.selling_price
  if (
    typeof priceFrom === 'number' &&
    typeof priceTo === 'number' &&
    priceFrom !== priceTo
  ) {
    parts.push(`Price ${formatZMW(priceFrom)} → ${formatZMW(priceTo)}`)
  }

  const branch =
    str(meta.branchName) ||
    str(meta.branch) ||
    str(after?.branchName) ||
    str(after?.name && entity === 'Branch' ? after.name : null)
  if (branch && entity === 'Branch' && !parts.includes(branch)) {
    parts.push(branch)
  } else if (str(meta.branchName) && !parts.includes(String(meta.branchName))) {
    parts.push(String(meta.branchName))
  }

  const statusFrom = str(before?.status)
  const statusTo = str(after?.status)
  if (statusFrom && statusTo && statusFrom !== statusTo) {
    parts.push(`${statusFrom} → ${statusTo}`)
  } else if (statusTo && /void|conflict|platform|payment/i.test(action)) {
    parts.push(statusTo)
  }

  // Deduplicate while preserving order
  const seen = new Set<string>()
  const unique = parts.filter((p) => {
    const key = p.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (unique.length === 0) return null
  return unique.join(' · ')
}

export function auditFilterLabel(value: string): string {
  if (!value) return 'All'
  const map: Record<string, string> = {
    'sale.': 'Sales',
    'sale.void': 'Voids',
    'shift.': 'Shifts',
    'product.stock_shrink': 'Stock drops',
    'product.': 'Products',
    'team.': 'Team',
    'business.': 'Shop',
    'branch.': 'Branches',
    'payment.': 'Payments',
  }
  return map[value] || titleCaseKey(value.replace(/\.$/, ''))
}
