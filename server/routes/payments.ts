import { Router } from 'express'
import { z } from 'zod'
import {
  requireAuth,
  requireBusinessMember,
  requirePermission,
  writeAudit,
  type AuthedRequest,
} from '../middleware.js'
import { getPaymentProvider, listPaymentProviders, mapSalePaymentMethod } from '../payments/providers.js'
import { prisma } from '../prisma.js'

export const paymentsRouter = Router()
paymentsRouter.use(requireAuth, requireBusinessMember)

const statusMap = {
  initiated: 'INITIATED',
  pending: 'PENDING',
  confirmed: 'CONFIRMED',
  failed: 'FAILED',
  cancelled: 'CANCELLED',
  reversed: 'REVERSED',
} as const

paymentsRouter.get('/providers', requirePermission('sell'), (_req, res) => {
  res.json({
    providers: listPaymentProviders(),
    note: 'MoMo sandbox needs MOMO_* env keys. Without them, agent/manual fallback is used and payments stay pending until confirmed.',
  })
})

paymentsRouter.post(
  '/initiate',
  requirePermission('sell'),
  async (req: AuthedRequest, res) => {
    const body = z
      .object({
        amount: z.number().positive(),
        currency: z.string().default('ZMW'),
        paymentMethod: z.string(),
        clientRef: z.string().min(8).max(80),
        phone: z.string().optional(),
        saleId: z.string().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return res.status(400).json({ error: 'Invalid payment request' })

    const businessId = req.businessId!
    const existing = await prisma.paymentAttempt.findFirst({
      where: { businessId, clientRef: body.data.clientRef },
    })
    if (existing) {
      return res.json({ payment: existing, deduped: true })
    }

    const providerId = mapSalePaymentMethod(body.data.paymentMethod)
    const provider = getPaymentProvider(providerId)
    const result = await provider.initiate({
      businessId,
      amount: body.data.amount,
      currency: body.data.currency,
      clientRef: body.data.clientRef,
      phone: body.data.phone,
      saleId: body.data.saleId,
    })

    const payment = await prisma.paymentAttempt.create({
      data: {
        businessId,
        saleId: body.data.saleId,
        provider: result.provider,
        status: statusMap[result.status],
        amount: body.data.amount,
        currency: body.data.currency,
        clientRef: body.data.clientRef,
        externalRef: result.externalRef,
        metaJson: JSON.stringify({
          message: result.message,
          manualFallback: result.manualFallback,
          phone: body.data.phone,
        }),
      },
    })

    await writeAudit('payment.initiate', {
      businessId,
      userId: req.auth!.sub,
      entity: 'PaymentAttempt',
      entityId: payment.id,
      after: {
        provider: payment.provider,
        status: payment.status,
        amount: payment.amount,
        manualFallback: result.manualFallback,
      },
    })

    res.status(201).json({
      payment,
      lifecycle: result.status,
      message: result.message,
      manualFallback: result.manualFallback,
    })
  },
)

paymentsRouter.post(
  '/:id/confirm',
  requirePermission('sell'),
  async (req: AuthedRequest, res) => {
    const payment = await prisma.paymentAttempt.findFirst({
      where: { id: req.params.id, businessId: req.businessId! },
    })
    if (!payment) return res.status(404).json({ error: 'Payment not found' })
    if (payment.status === 'CONFIRMED') {
      return res.json({ payment, already: true })
    }

    const updated = await prisma.paymentAttempt.update({
      where: { id: payment.id },
      data: { status: 'CONFIRMED' },
    })

    await writeAudit('payment.confirm', {
      businessId: req.businessId!,
      userId: req.auth!.sub,
      entity: 'PaymentAttempt',
      entityId: payment.id,
      before: { status: payment.status },
      after: { status: 'CONFIRMED' },
    })

    res.json({ payment: updated })
  },
)

/** Webhook-ready stub — verify signatures when a provider is connected. */
paymentsRouter.post('/webhooks/:provider', async (req, res) => {
  // Intentionally open structure; real providers must validate signatures.
  console.info('[payments.webhook]', req.params.provider, {
    keys: Object.keys(req.body || {}),
  })
  res.json({ ok: true, received: true })
})
