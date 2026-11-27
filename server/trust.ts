/**
 * Shop integrity signals — per-cashier trust + branch health outliers.
 * Built from sales already tagged with soldById / branchId.
 */

/** Void within this window of sale creation is "soon after sale". */
export const QUICK_VOID_MS = 5 * 60 * 1000

export type CashierTrustRow = {
  userId: string
  fullName: string
  tickets: number
  revenue: number
  discountTotal: number
  discountShare: number
  voidCount: number
  voidValue: number
  voidRate: number
  highDiscountTickets: number
  /** Voids closed within QUICK_VOID_MS of the original sale. */
  quickVoidCount: number
  /** watch | ok | alert */
  flag: 'ok' | 'watch' | 'alert'
  flagReason: string | null
}

export type BranchHealthRow = {
  branchId: string | null
  branchName: string
  tickets: number
  revenue: number
  discountTotal: number
  discountShare: number
  voidCount: number
  voidValue: number
  voidRate: number
  openConflicts: number
  flag: 'ok' | 'watch' | 'alert'
  flagReason: string | null
}

export type SaleForTrust = {
  soldById: string | null
  branchId: string | null
  status: string
  total: number
  discount: number
  subtotal: number
  createdAt?: Date
  updatedAt?: Date
}

export type UserForTrust = {
  id: string
  fullName: string
}

export type BranchForTrust = {
  id: string
  name: string
}

function round2(n: number) {
  return Number(n.toFixed(2))
}

function flagCashier(row: {
  tickets: number
  voidRate: number
  discountShare: number
  highDiscountTickets: number
  voidCount: number
  quickVoidCount: number
}): { flag: 'ok' | 'watch' | 'alert'; flagReason: string | null } {
  if (
    row.tickets < 3 &&
    row.voidCount === 0 &&
    row.highDiscountTickets === 0 &&
    row.quickVoidCount === 0
  ) {
    return { flag: 'ok', flagReason: null }
  }
  if (row.quickVoidCount >= 2) {
    return { flag: 'alert', flagReason: 'Voids soon after sale' }
  }
  if (row.voidRate >= 0.15 || (row.voidCount >= 3 && row.voidRate >= 0.08)) {
    return { flag: 'alert', flagReason: 'High void rate' }
  }
  if (row.discountShare >= 0.12 || row.highDiscountTickets >= 5) {
    return { flag: 'alert', flagReason: 'Heavy discounting' }
  }
  if (row.quickVoidCount >= 1) {
    return { flag: 'watch', flagReason: 'Quick void after sale' }
  }
  if (row.voidRate >= 0.06 || row.discountShare >= 0.06 || row.highDiscountTickets >= 2) {
    return { flag: 'watch', flagReason: 'Elevated voids or discounts' }
  }
  return { flag: 'ok', flagReason: null }
}

export function isQuickVoid(sale: {
  status: string
  createdAt?: Date
  updatedAt?: Date
}): boolean {
  if (sale.status !== 'VOIDED' || !sale.createdAt || !sale.updatedAt) return false
  return sale.updatedAt.getTime() - sale.createdAt.getTime() <= QUICK_VOID_MS
}

function flagBranch(
  row: {
    tickets: number
    voidRate: number
    discountShare: number
    openConflicts: number
  },
  avgDiscountShare: number,
  avgVoidRate: number,
): { flag: 'ok' | 'watch' | 'alert'; flagReason: string | null } {
  if (row.openConflicts >= 5) {
    return { flag: 'alert', flagReason: 'Many open stock conflicts' }
  }
  if (
    row.tickets >= 5 &&
    (row.voidRate >= avgVoidRate * 2.2 + 0.04 || row.voidRate >= 0.12)
  ) {
    return { flag: 'alert', flagReason: 'Void outlier vs other branches' }
  }
  if (
    row.tickets >= 5 &&
    (row.discountShare >= avgDiscountShare * 2 + 0.04 ||
      row.discountShare >= 0.15)
  ) {
    return { flag: 'alert', flagReason: 'Discount outlier vs other branches' }
  }
  if (row.openConflicts >= 2 || row.voidRate >= 0.06 || row.discountShare >= 0.08) {
    return { flag: 'watch', flagReason: 'Needs a closer look' }
  }
  return { flag: 'ok', flagReason: null }
}

export function computeCashierTrust(input: {
  sales: SaleForTrust[]
  users: UserForTrust[]
}): CashierTrustRow[] {
  const byUser = new Map<
    string,
    {
      tickets: number
      revenue: number
      discountTotal: number
      voidCount: number
      voidValue: number
      highDiscountTickets: number
      quickVoidCount: number
    }
  >()

  for (const sale of input.sales) {
    const uid = sale.soldById
    if (!uid) continue
    const cur = byUser.get(uid) || {
      tickets: 0,
      revenue: 0,
      discountTotal: 0,
      voidCount: 0,
      voidValue: 0,
      highDiscountTickets: 0,
      quickVoidCount: 0,
    }
    if (sale.status === 'VOIDED') {
      cur.voidCount += 1
      cur.voidValue += sale.total
      if (isQuickVoid(sale)) cur.quickVoidCount += 1
    } else if (sale.status === 'COMPLETED') {
      cur.tickets += 1
      cur.revenue += sale.total
      cur.discountTotal += sale.discount
      if (sale.subtotal > 0 && sale.discount / sale.subtotal >= 0.2) {
        cur.highDiscountTickets += 1
      }
    }
    byUser.set(uid, cur)
  }

  const nameById = new Map(input.users.map((u) => [u.id, u.fullName]))
  const rows: CashierTrustRow[] = []

  for (const [userId, cur] of byUser) {
    const denom = cur.tickets + cur.voidCount
    const voidRate = denom > 0 ? cur.voidCount / denom : 0
    const discountShare = cur.revenue > 0 ? cur.discountTotal / cur.revenue : 0
    const { flag, flagReason } = flagCashier({
      tickets: cur.tickets,
      voidRate,
      discountShare,
      highDiscountTickets: cur.highDiscountTickets,
      voidCount: cur.voidCount,
      quickVoidCount: cur.quickVoidCount,
    })
    rows.push({
      userId,
      fullName: nameById.get(userId) || 'Unknown',
      tickets: cur.tickets,
      revenue: round2(cur.revenue),
      discountTotal: round2(cur.discountTotal),
      discountShare: round2(discountShare),
      voidCount: cur.voidCount,
      voidValue: round2(cur.voidValue),
      voidRate: round2(voidRate),
      highDiscountTickets: cur.highDiscountTickets,
      quickVoidCount: cur.quickVoidCount,
      flag,
      flagReason,
    })
  }

  const rank = { alert: 0, watch: 1, ok: 2 }
  return rows.sort((a, b) => {
    const fr = rank[a.flag] - rank[b.flag]
    if (fr !== 0) return fr
    if (b.voidCount !== a.voidCount) return b.voidCount - a.voidCount
    return b.discountTotal - a.discountTotal
  })
}

export function computeBranchHealth(input: {
  sales: SaleForTrust[]
  branches: BranchForTrust[]
  openConflictsByBranch?: Map<string | null, number>
}): BranchHealthRow[] {
  const byBranch = new Map<
    string | null,
    {
      tickets: number
      revenue: number
      discountTotal: number
      voidCount: number
      voidValue: number
    }
  >()

  for (const sale of input.sales) {
    const key = sale.branchId
    const cur = byBranch.get(key) || {
      tickets: 0,
      revenue: 0,
      discountTotal: 0,
      voidCount: 0,
      voidValue: 0,
    }
    if (sale.status === 'VOIDED') {
      cur.voidCount += 1
      cur.voidValue += sale.total
    } else if (sale.status === 'COMPLETED') {
      cur.tickets += 1
      cur.revenue += sale.total
      cur.discountTotal += sale.discount
    }
    byBranch.set(key, cur)
  }

  // Ensure known branches appear even with zero sales
  for (const b of input.branches) {
    if (!byBranch.has(b.id)) {
      byBranch.set(b.id, {
        tickets: 0,
        revenue: 0,
        discountTotal: 0,
        voidCount: 0,
        voidValue: 0,
      })
    }
  }

  const nameById = new Map(input.branches.map((b) => [b.id, b.name]))
  const interim: Array<{
    branchId: string | null
    branchName: string
    tickets: number
    revenue: number
    discountTotal: number
    discountShare: number
    voidCount: number
    voidValue: number
    voidRate: number
    openConflicts: number
  }> = []

  for (const [branchId, cur] of byBranch) {
    const denom = cur.tickets + cur.voidCount
    const voidRate = denom > 0 ? cur.voidCount / denom : 0
    const discountShare = cur.revenue > 0 ? cur.discountTotal / cur.revenue : 0
    interim.push({
      branchId,
      branchName: branchId
        ? nameById.get(branchId) || 'Branch'
        : 'Unassigned',
      tickets: cur.tickets,
      revenue: round2(cur.revenue),
      discountTotal: round2(cur.discountTotal),
      discountShare: round2(discountShare),
      voidCount: cur.voidCount,
      voidValue: round2(cur.voidValue),
      voidRate: round2(voidRate),
      openConflicts: input.openConflictsByBranch?.get(branchId) || 0,
    })
  }

  const active = interim.filter((r) => r.tickets + r.voidCount > 0)
  const avgDiscountShare =
    active.length > 0
      ? active.reduce((s, r) => s + r.discountShare, 0) / active.length
      : 0
  const avgVoidRate =
    active.length > 0
      ? active.reduce((s, r) => s + r.voidRate, 0) / active.length
      : 0

  const rank = { alert: 0, watch: 1, ok: 2 }
  return interim
    .map((row) => {
      const { flag, flagReason } = flagBranch(
        row,
        avgDiscountShare,
        avgVoidRate,
      )
      return { ...row, flag, flagReason }
    })
    .sort((a, b) => {
      const fr = rank[a.flag] - rank[b.flag]
      if (fr !== 0) return fr
      return b.revenue - a.revenue
    })
}
