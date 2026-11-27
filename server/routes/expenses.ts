import { Router } from 'express'
import { z } from 'zod'
import { LARGE_EXPENSE_THRESHOLD } from '../permissions.js'
import {
  requireAuth,
  requireAnyPermission,
  requireBusinessMember,
  requireManager,
  requirePermission,
  writeAudit,
  type AuthedRequest,
} from '../middleware.js'
import { prisma } from '../prisma.js'

export const expensesRouter = Router()
expensesRouter.use(requireAuth, requireBusinessMember)

const paymentMethods = [
  'CASH',
  'CARD',
  'MTN_MOMO',
  'AIRTEL_MONEY',
  'BANK_TRANSFER',
  'OTHER',
] as const

const CATEGORIES = [
  'Rent',
  'Utilities',
  'Salaries',
  'Transport',
  'Supplies',
  'Marketing',
  'Maintenance',
  'Other',
] as const

function serialize(e: {
  id: string
  category: string
  amount: number
  paymentMethod: string
  note: string | null
  spentAt: Date
  status: string
  createdAt: Date
  branch: { id: string; name: string } | null
  recordedBy: { id: string; fullName: string } | null
  approvedBy: { id: string; fullName: string } | null
  approvedAt: Date | null
}) {
  return {
    id: e.id,
    category: e.category,
    amount: e.amount,
    paymentMethod: e.paymentMethod,
    note: e.note,
    spentAt: e.spentAt,
    status: e.status,
    createdAt: e.createdAt,
    approvedAt: e.approvedAt,
    branch: e.branch,
    recordedBy: e.recordedBy,
    approvedBy: e.approvedBy,
  }
}

const include = {
  branch: { select: { id: true, name: true } },
  recordedBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
} as const

expensesRouter.get(
  '/',
  requireAnyPermission('expenses', 'ledger'),
  async (req: AuthedRequest, res) => {
    const businessId = req.businessId!
    const category =
      typeof req.query.category === 'string' ? req.query.category.trim() : ''
    const status =
      typeof req.query.status === 'string' ? req.query.status.trim() : ''
    const branchId =
      typeof req.query.branchId === 'string' ? req.query.branchId.trim() : ''
    const fromRaw = typeof req.query.from === 'string' ? req.query.from : ''
    const from = fromRaw ? new Date(fromRaw) : null

    const expenses = await prisma.expense.findMany({
      where: {
        businessId,
        ...(category ? { category } : {}),
        ...(status ? { status } : {}),
        ...(branchId
          ? { branchId }
          : req.branchId
            ? { OR: [{ branchId: req.branchId }, { branchId: null }] }
            : {}),
        ...(from && !Number.isNaN(from.getTime())
          ? { spentAt: { gte: from } }
          : {}),
      },
      include,
      orderBy: { spentAt: 'desc' },
      take: 300,
    })

    const counted = expenses.filter((e) =>
      ['RECORDED', 'APPROVED'].includes(e.status),
    )
    const total = counted.reduce((s, e) => s + e.amount, 0)
    const pending = expenses.filter((e) => e.status === 'PENDING_APPROVAL')

    res.json({
      expenses: expenses.map(serialize),
      categories: [...CATEGORIES],
      summary: {
        total: Number(total.toFixed(2)),
        count: counted.length,
        pendingCount: pending.length,
        pendingAmount: Number(
          pending.reduce((s, e) => s + e.amount, 0).toFixed(2),
        ),
        largeThreshold: LARGE_EXPENSE_THRESHOLD,
      },
    })
  },
)

expensesRouter.post(
  '/',
  requirePermission('expenses'),
  async (req: AuthedRequest, res) => {
    const body = z
      .object({
        category: z.string().min(1).max(80),
        amount: z.number().positive().max(10_000_000),
        paymentMethod: z.enum(paymentMethods).default('CASH'),
        note: z.string().max(500).optional(),
        branchId: z.string().min(1).optional(),
        spentAt: z.string().datetime().optional(),
      })
      .safeParse(req.body)
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid expense' })
    }

    const businessId = req.businessId!
    let branchId = body.data.branchId || req.branchId || null
    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, businessId },
      })
      if (!branch) return res.status(400).json({ error: 'Unknown branch' })
    }

    const needsApproval = body.data.amount >= LARGE_EXPENSE_THRESHOLD
    const role = String(req.membershipRole || req.auth?.role || '')
    const isManager = ['OWNER', 'ADMIN', 'BRANCH_MANAGER'].includes(role)
    const status =
      needsApproval && !isManager ? 'PENDING_APPROVAL' : 'RECORDED'

    const expense = await prisma.expense.create({
      data: {
        businessId,
        branchId,
        category: body.data.category.trim(),
        amount: Number(body.data.amount.toFixed(2)),
        paymentMethod: body.data.paymentMethod,
        note: body.data.note?.trim() || null,
        spentAt: body.data.spentAt ? new Date(body.data.spentAt) : new Date(),
        recordedById: req.auth!.sub,
        status,
        approvedById: status === 'RECORDED' && needsApproval ? req.auth!.sub : null,
        approvedAt: status === 'RECORDED' && needsApproval ? new Date() : null,
      },
      include,
    })

    await writeAudit('expense.create', {
      businessId,
      userId: req.auth!.sub,
      entity: 'Expense',
      entityId: expense.id,
      after: {
        category: expense.category,
        amount: expense.amount,
        status: expense.status,
        paymentMethod: expense.paymentMethod,
        branchId,
      },
    })

    res.status(201).json({ expense: serialize(expense) })
  },
)

expensesRouter.post(
  '/:id/approve',
  requireManager,
  async (req: AuthedRequest, res) => {
    const businessId = req.businessId!
    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id, businessId },
    })
    if (!existing) return res.status(404).json({ error: 'Expense not found' })
    if (existing.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ error: 'Expense is not pending approval' })
    }

    const expense = await prisma.expense.update({
      where: { id: existing.id },
      data: {
        status: 'APPROVED',
        approvedById: req.auth!.sub,
        approvedAt: new Date(),
      },
      include,
    })

    await writeAudit('expense.approve', {
      businessId,
      userId: req.auth!.sub,
      entity: 'Expense',
      entityId: expense.id,
      after: { status: 'APPROVED', amount: expense.amount },
    })

    res.json({ expense: serialize(expense) })
  },
)

expensesRouter.post(
  '/:id/reject',
  requireManager,
  async (req: AuthedRequest, res) => {
    const businessId = req.businessId!
    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id, businessId },
    })
    if (!existing) return res.status(404).json({ error: 'Expense not found' })
    if (existing.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ error: 'Expense is not pending approval' })
    }

    const expense = await prisma.expense.update({
      where: { id: existing.id },
      data: {
        status: 'REJECTED',
        approvedById: req.auth!.sub,
        approvedAt: new Date(),
      },
      include,
    })

    await writeAudit('expense.reject', {
      businessId,
      userId: req.auth!.sub,
      entity: 'Expense',
      entityId: expense.id,
      after: { status: 'REJECTED', amount: expense.amount },
    })

    res.json({ expense: serialize(expense) })
  },
)

expensesRouter.delete(
  '/:id',
  requirePermission('expenses'),
  async (req: AuthedRequest, res) => {
    const businessId = req.businessId!
    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id, businessId },
    })
    if (!existing) return res.status(404).json({ error: 'Expense not found' })
    if (existing.status === 'APPROVED' || existing.status === 'RECORDED') {
      const role = String(req.membershipRole || req.auth?.role || '')
      const isManager = ['OWNER', 'ADMIN', 'BRANCH_MANAGER'].includes(role)
      if (!isManager && existing.recordedById !== req.auth!.sub) {
        return res.status(403).json({ error: 'Cannot delete this expense' })
      }
    }
    await prisma.expense.delete({ where: { id: existing.id } })
    await writeAudit('expense.delete', {
      businessId,
      userId: req.auth!.sub,
      entity: 'Expense',
      entityId: existing.id,
      before: { amount: existing.amount, category: existing.category },
    })
    res.json({ ok: true })
  },
)
