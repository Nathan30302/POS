import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireBusinessMember, type AuthRequest } from '../middleware.js'
import { prisma } from '../prisma.js'

export const insightsRouter = Router()
insightsRouter.use(requireAuth, requireBusinessMember)

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

  const [sales7, sales14, sales30, products, customers] = await Promise.all([
    prisma.sale.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        createdAt: { gte: start7 },
      },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.sale.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        createdAt: { gte: start14 },
      },
      include: { items: { select: { quantity: true, productName: true } } },
    }),
    prisma.sale.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        createdAt: { gte: start30 },
      },
      select: {
        total: true,
        discount: true,
        subtotal: true,
        paymentMethod: true,
        createdAt: true,
        items: { select: { quantity: true, lineTotal: true, costPrice: true, productName: true } },
      },
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
    prisma.customer.count({ where: { businessId } }),
  ])

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
  const salesToday = sales7.filter((s) => s.createdAt >= startToday)
  const revenueToday = salesToday.reduce((s, sale) => s + sale.total, 0)
  const tickets30 = sales30.length

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
      customers,
      productCount: products.length,
      lowStockCount: products.filter((p) => p.stockQuantity <= p.lowStockThreshold)
        .length,
      inventoryValue,
      series7: [...dayMap.entries()].map(([date, v]) => ({ date, ...v })),
      topProducts,
      rising,
      falling,
      lowStock,
      paymentBreakdown: payBreakdown,
      healthScore: Math.max(
        0,
        Math.min(
          100,
          Math.round(
            72 +
              (revenueToday > 0 ? 8 : 0) +
              (lowStock.length === 0 ? 10 : -Math.min(20, lowStock.length * 4)) +
              (profit30 > 0 ? 10 : -5),
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
  } else {
    answer = `Quick pulse — last 30 days: ZMW ${revenue.toFixed(2)} revenue, ZMW ${profit.toFixed(2)} gross profit, ${sales.length} sales, ${low.length} low-stock SKUs, ${customers.length} customers. Try asking about profit, growth ideas, top sellers, or low stock.`
  }

  res.json({ answer, generatedAt: new Date().toISOString() })
})

insightsRouter.post('/refresh', async (req: AuthRequest, res) => {
  const businessId = req.businessId!
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const products = await prisma.product.findMany({
    where: { businessId, active: true },
    include: {
      saleItems: {
        where: {
          sale: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } },
        },
        select: { quantity: true },
      },
    },
  })

  const generated: Array<{
    kind: string
    title: string
    summary: string
    impact?: string
    action?: string
    severity: string
  }> = []

  for (const p of products) {
    if (p.stockQuantity <= p.lowStockThreshold) {
      generated.push({
        kind: 'low_stock',
        title: `Low stock: ${p.name}`,
        summary: `${p.name} has ${p.stockQuantity} units left (threshold ${p.lowStockThreshold}).`,
        impact: 'Risk of stockout and lost sales',
        action: 'Reorder or receive stock soon',
        severity: p.stockQuantity === 0 ? 'critical' : 'warning',
      })
    }
  }

  for (const p of products) {
    const recentQty = p.saleItems.reduce((s, i) => s + i.quantity, 0)
    if (p.stockQuantity > p.lowStockThreshold * 2 && recentQty === 0) {
      generated.push({
        kind: 'slow_mover',
        title: `Slow mover: ${p.name}`,
        summary: `${p.name} has ${p.stockQuantity} units with no sales in the last 30 days.`,
        impact: 'Tied-up capital and shelf space',
        action: 'Consider a promotion or markdown',
        severity: 'info',
      })
    }
  }

  const highDiscountSales = await prisma.sale.findMany({
    where: {
      businessId,
      status: 'COMPLETED',
      createdAt: { gte: thirtyDaysAgo },
      discount: { gt: 0 },
    },
    select: { discount: true, subtotal: true },
  })

  const risky = highDiscountSales.filter(
    (s) => s.subtotal > 0 && s.discount / s.subtotal >= 0.2,
  )
  if (risky.length >= 3) {
    generated.push({
      kind: 'high_discount_risk',
      title: 'High discount activity',
      summary: `${risky.length} sales in the last 30 days had discounts of 20% or more.`,
      impact: 'Margin erosion risk',
      action: 'Review discount policies and cashier permissions',
      severity: 'warning',
    })
  } else {
    generated.push({
      kind: 'margin_watch',
      title: 'Margins look steady',
      summary: 'No elevated discount pattern detected in the last 30 days.',
      impact: 'Gross margin discipline holding',
      action: 'Keep watching large discounts at the counter',
      severity: 'info',
    })
  }

  const sales30 = await prisma.sale.findMany({
    where: {
      businessId,
      status: 'COMPLETED',
      createdAt: { gte: thirtyDaysAgo },
    },
    include: { items: true },
  })
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
  generated.push({
    kind: 'performance',
    title: '30-day performance pulse',
    summary: `${sales30.length} sales brought in ZMW ${rev.toFixed(2)} with roughly ZMW ${profit.toFixed(2)} gross profit.`,
    impact: rev > 0 ? `${((profit / rev) * 100).toFixed(1)}% gross margin` : 'No sales yet',
    action: 'Open Sell to capture more volume, or review Pulse for slow movers',
    severity: 'info',
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

  res.json({ insights, generated: insights.length })
})
