import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireBusiness, type AuthedRequest } from '../middleware.js'
import { prisma } from '../prisma.js'

export const customersRouter = Router()
customersRouter.use(requireAuth, requireBusiness)

customersRouter.get('/', async (req: AuthedRequest, res) => {
  const q = String(req.query.q || '').trim()
  const customers = await prisma.customer.findMany({
    where: {
      businessId: req.auth!.businessId!,
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
})

customersRouter.post('/', async (req: AuthedRequest, res) => {
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
      businessId: req.auth!.businessId!,
      fullName: body.data.fullName.trim(),
      phone: body.data.phone?.trim() || null,
      email: body.data.email?.trim() || null,
      creditLimit: body.data.creditLimit ?? 0,
      notes: body.data.notes?.trim() || null,
    },
  })
  res.status(201).json({ customer })
})

customersRouter.patch('/:id', async (req: AuthedRequest, res) => {
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
    where: { id: req.params.id, businessId: req.auth!.businessId! },
  })
  if (!existing) return res.status(404).json({ error: 'Customer not found' })

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

customersRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const existing = await prisma.customer.findFirst({
    where: { id: req.params.id, businessId: req.auth!.businessId! },
  })
  if (!existing) return res.status(404).json({ error: 'Customer not found' })
  await prisma.customer.delete({ where: { id: existing.id } })
  res.json({ ok: true })
})
