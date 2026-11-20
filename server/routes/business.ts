import { Router } from 'express'
import { z } from 'zod'
import {
  requireAuth,
  requireBusinessMember,
  requireManager,
  writeAudit,
  type AuthedRequest,
} from '../middleware.js'
import { prisma } from '../prisma.js'

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
  const business = await prisma.business.findUnique({
    where: { id: req.businessId! },
    include: { branches: true },
  })
  if (!business) return res.status(404).json({ error: 'Business not found' })
  res.json({
    business: {
      ...business,
      modules: JSON.parse(business.modulesJson || '{}'),
      settings: JSON.parse(business.settingsJson || '{}'),
      receipt: JSON.parse(business.receiptJson || '{}'),
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

  const business = await prisma.business.update({
    where: { id: current.id },
    data: {
      name: body.data.name ?? current.name,
      phone: body.data.phone ?? current.phone,
      address: body.data.address ?? current.address,
      currency: body.data.currency ?? current.currency,
      logoUrl: body.data.logoUrl ?? current.logoUrl,
      modulesJson: body.data.modules
        ? JSON.stringify(body.data.modules)
        : current.modulesJson,
      settingsJson: body.data.settings
        ? JSON.stringify({
            ...JSON.parse(current.settingsJson || '{}'),
            ...body.data.settings,
          })
        : current.settingsJson,
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
    before: { name: current.name, phone: current.phone },
    after: { name: business.name, phone: business.phone },
  })
  res.json({ business })
})

businessRouter.get('/dashboard', requireManager, async (req: AuthedRequest, res) => {
  const businessId = req.businessId!
  const today = startOfDay()
  const thisMonth = startOfMonth()
  const lastMonth = addMonths(thisMonth, -1)
  const sixMonthsAgo = addMonths(thisMonth, -5)
  const day14 = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
  const day7 = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    salesToday,
    salesThisMonth,
    salesLastMonth,
    sales6m,
    sales14d,
    products,
    recentSales,
    expensesMonth,
    customers,
    insights,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: { businessId, status: 'COMPLETED', createdAt: { gte: today } },
      include: { items: true },
    }),
    prisma.sale.findMany({
      where: { businessId, status: 'COMPLETED', createdAt: { gte: thisMonth } },
      include: { items: true },
    }),
    prisma.sale.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        createdAt: { gte: lastMonth, lt: thisMonth },
      },
      include: { items: true },
    }),
    prisma.sale.findMany({
      where: { businessId, status: 'COMPLETED', createdAt: { gte: sixMonthsAgo } },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.sale.findMany({
      where: { businessId, status: 'COMPLETED', createdAt: { gte: day14 } },
      include: { items: true },
    }),
    prisma.product.findMany({ where: { businessId, active: true } }),
    prisma.sale.findMany({
      where: { businessId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { items: true },
    }),
    prisma.expense.findMany({
      where: { businessId, spentAt: { gte: thisMonth } },
    }),
    prisma.customer.count({ where: { businessId } }),
    prisma.businessInsight.findMany({
      where: { businessId, active: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ])

  const sumSales = (rows: typeof salesToday) =>
    rows.reduce((s, x) => s + x.total, 0)
  const sumProfit = (rows: typeof salesToday) =>
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

  const inventoryValue = products.reduce(
    (s, p) => s + p.costPrice * p.stockQuantity,
    0,
  )
  const low = products
    .filter((p) => p.stockQuantity <= p.lowStockThreshold)
    .sort((a, b) => a.stockQuantity - b.stockQuantity)

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
      action: 'Receive or reorder stock today',
    })
  }

  if (topProducts[0]) {
    journal.push({
      id: 'top',
      tone: 'win',
      title: `People keep buying ${topProducts[0].name}`,
      body: `It leads this month with ZMW ${topProducts[0].revenue.toFixed(2)} across ${topProducts[0].qty} units. Double down: never let it stock out, and train staff to suggest it.`,
      action: 'Pin it as a staff recommendation',
    })
  }

  for (const insight of insights.slice(0, 3)) {
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

  res.json({
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
      productCount: products.length,
      lowStockCount: low.length,
      customerCount: customers,
      paymentBreakdown,
      liveAt: new Date().toISOString(),
    },
    months,
    rising,
    falling,
    topProducts,
    journal: journal.slice(0, 8),
    lowStock: low.slice(0, 10),
    recentSales,
  })
})
