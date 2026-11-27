import { Router } from 'express'
import { z } from 'zod'
import {
  requireAuth,
  requireBusinessMember,
  requirePermission,
  requirePlanFeature,
  type AuthRequest,
} from '../middleware.js'
import { computeCohorts, forecastRevenue } from '../forecast.js'
import { computeMoneyLeaks } from '../moneyLeaks.js'
import { daysFromNow, EXPIRY_WARN_DAYS, startOfToday } from '../pharmacy.js'
import { prisma } from '../prisma.js'
import { computeBranchHealth, computeCashierTrust } from '../trust.js'

export const insightsRouter = Router()
insightsRouter.use(
  requireAuth,
  requireBusinessMember,
  requirePermission('pulse'),
  requirePlanFeature('pulse'),
)

insightsRouter.get('/', async (req: AuthRequest, res) => {
  const insights = await prisma.businessInsight.findMany({
    where: { businessId: req.businessId!, active: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  res.json({ insights })
})

insightsRouter.get('/pulse', async (req: AuthRequest, res) => {
  const businessId = req.businessId!
  const now = new Date()
  const startToday = new Date(now)
  startToday.setHours(0, 0, 0, 0)
  const start7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const start14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const start30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const scopeBranchId =
    req.orgView || !req.branchId ? null : req.branchId
  const saleBranchFilter = scopeBranchId ? { branchId: scopeBranchId } : {}

  // Single 30-day lean window — derive 7d / 14d in memory (no overlapping payloads)
  const [sales30, products, customerCount, customerRows, trustSales30, branches, shrinkMoves, openConflicts, expiringLots] =
    await Promise.all([
    prisma.sale.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        createdAt: { gte: start30 },
        ...saleBranchFilter,
      },
      select: {
        total: true,
        discount: true,
        subtotal: true,
        paymentMethod: true,
        createdAt: true,
        customerId: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            lineTotal: true,
            costPrice: true,
            productName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.product.findMany({
      where: { businessId, active: true },
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        lowStockThreshold: true,
        costPrice: true,
        sellingPrice: true,
        preferredSupplier: { select: { id: true, name: true } },
      },
    }),
    prisma.customer.count({ where: { businessId } }),
    prisma.customer.findMany({
      where: { businessId },
      select: { id: true, createdAt: true },
    }),
    prisma.sale.findMany({
      where: {
        businessId,
        createdAt: { gte: start30 },
        status: { in: ['COMPLETED', 'VOIDED'] },
        ...saleBranchFilter,
      },
      select: {
        soldById: true,
        branchId: true,
        status: true,
        total: true,
        discount: true,
        subtotal: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.branch.findMany({
      where: { businessId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.stockMovement.findMany({
      where: {
        businessId,
        type: 'ADJUSTMENT',
        quantity: { lt: 0 },
        createdAt: { gte: start30 },
        ...(scopeBranchId ? { branchId: scopeBranchId } : {}),
      },
      select: {
        quantity: true,
        product: { select: { name: true } },
      },
      take: 200,
    }),
    prisma.stockConflict.count({
      where: { businessId, status: 'OPEN' },
    }),
    prisma.productBatch.count({
      where: {
        businessId,
        quantity: { gt: 0 },
        expiryDate: {
          gte: startOfToday(),
          lte: daysFromNow(EXPIRY_WARN_DAYS),
        },
      },
    }),
  ])

  const sales14 = sales30.filter((s) => s.createdAt >= start14)
  const sales7 = sales30.filter((s) => s.createdAt >= start7)

  const dayMap = new Map<string, { revenue: number; tickets: number; profit: number }>()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    dayMap.set(key, { revenue: 0, tickets: 0, profit: 0 })
  }
  for (const sale of sales7) {
    const key = sale.createdAt.toISOString().slice(0, 10)
    const bucket = dayMap.get(key)
    if (!bucket) continue
    const cost = sale.items.reduce((s, i) => s + i.costPrice * i.quantity, 0)
    bucket.revenue += sale.total
    bucket.tickets += 1
    bucket.profit += sale.total - cost
  }

  const productTotals = new Map<string, { name: string; qty: number; revenue: number }>()
  let revenue30 = 0
  let profit30 = 0
  let discount30 = 0
  const payBreakdown: Record<string, number> = {}

  for (const sale of sales30) {
    revenue30 += sale.total
    discount30 += sale.discount
    payBreakdown[sale.paymentMethod] =
      (payBreakdown[sale.paymentMethod] || 0) + sale.total
    for (const item of sale.items) {
      profit30 += item.lineTotal - item.costPrice * item.quantity
      const cur = productTotals.get(item.productName) || {
        name: item.productName,
        qty: 0,
        revenue: 0,
      }
      cur.qty += item.quantity
      cur.revenue += item.lineTotal
      productTotals.set(item.productName, cur)
    }
  }

  const topProducts = [...productTotals.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  const recentMap = new Map<string, number>()
  const priorMap = new Map<string, number>()
  for (const sale of sales14) {
    const bucket = sale.createdAt >= start7 ? recentMap : priorMap
    for (const item of sale.items) {
      bucket.set(
        item.productName,
        (bucket.get(item.productName) || 0) + item.quantity,
      )
    }
  }
  const movers = [...new Set([...recentMap.keys(), ...priorMap.keys()])].map(
    (name) => {
      const recentQty = recentMap.get(name) || 0
      const priorQty = priorMap.get(name) || 0
      const delta = recentQty - priorQty
      const changePct =
        priorQty === 0 ? (recentQty > 0 ? 100 : 0) : (delta / priorQty) * 100
      return { name, recentQty, priorQty, delta, changePct: Number(changePct.toFixed(1)) }
    },
  )
  const rising = [...movers].sort((a, b) => b.delta - a.delta).slice(0, 5)
  const falling = [...movers]
    .filter((m) => m.delta < 0 || (m.priorQty > 0 && m.recentQty === 0))
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 5)

  const lowStock = products
    .filter((p) => p.stockQuantity <= p.lowStockThreshold)
    .sort((a, b) => a.stockQuantity - b.stockQuantity)
    .slice(0, 6)
  const inventoryValue = products.reduce(
    (s, p) => s + p.stockQuantity * p.costPrice,
    0,
  )
  const inventoryValueAtSell = products.reduce(
    (s, p) => s + p.stockQuantity * p.sellingPrice,
    0,
  )

  // Reorder suggestions from 14-day sales velocity + threshold (not guarantees)
  const qtyByProduct14 = new Map<string, number>()
  for (const sale of sales14) {
    for (const item of sale.items) {
      qtyByProduct14.set(
        item.productId,
        (qtyByProduct14.get(item.productId) || 0) + item.quantity,
      )
    }
  }
  const reorderRecommendations = products
    .filter((p) => p.stockQuantity <= p.lowStockThreshold)
    .map((p) => {
      const sold14 = qtyByProduct14.get(p.id) || 0
      const dailyVelocity = sold14 / 14
      const coverDays = 14
      const velocityNeed = Math.ceil(dailyVelocity * coverDays) - p.stockQuantity
      const thresholdNeed = p.lowStockThreshold * 2 - p.stockQuantity
      const suggestedQty = Math.max(0, velocityNeed, thresholdNeed, 1)
      return {
        id: p.id,
        name: p.name,
        stockQuantity: p.stockQuantity,
        lowStockThreshold: p.lowStockThreshold,
        soldLast14Days: sold14,
        dailyVelocity: Number(dailyVelocity.toFixed(2)),
        suggestedQty,
        preferredSupplier: p.preferredSupplier,
        disclaimer:
          'Suggestion based on recent sales velocity and threshold — not a guarantee.',
      }
    })
    .sort((a, b) => a.stockQuantity - b.stockQuantity)
    .slice(0, 12)
  const salesToday = sales7.filter((s) => s.createdAt >= startToday)
  const revenueToday = salesToday.reduce((s, sale) => s + sale.total, 0)
  const tickets30 = sales30.length

  const voids30 = trustSales30
    .filter((s) => s.status === 'VOIDED')
    .map((s) => ({ total: s.total, createdAt: s.createdAt }))
  const shrinkUnits = shrinkMoves.reduce((s, m) => s + Math.abs(m.quantity), 0)
  const shrinkTop = shrinkMoves[0]?.product?.name

  const userIds = [
    ...new Set(
      trustSales30.map((s) => s.soldById).filter((id): id is string => !!id),
    ),
  ]
  const trustUsers =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true },
        })
      : []
  const cashierTrust = computeCashierTrust({
    sales: trustSales30,
    users: trustUsers,
  })
  const branchHealth = computeBranchHealth({
    sales: trustSales30,
    branches,
  })

  const moneyLeaks = computeMoneyLeaks({
    sales30: sales30.map((s) => ({
      total: s.total,
      discount: s.discount,
      subtotal: s.subtotal,
      createdAt: s.createdAt,
      items: s.items,
    })),
    products,
    falling,
    voids30,
    shrink30:
      shrinkUnits > 0
        ? { units: shrinkUnits, productName: shrinkTop }
        : undefined,
    now,
  })
  const leakRiskAmount = moneyLeaks.reduce((s, l) => s + (l.amount || 0), 0)

  const series7 = [...dayMap.entries()].map(([date, v]) => ({ date, ...v }))
  const forecast = forecastRevenue(series7, 7)
  const firstSeen = new Map(
    customerRows.map((c) => [c.id, c.createdAt] as const),
  )
  const cohorts = computeCohorts(
    sales30.map((s) => ({
      customerId: s.customerId,
      total: s.total,
      createdAt: s.createdAt,
    })),
    firstSeen,
    start30,
  )

  res.json({
    pulse: {
      revenueToday,
      ticketsToday: salesToday.length,
      revenue30,
      profit30,
      margin30: revenue30 > 0 ? profit30 / revenue30 : 0,
      discount30,
      avgTicket30: tickets30 > 0 ? revenue30 / tickets30 : 0,
      tickets30,
      customers: customerCount,
      productCount: products.length,
      lowStockCount: products.filter((p) => p.stockQuantity <= p.lowStockThreshold)
        .length,
      inventoryValue,
      inventoryValueAtSell: Number(inventoryValueAtSell.toFixed(2)),
      openStockConflicts: openConflicts,
      expiringLots90: expiringLots,
      series7,
      forecast,
      cohorts,
      topProducts,
      rising,
      falling,
      lowStock,
      reorderRecommendations,
      paymentBreakdown: payBreakdown,
      moneyLeaks,
      leakRiskAmount: Number(leakRiskAmount.toFixed(2)),
      cashierTrust,
      branchHealth,
      healthScore: Math.max(
        0,
        Math.min(
          100,
          Math.round(
            72 +
              (revenueToday > 0 ? 8 : 0) +
              (lowStock.length === 0 ? 10 : -Math.min(20, lowStock.length * 4)) +
              (profit30 > 0 ? 10 : -5) -
              Math.min(15, moneyLeaks.filter((l) => l.severity === 'critical').length * 5) -
              Math.min(8, moneyLeaks.filter((l) => l.severity === 'warning').length * 2) -
              Math.min(10, cashierTrust.filter((c) => c.flag === 'alert').length * 4) -
              Math.min(6, openConflicts > 0 ? 3 : 0),
          ),
        ),
      ),
      generatedAt: new Date().toISOString(),
    },
  })
})

insightsRouter.post('/ask', async (req: AuthRequest, res) => {
  const body = z.object({ question: z.string().min(2) }).safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'Question required' })

  const businessId = req.businessId!
  const q = body.data.question.toLowerCase()
  const start30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const startToday = new Date()
  startToday.setHours(0, 0, 0, 0)

  const [sales, products, customers, expenses] = await Promise.all([
    prisma.sale.findMany({
      where: { businessId, status: 'COMPLETED', createdAt: { gte: start30 } },
      include: { items: true },
    }),
    prisma.product.findMany({ where: { businessId, active: true } }),
    prisma.customer.findMany({ where: { businessId }, take: 100 }),
    prisma.expense.findMany({
      where: { businessId, spentAt: { gte: start30 } },
    }),
  ])

  const revenue = sales.reduce((s, sale) => s + sale.total, 0)
  const cost = sales.reduce(
    (s, sale) =>
      s + sale.items.reduce((a, i) => a + i.costPrice * i.quantity, 0),
    0,
  )
  const profit = revenue - cost
  const todaySales = sales.filter((s) => s.createdAt >= startToday)
  const todayRev = todaySales.reduce((s, sale) => s + sale.total, 0)
  const low = products.filter((p) => p.stockQuantity <= p.lowStockThreshold)
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0)

  const productMap = new Map<string, number>()
  for (const sale of sales) {
    for (const item of sale.items) {
      productMap.set(
        item.productName,
        (productMap.get(item.productName) || 0) + item.lineTotal,
      )
    }
  }
  const top = [...productMap.entries()].sort((a, b) => b[1] - a[1])[0]

  let answer: string
  if (/(profit|margin)/.test(q)) {
    answer = `Over the last 30 days your gross profit is about ZMW ${profit.toFixed(2)} on ZMW ${revenue.toFixed(2)} revenue (${revenue ? ((profit / revenue) * 100).toFixed(1) : 0}% margin). Expenses logged: ZMW ${expenseTotal.toFixed(2)}.`
  } else if (/(today|now)/.test(q) && /(sale|revenue|money|earn)/.test(q)) {
    answer = `Today so far: ${todaySales.length} completed sales totaling ZMW ${todayRev.toFixed(2)}.`
  } else if (/(low stock|out of stock|reorder|stockout)/.test(q)) {
    answer =
      low.length === 0
        ? 'Stock looks healthy — nothing is at or below its reorder threshold right now.'
        : `You have ${low.length} low-stock items. Top concerns: ${low
            .slice(0, 5)
            .map((p) => `${p.name} (${p.stockQuantity} left)`)
            .join(', ')}.`
  } else if (/(best|top|popular|selling)/.test(q)) {
    answer = top
      ? `Your top seller in the last 30 days is ${top[0]} with ZMW ${top[1].toFixed(2)} in sales.`
      : 'Not enough sales history yet to name a top seller.'
  } else if (/(forecast|predict|next week|coming week|projection)/.test(q)) {
    const dayMap = new Map<string, number>()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      dayMap.set(d.toISOString().slice(0, 10), 0)
    }
    for (const sale of sales) {
      const key = sale.createdAt.toISOString().slice(0, 10)
      if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) || 0) + sale.total)
    }
    const fc = forecastRevenue(
      [...dayMap.entries()].map(([date, revenue]) => ({ date, revenue })),
      7,
    )
    answer =
      fc.method === 'insufficient_data'
        ? fc.note
        : `Next-7-day revenue projection: about ZMW ${fc.projectedRevenue.toFixed(2)} (avg ~ZMW ${fc.avgDaily7.toFixed(2)}/day, confidence ${fc.confidence}). ${fc.note}`
  } else if (/(repeat|cohort|returning)/.test(q)) {
    const tagged = sales.filter((s) => s.customerId)
    const byC = new Map<string, number>()
    for (const s of tagged) {
      byC.set(s.customerId!, (byC.get(s.customerId!) || 0) + 1)
    }
    const repeat = [...byC.values()].filter((n) => n >= 2).length
    const rate = byC.size ? ((repeat / byC.size) * 100).toFixed(0) : '0'
    answer = `${byC.size} tagged buyers in 30 days; ${repeat} returned (${rate}% repeat rate). Attach phones on Sell to grow this signal.`
  } else if (/(customer|loyalty|crm)/.test(q)) {
    const loyalty = customers.reduce((s, c) => s + c.loyaltyPts, 0)
    answer = `You have ${customers.length} customers on file with ${loyalty} total loyalty points. Credit balances outstanding: ZMW ${customers.reduce((s, c) => s + c.balance, 0).toFixed(2)}.`
  } else if (/(discount)/.test(q)) {
    const discounted = sales.filter((s) => s.discount > 0)
    const disc = discounted.reduce((s, sale) => s + sale.discount, 0)
    answer = `${discounted.length} sales used discounts in the last 30 days, totaling ZMW ${disc.toFixed(2)} given away.`
  } else if (/(inventory|stock value|catalogue)/.test(q)) {
    const value = products.reduce((s, p) => s + p.stockQuantity * p.costPrice, 0)
    answer = `Active catalogue: ${products.length} products. Estimated inventory cost value: ZMW ${value.toFixed(2)}.`
  } else if (/(grow|improve|suggest|idea|advice)/.test(q)) {
    const tip = top
      ? `Protect stock on ${top[0]} and train staff to recommend it.`
      : 'Focus on increasing tickets first — more completed sales beats guessing.'
    const stockTip =
      low.length > 0
        ? ` Reorder ${low[0].name} before it stockouts.`
        : ' Stock levels look fine right now.'
    answer = `Growth focus: ${tip}${stockTip} Last 30 days delivered ZMW ${revenue.toFixed(2)} revenue and ZMW ${profit.toFixed(2)} gross profit.`
  } else if (/(slow|less|weak|cooling)/.test(q)) {
    const ranked = [...productMap.entries()].sort((a, b) => a[1] - b[1])
    answer =
      ranked.length > 0
        ? `Weakest recent revenue products include ${ranked
            .slice(0, 3)
            .map(([name]) => name)
            .join(', ')}. Bundle them with a top seller or run a short promo.`
        : 'Not enough sales history yet to spot cooling products.'
  } else if (/(leak|bleeding|losing money|where.*money|waste|tied.?up|dead stock)/.test(q)) {
    const leaks = computeMoneyLeaks({
      sales30: sales.map((s) => ({
        total: s.total,
        discount: s.discount,
        subtotal: s.subtotal,
        createdAt: s.createdAt,
        items: s.items,
      })),
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        stockQuantity: p.stockQuantity,
        lowStockThreshold: p.lowStockThreshold,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
      })),
    })
    answer =
      leaks.length === 0
        ? 'No major money leaks flagged from the last 30 days. Keep watching discounts, slow stock, and hot-seller stockouts on Pulse.'
        : `Top money leaks: ${leaks
            .slice(0, 4)
            .map((l) => `${l.title} (${l.amountLabel})`)
            .join('; ')}. Open Pulse → Money leaks to act on each.`
  } else {
    answer = `Quick pulse — last 30 days: ZMW ${revenue.toFixed(2)} revenue, ZMW ${profit.toFixed(2)} gross profit, ${sales.length} sales, ${low.length} low-stock SKUs, ${customers.length} customers. Try asking about money leaks, profit, growth ideas, top sellers, or low stock.`
  }

  res.json({ answer, generatedAt: new Date().toISOString() })
})

insightsRouter.post('/refresh', async (req: AuthRequest, res) => {
  const businessId = req.businessId!
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const start14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const start7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [products, sales30, sales14] = await Promise.all([
    prisma.product.findMany({
      where: { businessId, active: true },
      include: {
        saleItems: {
          where: {
            sale: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } },
          },
          select: { quantity: true },
        },
      },
    }),
    prisma.sale.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        total: true,
        discount: true,
        subtotal: true,
        createdAt: true,
        items: {
          select: {
            quantity: true,
            lineTotal: true,
            costPrice: true,
            productName: true,
          },
        },
      },
    }),
    prisma.sale.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        createdAt: { gte: start14 },
      },
      include: { items: { select: { quantity: true, productName: true } } },
    }),
  ])

  const recentMap = new Map<string, number>()
  const priorMap = new Map<string, number>()
  for (const sale of sales14) {
    const bucket = sale.createdAt >= start7 ? recentMap : priorMap
    for (const item of sale.items) {
      bucket.set(
        item.productName,
        (bucket.get(item.productName) || 0) + item.quantity,
      )
    }
  }
  const falling = [...new Set([...recentMap.keys(), ...priorMap.keys()])]
    .map((name) => {
      const recentQty = recentMap.get(name) || 0
      const priorQty = priorMap.get(name) || 0
      const delta = recentQty - priorQty
      const changePct =
        priorQty === 0 ? (recentQty > 0 ? 100 : 0) : (delta / priorQty) * 100
      return {
        name,
        recentQty,
        priorQty,
        delta,
        changePct: Number(changePct.toFixed(1)),
      }
    })
    .filter((m) => m.delta < 0 || (m.priorQty > 0 && m.recentQty === 0))
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 5)

  const moneyLeaks = computeMoneyLeaks({
    sales30,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      stockQuantity: p.stockQuantity,
      lowStockThreshold: p.lowStockThreshold,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
    })),
    falling,
    now,
  })

  const generated: Array<{
    kind: string
    title: string
    summary: string
    impact?: string
    action?: string
    severity: string
  }> = []

  const ctaAction: Record<string, string> = {
    inventory: 'Open Inventory to restock or reprice',
    sell: 'Open Sell to push a promo or bundle',
    ledger: 'Open Ledger to audit discount tickets',
    pulse: 'Open Pulse to review money leaks',
  }

  for (const leak of moneyLeaks) {
    generated.push({
      kind: `money_leak_${leak.kind}`,
      title: leak.title,
      summary: leak.why,
      impact: leak.amountLabel,
      action: ctaAction[leak.cta] || leak.ctaLabel,
      severity: leak.severity,
    })
  }

  // Keep a few per-SKU stock alerts for the hottest risks only
  const hotNames = new Set(
    moneyLeaks
      .filter((l) => l.kind === 'hot_stockout' && l.productName)
      .map((l) => l.productName!),
  )
  for (const p of products) {
    if (p.stockQuantity > p.lowStockThreshold) continue
    if (hotNames.has(p.name)) continue
    const recentQty = p.saleItems.reduce((s, i) => s + i.quantity, 0)
    if (recentQty === 0 && p.stockQuantity > 0) continue
    generated.push({
      kind: 'low_stock',
      title: `Stock leak risk: ${p.name}`,
      summary: `${p.name} has ${p.stockQuantity} units left (threshold ${p.lowStockThreshold}). Empty shelves lose tickets.`,
      impact: 'Lost sales if it stocks out',
      action: 'Open Inventory to reorder or receive stock',
      severity: p.stockQuantity === 0 ? 'critical' : 'warning',
    })
  }

  // Cap per-SKU low-stock noise
  const lowStockRows = generated.filter((g) => g.kind === 'low_stock')
  if (lowStockRows.length > 4) {
    const keep = new Set(lowStockRows.slice(0, 4))
    for (let i = generated.length - 1; i >= 0; i--) {
      if (generated[i].kind === 'low_stock' && !keep.has(generated[i])) {
        generated.splice(i, 1)
      }
    }
  }

  const rev = sales30.reduce((s, sale) => s + sale.total, 0)
  const profit = sales30.reduce(
    (s, sale) =>
      s +
      sale.items.reduce(
        (a, i) => a + (i.lineTotal - i.costPrice * i.quantity),
        0,
      ),
    0,
  )
  const leakTotal = moneyLeaks.reduce((s, l) => s + (l.amount || 0), 0)
  generated.push({
    kind: 'performance',
    title:
      moneyLeaks.length > 0
        ? 'Profit shield check'
        : '30-day performance pulse',
    summary:
      moneyLeaks.length > 0
        ? `${sales30.length} sales · ZMW ${rev.toFixed(2)} revenue · ~ZMW ${leakTotal.toFixed(2)} flagged across ${moneyLeaks.length} money leak${moneyLeaks.length === 1 ? '' : 's'}.`
        : `${sales30.length} sales brought in ZMW ${rev.toFixed(2)} with roughly ZMW ${profit.toFixed(2)} gross profit. No major leaks flagged.`,
    impact:
      rev > 0
        ? `${((profit / rev) * 100).toFixed(1)}% gross margin`
        : 'No sales yet',
    action:
      moneyLeaks.length > 0
        ? 'Open Pulse to work the money leaks panel'
        : 'Open Sell to capture more volume',
    severity: moneyLeaks.some((l) => l.severity === 'critical')
      ? 'warning'
      : 'info',
  })

  await prisma.$transaction(async (tx) => {
    await tx.businessInsight.updateMany({
      where: { businessId, active: true },
      data: { active: false },
    })
    if (generated.length) {
      await tx.businessInsight.createMany({
        data: generated.map((g) => ({
          businessId,
          kind: g.kind,
          title: g.title,
          summary: g.summary,
          impact: g.impact ?? null,
          action: g.action ?? null,
          severity: g.severity,
          active: true,
        })),
      })
    }
  })

  const insights = await prisma.businessInsight.findMany({
    where: { businessId, active: true },
    orderBy: { createdAt: 'desc' },
  })

  res.json({ insights, generated: insights.length, moneyLeaks })
})

insightsRouter.patch('/:id/status', async (req: AuthRequest, res) => {
  const body = z
    .object({
      status: z.enum(['new', 'in_progress', 'resolved', 'dismissed']),
    })
    .safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'Invalid status' })

  const existing = await prisma.businessInsight.findFirst({
    where: { id: req.params.id, businessId: req.businessId! },
  })
  if (!existing) return res.status(404).json({ error: 'Insight not found' })

  const insight = await prisma.businessInsight.update({
    where: { id: existing.id },
    data: {
      status: body.data.status,
      active:
        body.data.status === 'dismissed' || body.data.status === 'resolved'
          ? false
          : existing.active,
    },
  })
  res.json({ insight })
})

/** Daily business briefing — generated from live tenant data (not fabricated). */
insightsRouter.get('/briefing/today', async (req: AuthRequest, res) => {
  const businessId = req.businessId!
  const now = new Date()
  const dateKey = now.toISOString().slice(0, 10)
  const startToday = new Date(now)
  startToday.setHours(0, 0, 0, 0)

  const cached = await prisma.dailyBriefing.findUnique({
    where: { businessId_dateKey: { businessId, dateKey } },
  })
  if (cached && req.query.refresh !== '1') {
    return res.json({
      briefing: JSON.parse(cached.payloadJson),
      dateKey,
      cached: true,
    })
  }

  const [salesToday, products, customers, openConflicts, insights] =
    await Promise.all([
      prisma.sale.findMany({
        where: {
          businessId,
          status: 'COMPLETED',
          createdAt: { gte: startToday },
        },
        include: { items: true },
      }),
      prisma.product.findMany({ where: { businessId, active: true } }),
      prisma.customer.findMany({
        where: { businessId },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      prisma.stockConflict.findMany({
        where: { businessId, status: 'OPEN' },
        take: 20,
      }),
      prisma.businessInsight.findMany({
        where: { businessId, active: true, status: 'new' },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    ])

  const revenue = salesToday.reduce((s, x) => s + x.total, 0)
  const profit = salesToday.reduce(
    (s, sale) =>
      s +
      sale.items.reduce(
        (a, i) => a + (i.lineTotal - i.costPrice * i.quantity),
        0,
      ),
    0,
  )
  const productSales = new Map<string, number>()
  for (const sale of salesToday) {
    for (const item of sale.items) {
      productSales.set(
        item.productName,
        (productSales.get(item.productName) || 0) + item.lineTotal,
      )
    }
  }
  const top = [...productSales.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  const lowStock = products.filter((p) => p.stockQuantity <= p.lowStockThreshold)
  const owed = customers
    .filter((c) => c.balance > 0)
    .reduce((s, c) => s + c.balance, 0)

  const leakRecs = insights.filter(
    (i) =>
      i.kind.startsWith('money_leak_') ||
      i.kind === 'high_discount_risk' ||
      i.kind === 'slow_mover' ||
      i.kind === 'low_stock',
  )

  const briefing = {
    dateKey,
    generatedAt: new Date().toISOString(),
    salesCount: salesToday.length,
    revenue,
    grossProfit: profit,
    topProducts: top.map(([name, amount]) => ({ name, amount })),
    lowStock: lowStock.map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stockQuantity,
      threshold: p.lowStockThreshold,
    })),
    customerBalanceOwed: owed,
    openStockConflicts: openConflicts.length,
    moneyLeakCount: leakRecs.length,
    moneyLeakTitles: leakRecs.slice(0, 4).map((i) => i.title),
    recommendations: insights.map((i) => ({
      id: i.id,
      title: i.title,
      summary: i.summary,
      action: i.action,
      severity: i.severity,
      priority: i.priority,
      status: i.status,
    })),
    note:
      leakRecs.length > 0
        ? `Protect profit: ${leakRecs.length} money-leak signal${leakRecs.length === 1 ? '' : 's'} open — check Pulse.`
        : 'Figures are calculated from completed sales and current catalogue. Open Pulse for the 7-day revenue forecast.',
  }

  await prisma.dailyBriefing.upsert({
    where: { businessId_dateKey: { businessId, dateKey } },
    create: {
      businessId,
      dateKey,
      payloadJson: JSON.stringify(briefing),
    },
    update: { payloadJson: JSON.stringify(briefing) },
  })

  res.json({ briefing, dateKey, cached: false })
})

insightsRouter.get('/briefing', async (req: AuthRequest, res) => {
  const rows = await prisma.dailyBriefing.findMany({
    where: { businessId: req.businessId! },
    orderBy: { dateKey: 'desc' },
    take: 30,
  })
  res.json({
    briefings: rows.map((r) => ({
      id: r.id,
      dateKey: r.dateKey,
      createdAt: r.createdAt,
      payload: JSON.parse(r.payloadJson || '{}'),
    })),
  })
})
