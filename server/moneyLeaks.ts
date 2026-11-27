/**
 * Shop OS money-leak detection from completed sales + catalogue.
 * Surfaces concrete profit risks — not till totals.
 */

export type MoneyLeakKind =
  | 'discount_risk'
  | 'slow_mover'
  | 'hot_stockout'
  | 'cooling'
  | 'thin_margin'
  | 'void_spike'
  | 'stock_shrink'

export type MoneyLeakSeverity = 'critical' | 'warning' | 'info'

export type MoneyLeakCta =
  | 'inventory'
  | 'sell'
  | 'ledger'
  | 'pulse'
  | 'audit'
  | 'conflicts'

export type MoneyLeak = {
  id: string
  kind: MoneyLeakKind
  severity: MoneyLeakSeverity
  title: string
  why: string
  /** Monetary estimate when available (ZMW). */
  amount: number | null
  /** Short severity label for UI (e.g. "High", "ZMW 120"). */
  amountLabel: string
  cta: MoneyLeakCta
  ctaLabel: string
  /** Optional product name for context. */
  productName?: string
}

export type SaleForLeaks = {
  total: number
  discount: number
  subtotal: number
  createdAt: Date
  items: Array<{
    productName: string
    quantity: number
    lineTotal: number
    costPrice: number
  }>
}

export type ProductForLeaks = {
  id: string
  name: string
  stockQuantity: number
  lowStockThreshold: number
  costPrice: number
  sellingPrice: number
}

export type MoverForLeaks = {
  name: string
  recentQty: number
  priorQty: number
  delta: number
  changePct: number
}

export type VoidForLeaks = {
  total: number
  createdAt: Date
}

export type ShrinkForLeaks = {
  units: number
  productName?: string
}

function round2(n: number) {
  return Number(n.toFixed(2))
}

function moneyLabel(n: number) {
  return `ZMW ${round2(n).toFixed(2)}`
}

/**
 * Compute ranked money leaks from live tenant data.
 * Returns at most ~8 high-signal items, sorted critical → warning → info, then amount.
 */
export function computeMoneyLeaks(input: {
  sales30: SaleForLeaks[]
  products: ProductForLeaks[]
  falling?: MoverForLeaks[]
  voids30?: VoidForLeaks[]
  shrink30?: ShrinkForLeaks
  now?: Date
}): MoneyLeak[] {
  const now = input.now ?? new Date()
  const start7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const leaks: MoneyLeak[] = []

  let revenue30 = 0
  let discount30 = 0
  let highDiscountCount = 0
  let highDiscountTotal = 0
  const qtyByName = new Map<string, number>()
  const revenueByName = new Map<string, number>()
  const qty7ByName = new Map<string, number>()

  for (const sale of input.sales30) {
    revenue30 += sale.total
    discount30 += sale.discount
    if (sale.subtotal > 0 && sale.discount / sale.subtotal >= 0.2) {
      highDiscountCount += 1
      highDiscountTotal += sale.discount
    }
    for (const item of sale.items) {
      qtyByName.set(
        item.productName,
        (qtyByName.get(item.productName) || 0) + item.quantity,
      )
      revenueByName.set(
        item.productName,
        (revenueByName.get(item.productName) || 0) + item.lineTotal,
      )
      if (sale.createdAt >= start7) {
        qty7ByName.set(
          item.productName,
          (qty7ByName.get(item.productName) || 0) + item.quantity,
        )
      }
    }
  }

  // 1) Heavy discounts
  const discountShare = revenue30 > 0 ? discount30 / revenue30 : 0
  if (discount30 > 0 && (highDiscountCount >= 2 || discountShare >= 0.05)) {
    const severity: MoneyLeakSeverity =
      highDiscountCount >= 5 || discountShare >= 0.12
        ? 'critical'
        : highDiscountCount >= 3 || discountShare >= 0.08
          ? 'warning'
          : 'info'
    leaks.push({
      id: 'discount_risk',
      kind: 'discount_risk',
      severity,
      title: 'Discount giveaway',
      why:
        highDiscountCount > 0
          ? `${highDiscountCount} sales cut 20%+ off — ${moneyLabel(discount30)} given away in 30 days (${(discountShare * 100).toFixed(1)}% of revenue).`
          : `${moneyLabel(discount30)} in discounts over 30 days (${(discountShare * 100).toFixed(1)}% of revenue).`,
      amount: round2(discount30),
      amountLabel: moneyLabel(discount30),
      cta: 'ledger',
      ctaLabel: 'Open Ledger',
    })
  } else if (highDiscountTotal > 0 && highDiscountCount >= 1) {
    leaks.push({
      id: 'discount_risk',
      kind: 'discount_risk',
      severity: 'info',
      title: 'Discount watch',
      why: `${highDiscountCount} deep-discount sale${highDiscountCount === 1 ? '' : 's'} totaling ${moneyLabel(highDiscountTotal)}.`,
      amount: round2(highDiscountTotal),
      amountLabel: moneyLabel(highDiscountTotal),
      cta: 'ledger',
      ctaLabel: 'Open Ledger',
    })
  }

  // 2) Slow movers — cash tied in dead stock
  const slow: Array<{
    name: string
    stock: number
    tied: number
  }> = []
  for (const p of input.products) {
    const sold = qtyByName.get(p.name) || 0
    if (p.stockQuantity <= 0) continue
    if (sold > 0) continue
    if (p.stockQuantity <= Math.max(1, p.lowStockThreshold)) continue
    const tied = p.stockQuantity * p.costPrice
    if (tied <= 0) continue
    slow.push({ name: p.name, stock: p.stockQuantity, tied })
  }
  slow.sort((a, b) => b.tied - a.tied)
  if (slow.length > 0) {
    const tiedTotal = slow.reduce((s, x) => s + x.tied, 0)
    const top = slow.slice(0, 3)
    const severity: MoneyLeakSeverity =
      tiedTotal >= 500 || slow.length >= 5
        ? 'warning'
        : tiedTotal >= 100
          ? 'info'
          : 'info'
    leaks.push({
      id: 'slow_mover',
      kind: 'slow_mover',
      severity: tiedTotal >= 1000 ? 'critical' : severity,
      title: 'Cash tied in slow stock',
      why: `${slow.length} SKU${slow.length === 1 ? '' : 's'} with zero sales in 30 days — top: ${top
        .map((s) => `${s.name} (${s.stock})`)
        .join(', ')}.`,
      amount: round2(tiedTotal),
      amountLabel: moneyLabel(tiedTotal),
      cta: 'inventory',
      ctaLabel: 'Open Inventory',
      productName: top[0]?.name,
    })
  }

  // 3) Hot sellers low on stock — lost sales risk
  const topNames = [...revenueByName.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name)
  const hotAtRisk: Array<{
    name: string
    stock: number
    revenue: number
    weeklyRate: number
    estimatedRisk: number
  }> = []
  for (const name of topNames) {
    const product = input.products.find((p) => p.name === name)
    if (!product) continue
    if (product.stockQuantity > product.lowStockThreshold) continue
    const weekly = qty7ByName.get(name) || 0
    const revenue = revenueByName.get(name) || 0
    const qty = qtyByName.get(name) || 1
    const avgUnitRev = revenue / qty
    // Rough lost-sales: if weekly rate > stock, risk ≈ shortfall * avg unit revenue
    const shortfall = Math.max(0, weekly - product.stockQuantity)
    const estimatedRisk =
      shortfall > 0
        ? shortfall * avgUnitRev
        : product.stockQuantity === 0
          ? weekly * avgUnitRev
          : avgUnitRev * Math.max(1, Math.ceil(weekly * 0.25))
    hotAtRisk.push({
      name,
      stock: product.stockQuantity,
      revenue,
      weeklyRate: weekly,
      estimatedRisk,
    })
  }
  hotAtRisk.sort((a, b) => b.estimatedRisk - a.estimatedRisk)
  if (hotAtRisk.length > 0) {
    const riskTotal = hotAtRisk.reduce((s, x) => s + x.estimatedRisk, 0)
    const top = hotAtRisk.slice(0, 3)
    const anyOut = hotAtRisk.some((x) => x.stock === 0)
    leaks.push({
      id: 'hot_stockout',
      kind: 'hot_stockout',
      severity: anyOut || riskTotal >= 200 ? 'critical' : 'warning',
      title: 'Hot sellers running dry',
      why: `${top
        .map((x) => `${x.name} (${x.stock} left)`)
        .join(', ')} — top movers near stockout.`,
      amount: round2(riskTotal),
      amountLabel: moneyLabel(riskTotal),
      cta: 'inventory',
      ctaLabel: 'Restock Inventory',
      productName: top[0]?.name,
    })
  }

  // 4) Cooling products
  const falling = (input.falling || []).filter(
    (m) => m.delta < 0 || (m.priorQty > 0 && m.recentQty === 0),
  )
  if (falling.length > 0) {
    const worst = falling.slice(0, 3)
    const priorRevProxy = worst.reduce((s, m) => {
      const unitRev =
        (revenueByName.get(m.name) || 0) / Math.max(1, qtyByName.get(m.name) || 1)
      return s + Math.abs(m.delta) * unitRev
    }, 0)
    leaks.push({
      id: 'cooling',
      kind: 'cooling',
      severity:
        falling[0].changePct <= -50 || falling[0].recentQty === 0
          ? 'warning'
          : 'info',
      title: 'Demand cooling off',
      why: `${worst
        .map((m) => `${m.name} (${m.priorQty}→${m.recentQty})`)
        .join(', ')} — week-over-week drop.`,
      amount: priorRevProxy > 0 ? round2(priorRevProxy) : null,
      amountLabel:
        priorRevProxy > 0
          ? `~${moneyLabel(priorRevProxy)}`
          : `${falling.length} cooling`,
      cta: 'sell',
      ctaLabel: 'Push on Sell',
      productName: worst[0]?.name,
    })
  }

  // 5) Void spike — integrity signal
  const voids = input.voids30 || []
  if (voids.length > 0) {
    const voidValue = voids.reduce((s, v) => s + v.total, 0)
    const completed = input.sales30.length
    const voidRate =
      completed + voids.length > 0
        ? voids.length / (completed + voids.length)
        : 0
    if (voids.length >= 2 || voidRate >= 0.05 || voidValue >= 50) {
      leaks.push({
        id: 'void_spike',
        kind: 'void_spike',
        severity:
          voids.length >= 5 || voidRate >= 0.12
            ? 'critical'
            : voids.length >= 3 || voidRate >= 0.07
              ? 'warning'
              : 'info',
        title: 'Void spike',
        why: `${voids.length} void${voids.length === 1 ? '' : 's'} in 30 days (${moneyLabel(voidValue)}, ${(voidRate * 100).toFixed(1)}% of tickets) — check Trust & Audit.`,
        amount: round2(voidValue),
        amountLabel: moneyLabel(voidValue),
        cta: 'audit',
        ctaLabel: 'Open Audit',
      })
    }
  }

  // 6) Unexplained stock drops (manual adjustments)
  const shrink = input.shrink30
  if (shrink && shrink.units > 0) {
    leaks.push({
      id: 'stock_shrink',
      kind: 'stock_shrink',
      severity:
        shrink.units >= 50 ? 'critical' : shrink.units >= 15 ? 'warning' : 'info',
      title: 'Unexplained stock drop',
      why: `${shrink.units} unit${shrink.units === 1 ? '' : 's'} written down outside sales${
        shrink.productName ? ` — incl. ${shrink.productName}` : ''
      }.`,
      amount: shrink.units,
      amountLabel: `${shrink.units} units`,
      cta: 'inventory',
      ctaLabel: 'Open Inventory',
      productName: shrink.productName,
    })
  }

  // 7) Thin catalogue margins (cost vs selling)
  const thin = input.products
    .filter((p) => p.sellingPrice > 0 && p.costPrice > 0)
    .map((p) => {
      const margin = (p.sellingPrice - p.costPrice) / p.sellingPrice
      return { ...p, margin }
    })
    .filter((p) => p.margin < 0.15)
    .sort((a, b) => a.margin - b.margin)

  if (thin.length > 0) {
    const worst = thin.slice(0, 3)
    const stockAtRisk = thin.reduce(
      (s, p) => s + p.stockQuantity * (p.sellingPrice - p.costPrice),
      0,
    )
    const negative = thin.filter((p) => p.margin <= 0)
    leaks.push({
      id: 'thin_margin',
      kind: 'thin_margin',
      severity: negative.length > 0 ? 'critical' : thin.length >= 3 ? 'warning' : 'info',
      title:
        negative.length > 0
          ? 'Selling below cost'
          : 'Thin catalogue margins',
      why: `${worst
        .map((p) => `${p.name} (${(p.margin * 100).toFixed(0)}%)`)
        .join(', ')} — ${thin.length} SKU${thin.length === 1 ? '' : 's'} under 15% list margin.`,
      amount: stockAtRisk !== 0 ? round2(Math.abs(stockAtRisk)) : null,
      amountLabel:
        negative.length > 0
          ? `${negative.length} at/below cost`
          : `${thin.length} thin`,
      cta: 'inventory',
      ctaLabel: 'Fix prices',
      productName: worst[0]?.name,
    })
  }

  const rank: Record<MoneyLeakSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  }
  return leaks
    .sort((a, b) => {
      const sr = rank[a.severity] - rank[b.severity]
      if (sr !== 0) return sr
      return (b.amount || 0) - (a.amount || 0)
    })
    .slice(0, 8)
}

/** Map leak CTA to in-app path. */
export function leakCtaPath(cta: MoneyLeakCta): string {
  switch (cta) {
    case 'inventory':
      return '/app/products'
    case 'sell':
      return '/app/checkout'
    case 'ledger':
      return '/app/sales'
    case 'audit':
      return '/app/audit'
    case 'conflicts':
      return '/app/conflicts'
    case 'pulse':
    default:
      return '/app/insights'
  }
}
