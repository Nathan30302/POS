import { Router } from 'express'
import { z } from 'zod'
import {
  requireAuth,
  requireAnyPermission,
  requireBusinessMember,
  requirePermission,
  writeAudit,
  type AuthedRequest,
} from '../middleware.js'
import { prisma } from '../prisma.js'

export const customersRouter = Router()
customersRouter.use(requireAuth, requireBusinessMember)

const CREDIT_OVERDUE_DAYS = 30

customersRouter.get(
  '/',
  requireAnyPermission('customers', 'sell'),
  async (req: AuthedRequest, res) => {
    const q = String(req.query.q || '').trim()
    const creditOnly = String(req.query.credit || '') === '1'
    const customers = await prisma.customer.findMany({
      where: {
        businessId: req.businessId!,
        active: true,
        ...(creditOnly ? { balance: { gt: 0 } } : {}),
        ...(q
          ? {
              OR: [
                { fullName: { contains: q } },
                { phone: { contains: q } },
                { email: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    })
    res.json({ customers })
  },
)

/** Credit overview for Command / Customers — balances, overdue, history. */
customersRouter.get(
  '/credit-summary',
  requireAnyPermission('customers', 'ledger'),
  async (req: AuthedRequest, res) => {
    const businessId = req.businessId!
    const overdueBefore = new Date(
      Date.now() - CREDIT_OVERDUE_DAYS * 24 * 60 * 60 * 1000,
    )

    const [withBalance, creditSales, recentPayments] = await Promise.all([
      prisma.customer.findMany({
        where: { businessId, active: true, balance: { gt: 0 } },
        orderBy: { balance: 'desc' },
        take: 100,
        select: {
          id: true,
          fullName: true,
          phone: true,
          creditLimit: true,
          balance: true,
          updatedAt: true,
        },
      }),
      prisma.sale.findMany({
        where: {
          businessId,
          paymentMethod: 'CREDIT',
          status: 'COMPLETED',
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          total: true,
          createdAt: true,
          customerId: true,
          receiptNo: true,
          soldBy: { select: { fullName: true } },
          customer: { select: { id: true, fullName: true } },
        },
      }),
      prisma.customerPayment.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          customer: { select: { id: true, fullName: true } },
          recordedBy: { select: { fullName: true } },
        },
      }),
    ])

    const oldestCreditByCustomer = new Map<string, Date>()
    for (const sale of creditSales) {
      if (!sale.customerId) continue
      const prev = oldestCreditByCustomer.get(sale.customerId)
      if (!prev || sale.createdAt < prev) {
        oldestCreditByCustomer.set(sale.customerId, sale.createdAt)
      }
    }

    const outstanding = withBalance.map((c) => {
      const oldest = oldestCreditByCustomer.get(c.id)
      const overdue = Boolean(oldest && oldest < overdueBefore)
      return {
        ...c,
        oldestCreditAt: oldest || null,
        overdue,
        available: Number(Math.max(0, c.creditLimit - c.balance).toFixed(2)),
      }
    })

    const overdue = outstanding.filter((c) => c.overdue)
    const totalOutstanding = outstanding.reduce((s, c) => s + c.balance, 0)

    res.json({
      summary: {
        customersWithBalance: outstanding.length,
        totalOutstanding: Number(totalOutstanding.toFixed(2)),
        overdueCount: overdue.length,
        overdueAmount: Number(
          overdue.reduce((s, c) => s + c.balance, 0).toFixed(2),
        ),
        overdueDays: CREDIT_OVERDUE_DAYS,
      },
      outstanding,
      overdue,
      recentCreditSales: creditSales.slice(0, 30).map((s) => ({
        id: s.id,
        total: s.total,
        createdAt: s.createdAt,
        receiptNo: s.receiptNo,
        customer: s.customer,
        cashier: s.soldBy?.fullName || null,
      })),
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        note: p.note,
        createdAt: p.createdAt,
        customer: p.customer,
        recordedBy: p.recordedBy?.fullName || null,
      })),
    })
  },
)

customersRouter.get(
  '/:id/ledger',
  requireAnyPermission('customers', 'ledger'),
  async (req: AuthedRequest, res) => {
    const businessId = req.businessId!
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, businessId },
    })
    if (!customer) return res.status(404).json({ error: 'Customer not found' })

    const [sales, payments] = await Promise.all([
      prisma.sale.findMany({
        where: {
          businessId,
          customerId: customer.id,
          status: { in: ['COMPLETED', 'VOIDED'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          total: true,
          paymentMethod: true,
          status: true,
          receiptNo: true,
          createdAt: true,
          soldBy: { select: { fullName: true } },
        },
      }),
      prisma.customerPayment.findMany({
        where: { businessId, customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { recordedBy: { select: { fullName: true } } },
      }),
    ])

    const history = [
      ...sales.map((s) => ({
        type: 'sale' as const,
        id: s.id,
        amount: s.total,
        paymentMethod: s.paymentMethod,
        status: s.status,
        receiptNo: s.receiptNo,
        createdAt: s.createdAt,
        actor: s.soldBy?.fullName || null,
      })),
      ...payments.map((p) => ({
        type: 'payment' as const,
        id: p.id,
        amount: p.amount,
        paymentMethod: p.method,
        status: 'COMPLETED',
        receiptNo: null as string | null,
        createdAt: p.createdAt,
        actor: p.recordedBy?.fullName || null,
        note: p.note,
      })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )

    res.json({ customer, history })
  },
)

customersRouter.post('/', requirePermission('customers'), async (req: AuthedRequest, res) => {
  const body = z
    .object({
      fullName: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
      creditLimit: z.number().min(0).optional(),
      notes: z.string().optional(),
    })
    .safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'Invalid customer' })

  const customer = await prisma.customer.create({
    data: {
      businessId: req.businessId!,
      fullName: body.data.fullName.trim(),
      phone: body.data.phone?.trim() || null,
      email: body.data.email?.trim() || null,
      creditLimit: body.data.creditLimit ?? 0,
      notes: body.data.notes?.trim() || null,
    },
  })
  res.status(201).json({ customer })
})

customersRouter.patch('/:id', requirePermission('customers'), async (req: AuthedRequest, res) => {
  const body = z
    .object({
      fullName: z.string().min(1).optional(),
      phone: z.string().optional().nullable(),
      email: z.string().email().optional().or(z.literal('')).nullable(),
      creditLimit: z.number().min(0).optional(),
      loyaltyPts: z.number().int().min(0).optional(),
      notes: z.string().optional().nullable(),
    })
    .safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'Invalid update' })

  const existing = await prisma.customer.findFirst({
    where: { id: req.params.id, businessId: req.businessId!, active: true },
  })
  if (!existing) return res.status(404).json({ error: 'Customer not found' })

  if (
    body.data.creditLimit !== undefined &&
    body.data.creditLimit < existing.balance
  ) {
    return res.status(400).json({
      error: `Credit limit cannot be below outstanding balance (${existing.balance.toFixed(2)})`,
    })
  }

  const customer = await prisma.customer.update({
    where: { id: existing.id },
    data: {
      fullName: body.data.fullName?.trim() ?? existing.fullName,
      phone:
        body.data.phone === undefined
          ? existing.phone
          : body.data.phone?.trim() || null,
      email:
        body.data.email === undefined
          ? existing.email
          : body.data.email?.trim() || null,
      creditLimit: body.data.creditLimit ?? existing.creditLimit,
      loyaltyPts: body.data.loyaltyPts ?? existing.loyaltyPts,
      notes:
        body.data.notes === undefined
          ? existing.notes
          : body.data.notes?.trim() || null,
    },
  })
  res.json({ customer })
})

/** Record a payment against outstanding credit. */
customersRouter.post(
  '/:id/payments',
  requirePermission('customers'),
  async (req: AuthedRequest, res) => {
    const body = z
      .object({
        amount: z.number().positive().max(10_000_000),
        method: z
          .enum(['CASH', 'CARD', 'MTN_MOMO', 'AIRTEL_MONEY', 'BANK_TRANSFER', 'OTHER'])
          .default('CASH'),
        note: z.string().max(300).optional(),
      })
      .safeParse(req.body)
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid payment' })
    }

    const businessId = req.businessId!
    try {
      const result = await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.findFirst({
          where: { id: req.params.id, businessId },
        })
        if (!customer) throw new Error('Customer not found')
        if (customer.balance <= 0) throw new Error('No outstanding balance')
        const amount = Math.min(
          body.data.amount,
          Number(customer.balance.toFixed(2)),
        )
        const payment = await tx.customerPayment.create({
          data: {
            businessId,
            customerId: customer.id,
            amount: Number(amount.toFixed(2)),
            method: body.data.method,
            note: body.data.note?.trim() || null,
            recordedById: req.auth!.sub,
          },
        })
        const updated = await tx.customer.update({
          where: { id: customer.id },
          data: {
            balance: Number((customer.balance - amount).toFixed(2)),
          },
        })
        return { payment, customer: updated }
      })

      await writeAudit('customer.credit_payment', {
        businessId,
        userId: req.auth!.sub,
        entity: 'Customer',
        entityId: result.customer.id,
        after: {
          amount: result.payment.amount,
          method: result.payment.method,
          balance: result.customer.balance,
          customerName: result.customer.fullName,
        },
      })

      res.status(201).json(result)
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Payment failed',
      })
    }
  },
)

customersRouter.delete('/:id', requirePermission('customers'), async (req: AuthedRequest, res) => {
  const existing = await prisma.customer.findFirst({
    where: { id: req.params.id, businessId: req.businessId!, active: true },
  })
  if (!existing) return res.status(404).json({ error: 'Customer not found' })
  if (existing.balance > 0) {
    return res.status(400).json({
      error: 'Clear outstanding credit balance before deleting',
    })
  }
  // Soft-delete — preserve sale history / FK integrity
  await prisma.customer.update({
    where: { id: existing.id },
    data: { active: false },
  })
  await writeAudit('customer.soft_delete', {
    businessId: req.businessId!,
    userId: req.auth!.sub,
    entity: 'Customer',
    entityId: existing.id,
    before: { active: true, fullName: existing.fullName },
    after: { active: false },
  })
  res.json({ ok: true, softDeleted: true })
})
