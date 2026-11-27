import { Router } from 'express'
import { z } from 'zod'
import { ensureBranchStockSeeded, ensureMainBranch } from '../branchStock.js'
import {
  requireAuth,
  requireBusinessMember,
  requireManager,
  writeAudit,
  type AuthedRequest,
} from '../middleware.js'
import { computeMoneyLeaks } from '../moneyLeaks.js'
import { prisma } from '../prisma.js'
import { computeBranchHealth, computeCashierTrust } from '../trust.js'

export const businessRouter = Router()
businessRouter.use(requireAuth, requireBusinessMember)

function startOfDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

businessRouter.get('/me', async (req: AuthedRequest, res) => {
  await ensureMainBranch(req.businessId!)

  const business = await prisma.business.findUnique({
    where: { id: req.businessId! },
    include: { branches: true },
  })
  if (!business) return res.status(404).json({ error: 'Business not found' })

  const settings = JSON.parse(business.settingsJson || '{}') as Record<
    string,
    unknown
  >
  const productCount = await prisma.product.count({
    where: { businessId: business.id, active: true },
  })
  const hasBranch = business.branches.length > 0
  const profileNameSet = Boolean(business.name?.trim())
  const setupDoneAt =
    typeof settings.setupGuideDoneAt === 'string'
      ? settings.setupGuideDoneAt
      : null
  const setupDismissedAt =
    typeof settings.setupGuideDismissedAt === 'string'
      ? settings.setupGuideDismissedAt
      : null
  const progressComplete = hasBranch && productCount >= 1 && profileNameSet

  res.json({
    business: {
      ...business,
      modules: JSON.parse(business.modulesJson || '{}'),
      settings,
      receipt: JSON.parse(business.receiptJson || '{}'),
    },
    setup: {
      hasBranch,
      productCount,
      profileNameSet,
      progressComplete,
      doneAt: setupDoneAt,
      dismissedAt: setupDismissedAt,
      showGuide: !setupDoneAt && !setupDismissedAt && !progressComplete,
    },
  })
})

businessRouter.patch('/me', requireManager, async (req: AuthedRequest, res) => {
  const body = z
    .object({
      name: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      currency: z.string().optional(),
      industry: z.string().max(64).optional(),
      logoUrl: z.string().optional(),
      modules: z.record(z.string(), z.boolean()).optional(),
      settings: z.record(z.string(), z.unknown()).optional(),
      receipt: z.record(z.string(), z.unknown()).optional(),
    })
    .safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'Invalid payload' })

  const current = await prisma.business.findUnique({
    where: { id: req.businessId! },
  })
  if (!current) return res.status(404).json({ error: 'Business not found' })

  const nextIndustry = body.data.industry ?? current.industry
  const industryChanged =
    body.data.industry !== undefined &&
    body.data.industry !== current.industry

  const { modulesForIndustry, settingsForIndustry } = await import(
    '../industries.js'
  )

  let settingsJson = body.data.settings
    ? JSON.stringify({
        ...JSON.parse(current.settingsJson || '{}'),
        ...body.data.settings,
      })
    : current.settingsJson
  let modulesJson = body.data.modules
    ? JSON.stringify({
        ...JSON.parse(current.modulesJson || '{}'),
        ...body.data.modules,
      })
    : current.modulesJson

  if (industryChanged) {
    modulesJson = JSON.stringify(modulesForIndustry(nextIndustry))
    settingsJson = JSON.stringify(
      settingsForIndustry(nextIndustry, JSON.parse(settingsJson || '{}')),
    )
  }

  const business = await prisma.business.update({
    where: { id: current.id },
    data: {
      name: body.data.name ?? current.name,
      phone: body.data.phone ?? current.phone,
      address: body.data.address ?? current.address,
      currency: body.data.currency ?? current.currency,
      industry: nextIndustry,
      logoUrl: body.data.logoUrl ?? current.logoUrl,
      settingsJson,
      modulesJson,
      receiptJson: body.data.receipt
        ? JSON.stringify(body.data.receipt)
        : current.receiptJson,
    },
  })
  await writeAudit('business.update', {
    businessId: current.id,
    userId: req.auth!.sub,
    entity: 'Business',
    entityId: current.id,
    before: {
      name: current.name,
      phone: current.phone,
      industry: current.industry,
    },
    after: {
      name: business.name,
      phone: business.phone,
      industry: business.industry,
    },
  })
  res.json({
    business: {
      ...business,
      modules: JSON.parse(business.modulesJson || '{}'),
      settings: JSON.parse(business.settingsJson || '{}'),
      receipt: JSON.parse(business.receiptJson || '{}'),
    },
  })
})

businessRouter.get('/dashboard', requireManager, async (req: AuthedRequest, res) => {
  const businessId = req.businessId!
  const today = startOfDay()
  const thisMonth = startOfMonth()
  const lastMonth = addMonths(thisMonth, -1)
  const sixMonthsAgo = addMonths(thisMonth, -5)
  const day14 = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
  const day7 = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const day30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const rangeRaw = String(req.query.range || '30d').toLowerCase()
  const range: 'today' | '7d' | '30d' =
    rangeRaw === 'today' || rangeRaw === '7d' || rangeRaw === '30d'
      ? rangeRaw
      : '30d'
  const rangeStart =
    range === 'today' ? today : range === '7d' ? day7 : day30

  const scopeBranchId =
    req.orgView || !req.branchId ? null : req.branchId
  const saleBranchFilter = scopeBranchId
    ? { branchId: scopeBranchId }
    : {}

  await ensureBranchStockSeeded(businessId)

  // One lean sales window (6 months) instead of overlapping full payloads
  const leanSaleSelect = {
    total: true,
    discount: true,
    subtotal: true,
    paymentMethod: true,
    createdAt: true,
    branchId: true,
    items: {
      select: {
        quantity: true,
        lineTotal: true,
        costPrice: true,
        productName: true,
      },
    },
  } as const

  const [
    sales6m,
    products,
    recentSales,
    expensesMonth,
    customers,
    creditCustomers,
    insights,
    trustSales30,
    branches,
    shrinkMoves,
    openConflicts,
    branchStocks,
  ] = await Promise.all([
      prisma.sale.findMany({
        where: {
          businessId,
          status: 'COMPLETED',
          createdAt: { gte: sixMonthsAgo },
          ...saleBranchFilter,
        },
        select: leanSaleSelect,
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
        },
      }),
      prisma.sale.findMany({
        where: { businessId, status: 'COMPLETED', ...saleBranchFilter },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          total: true,
          paymentMethod: true,
          createdAt: true,
          soldBy: { select: { fullName: true } },
          branch: { select: { name: true } },
        },
      }),
      prisma.expense.findMany({
        where: {
          businessId,
          spentAt: { gte: thisMonth },
          status: { in: ['RECORDED', 'APPROVED'] },
        },
        select: { amount: true },
      }),
      prisma.customer.count({ where: { businessId } }),
      prisma.customer.findMany({
        where: { businessId, balance: { gt: 0 } },
        select: { id: true, balance: true, updatedAt: true },
      }),
      prisma.businessInsight.findMany({
        where: { businessId, active: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          severity: true,
          title: true,
          summary: true,
          action: true,
        },
      }),
      prisma.sale.findMany({
        where: {
          businessId,
          createdAt: { gte: day30 },
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
          createdAt: { gte: day30 },
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
      prisma.branchStock.findMany({
        where: { businessId },
        select: {
          branchId: true,
          productId: true,
          quantity: true,
        },
      }),
    ])

  type LeanSale = (typeof sales6m)[number]
  const salesToday: LeanSale[] = []
  const salesThisMonth: LeanSale[] = []
  const salesLastMonth: LeanSale[] = []
  const sales14d: LeanSale[] = []
  const sales30d: LeanSale[] = []
  for (const sale of sales6m) {
    const at = sale.createdAt
    if (at >= day30) sales30d.push(sale)
    if (at >= day14) sales14d.push(sale)
    if (at >= today) salesToday.push(sale)
    if (at >= thisMonth) salesThisMonth.push(sale)
    else if (at >= lastMonth) salesLastMonth.push(sale)
  }

  const sumSales = (rows: LeanSale[]) =>
    rows.reduce((s, x) => s + x.total, 0)
  const sumProfit = (rows: LeanSale[]) =>
    rows.reduce(
      (s, sale) =>
        s +
        sale.items.reduce(
          (a, i) => a + (i.lineTotal - i.costPrice * i.quantity),
          0,
        ),
      0,
    )

  const revenueToday = sumSales(salesToday)
  const profitToday = sumProfit(salesToday)
  const revenueMonth = sumSales(salesThisMonth)
  const profitMonth = sumProfit(salesThisMonth)
  const revenueLastMonth = sumSales(salesLastMonth)
  const profitLastMonth = sumProfit(salesLastMonth)
  const ticketsMonth = salesThisMonth.length
  const ticketsLastMonth = salesLastMonth.length

  const stockByBranchProduct = new Map<string, number>()
  for (const row of branchStocks) {
    stockByBranchProduct.set(`${row.branchId}:${row.productId}`, row.quantity)
  }

  function qtyAtBranch(branchId: string, productId: string) {
    return stockByBranchProduct.get(`${branchId}:${productId}`) ?? 0
  }

  const inventoryValue = scopeBranchId
    ? products.reduce((s, p) => {
        const q = qtyAtBranch(scopeBranchId, p.id)
        return s + p.costPrice * q
      }, 0)
    : products.reduce((s, p) => s + p.costPrice * p.stockQuantity, 0)
  const inventoryValueAtSell = scopeBranchId
    ? products.reduce((s, p) => {
        const q = qtyAtBranch(scopeBranchId, p.id)
        return s + p.sellingPrice * q
      }, 0)
    : products.reduce((s, p) => s + p.sellingPrice * p.stockQuantity, 0)

  const low = (
    scopeBranchId
      ? products
          .map((p) => ({
            ...p,
            stockQuantity: qtyAtBranch(scopeBranchId, p.id),
          }))
          .filter((p) => p.stockQuantity <= p.lowStockThreshold)
      : products.filter((p) => p.stockQuantity <= p.lowStockThreshold)
  ).sort((a, b) => a.stockQuantity - b.stockQuantity)

  // Branch comparison for HO (range window) — sales already unique by id, no double-count
  const compareSales = await prisma.sale.findMany({
    where: {
      businessId,
      createdAt: { gte: rangeStart },
      status: { in: ['COMPLETED', 'VOIDED'] },
    },
    select: {
      id: true,
      branchId: true,
      status: true,
      total: true,
      discount: true,
      subtotal: true,
    },
  })

  const branchComparison = branches.map((b) => {
    const rows = compareSales.filter((s) => s.branchId === b.id)
    const completed = rows.filter((s) => s.status === 'COMPLETED')
    const voided = rows.filter((s) => s.status === 'VOIDED')
    const revenue = completed.reduce((s, x) => s + x.total, 0)
    const tickets = completed.length
    const discountSum = completed.reduce((s, x) => s + x.discount, 0)
    const subtotalSum = completed.reduce((s, x) => s + x.subtotal, 0)
    const voidRate =
      tickets + voided.length > 0
        ? Number(
            ((voided.length / (tickets + voided.length)) * 100).toFixed(1),
          )
        : 0
    const discountRate =
      subtotalSum > 0
        ? Number(((discountSum / subtotalSum) * 100).toFixed(1))
        : 0
    let lowStock = 0
    let stockValue = 0
    for (const p of products) {
      const q = qtyAtBranch(b.id, p.id)
      stockValue += p.costPrice * q
      if (q <= p.lowStockThreshold) lowStock += 1
    }
    return {
      branchId: b.id,
      branchName: b.name,
      revenue: Number(revenue.toFixed(2)),
      tickets,
      voidRate,
      discountRate,
      lowStock,
      stockValue: Number(stockValue.toFixed(2)),
    }
  })

  const paymentBreakdown: Record<string, number> = {}
  for (const sale of salesToday) {
    paymentBreakdown[sale.paymentMethod] =
      (paymentBreakdown[sale.paymentMethod] || 0) + sale.total
  }

  const monthMap = new Map<
    string,
    { label: string; revenue: number; profit: number; tickets: number }
  >()
  for (let i = 5; i >= 0; i--) {
    const d = addMonths(thisMonth, -i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en', { month: 'short' })
    monthMap.set(key, { label, revenue: 0, profit: 0, tickets: 0 })
  }
  for (const sale of sales6m) {
    const d = sale.createdAt
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const bucket = monthMap.get(key)
    if (!bucket) continue
    bucket.revenue += sale.total
    bucket.profit += sale.items.reduce(
      (a, i) => a + (i.lineTotal - i.costPrice * i.quantity),
      0,
    )
    bucket.tickets += 1
  }
  const months = [...monthMap.entries()].map(([key, v]) => ({
    key,
    ...v,
    revenue: Number(v.revenue.toFixed(2)),
    profit: Number(v.profit.toFixed(2)),
  }))

  const recentMap = new Map<string, number>()
  const priorMap = new Map<string, number>()
  for (const sale of sales14d) {
    const bucket = sale.createdAt >= day7 ? recentMap : priorMap
    for (const item of sale.items) {
      bucket.set(item.productName, (bucket.get(item.productName) || 0) + item.quantity)
    }
  }
  const allNames = new Set([...recentMap.keys(), ...priorMap.keys()])
  const movers = [...allNames].map((name) => {
    const recent = recentMap.get(name) || 0
    const prior = priorMap.get(name) || 0
    return {
      name,
      recentQty: recent,
      priorQty: prior,
      delta: recent - prior,
      changePct: pctChange(recent, prior),
    }
  })
  const rising = [...movers].sort((a, b) => b.delta - a.delta).slice(0, 5)
  const falling = [...movers]
    .filter((m) => m.delta < 0 || (m.priorQty > 0 && m.recentQty === 0))
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 5)

  const topMonth = new Map<string, { qty: number; revenue: number }>()
  for (const sale of salesThisMonth) {
    for (const item of sale.items) {
      const cur = topMonth.get(item.productName) || { qty: 0, revenue: 0 }
      cur.qty += item.quantity
      cur.revenue += item.lineTotal
      topMonth.set(item.productName, cur)
    }
  }
  const topProducts = [...topMonth.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  const revenueMom = pctChange(revenueMonth, revenueLastMonth)
  const profitMom = pctChange(profitMonth, profitLastMonth)
  const ticketsMom = pctChange(ticketsMonth, ticketsLastMonth)

  const journal: Array<{
    id: string
    tone: 'growth' | 'risk' | 'focus' | 'win'
    title: string
    body: string
    action?: string
  }> = []

  if (revenueMom > 5) {
    journal.push({
      id: 'mom-up',
      tone: 'growth',
      title: 'Month-to-month revenue is climbing',
      body: `This month you are at ZMW ${revenueMonth.toFixed(2)} vs ZMW ${revenueLastMonth.toFixed(2)} last month (${revenueMom > 0 ? '+' : ''}${revenueMom}%). Keep the winning products visible at the counter.`,
      action: 'Feature your top sellers near checkout',
    })
  } else if (revenueMom < -5) {
    journal.push({
      id: 'mom-down',
      tone: 'risk',
      title: 'Revenue soft vs last month',
      body: `This month is tracking ${revenueMom}% vs last month. Review slow movers and push a small promotion on high-margin items.`,
      action: 'Open Pulse and ask about slow stock',
    })
  } else {
    journal.push({
      id: 'mom-steady',
      tone: 'focus',
      title: 'Revenue is steady month to month',
      body: `You are roughly flat vs last month (${revenueMom > 0 ? '+' : ''}${revenueMom}%). Growth usually comes from either more tickets or a higher average basket.`,
      action: 'Bundle a top seller with a slow mover',
    })
  }

  if (rising[0] && rising[0].delta > 0) {
    journal.push({
      id: 'rising',
      tone: 'win',
      title: `${rising[0].name} is heating up`,
      body: `Units sold rose from ${rising[0].priorQty} to ${rising[0].recentQty} in the last 7 days vs the week before. Protect stock and consider a slight upsell or related bundle.`,
      action: 'Check inventory for this product',
    })
  }

  if (falling[0]) {
    journal.push({
      id: 'falling',
      tone: 'focus',
      title: `${falling[0].name} needs attention`,
      body: `Demand cooled (${falling[0].priorQty} → ${falling[0].recentQty} units week-over-week). Try a shelf move, a short discount, or pair it with a rising product.`,
      action: 'Create a counter combo offer',
    })
  }

  if (low.length) {
    journal.push({
      id: 'stock',
      tone: 'risk',
      title: `${low.length} products near stockout`,
      body: `Top risk: ${low
        .slice(0, 3)
        .map((p) => `${p.name} (${p.stockQuantity})`)
        .join(', ')}. Lost sales here erase growth gains.`,
      action: 'Open Inventory to receive or reorder stock',
    })
  }

  if (topProducts[0]) {
    journal.push({
      id: 'top',
      tone: 'win',
      title: `People keep buying ${topProducts[0].name}`,
      body: `It leads this month with ZMW ${topProducts[0].revenue.toFixed(2)} across ${topProducts[0].qty} units. Double down: never let it stock out, and train staff to suggest it.`,
      action: 'Open Sell to feature it at the counter',
    })
  }

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
    sales30: sales30d,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      stockQuantity: p.stockQuantity,
      lowStockThreshold: p.lowStockThreshold,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
    })),
    falling,
    voids30,
    shrink30:
      shrinkUnits > 0
        ? { units: shrinkUnits, productName: shrinkTop }
        : undefined,
    now: today,
  })
  const leakRiskAmount = moneyLeaks.reduce((s, l) => s + (l.amount || 0), 0)
  const trustAlerts = cashierTrust.filter((c) => c.flag !== 'ok').length
  const branchAlerts = branchHealth.filter((b) => b.flag !== 'ok').length

  for (const leak of moneyLeaks.slice(0, 3)) {
    journal.push({
      id: `leak-${leak.id}`,
      tone: leak.severity === 'info' ? 'focus' : 'risk',
      title: leak.title,
      body: leak.why,
      action: leak.ctaLabel,
    })
  }

  for (const insight of insights.slice(0, 2)) {
    journal.push({
      id: insight.id,
      tone:
        insight.severity === 'critical' || insight.severity === 'warning'
          ? 'risk'
          : 'focus',
      title: insight.title,
      body: insight.summary,
      action: insight.action || undefined,
    })
  }

  const scopeBranch = scopeBranchId
    ? branches.find((b) => b.id === scopeBranchId)
    : null

  res.json({
    scope: {
      mode: scopeBranchId ? 'branch' : 'org',
      branchId: scopeBranchId,
      branchName: scopeBranch?.name || null,
      range,
    },
    summary: {
      revenueToday: Number(revenueToday.toFixed(2)),
      transactionsToday: salesToday.length,
      grossProfitToday: Number(profitToday.toFixed(2)),
      revenueMonth: Number(revenueMonth.toFixed(2)),
      profitMonth: Number(profitMonth.toFixed(2)),
      ticketsMonth,
      revenueLastMonth: Number(revenueLastMonth.toFixed(2)),
      profitLastMonth: Number(profitLastMonth.toFixed(2)),
      ticketsLastMonth,
      revenueMom,
      profitMom,
      ticketsMom,
      avgTicketMonth:
        ticketsMonth > 0
          ? Number((revenueMonth / ticketsMonth).toFixed(2))
          : 0,
      expensesMonth: Number(
        expensesMonth.reduce((s, e) => s + e.amount, 0).toFixed(2),
      ),
      inventoryValue: Number(inventoryValue.toFixed(2)),
      inventoryValueAtSell: Number(inventoryValueAtSell.toFixed(2)),
      productCount: products.length,
      lowStockCount: low.length,
      customerCount: customers,
      creditOutstanding: Number(
        creditCustomers.reduce((s, c) => s + c.balance, 0).toFixed(2),
      ),
      creditOverdueCount: creditCustomers.filter(
        (c) =>
          c.updatedAt.getTime() <
          Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).length,
      leakRiskAmount: Number(leakRiskAmount.toFixed(2)),
      openStockConflicts: openConflicts,
      trustAlerts,
      branchAlerts,
      paymentBreakdown,
      liveAt: new Date().toISOString(),
    },
    branchComparison,
    months,
    rising,
    falling,
    topProducts,
    moneyLeaks,
    cashierTrust,
    branchHealth,
    journal: journal.slice(0, 10),
    lowStock: low.slice(0, 10),
    recentSales: recentSales.map((s) => ({
      id: s.id,
      total: s.total,
      paymentMethod: s.paymentMethod,
      createdAt: s.createdAt,
      cashier: s.soldBy?.fullName || null,
      branchName: s.branch?.name || null,
    })),
  })
})
