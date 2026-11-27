import { Router } from 'express'
import { z } from 'zod'
import {
  requireAuth,
  requireBusinessMember,
  requirePermission,
  writeAudit,
  type AuthedRequest,
} from '../middleware.js'
import {
  getPaymentProvider,
  listPaymentProviders,
  mapSalePaymentMethod,
} from '../payments/providers.js'
import { getRequestToPayStatus, momoKeysPresent } from '../payments/momoCollection.js'
import { prisma } from '../prisma.js'

export const paymentsRouter = Router()

const statusMap = {
  initiated: 'INITIATED',
  pending: 'PENDING',
  confirmed: 'CONFIRMED',
  failed: 'FAILED',
  cancelled: 'CANCELLED',
  reversed: 'REVERSED',
} as const

const lifecycleFromDb = {
  INITIATED: 'initiated',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REVERSED: 'reversed',
} as const

paymentsRouter.get(
  '/providers',
  requireAuth,
  requireBusinessMember,
  requirePermission('sell'),
  (_req, res) => {
    res.json({
      providers: listPaymentProviders(),
      momoLive: momoKeysPresent(),
      note: momoKeysPresent()
        ? 'MTN Collection keys detected — request-to-pay will be attempted when phone is provided.'
        : 'MoMo sandbox needs MOMO_* env keys. Without them, agent/manual fallback is used and payments stay pending until confirmed.',
    })
  },
)

paymentsRouter.post(
  '/initiate',
  requireAuth,
  requireBusinessMember,
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
  requireAuth,
  requireBusinessMember,
  // Manual confirm is a trust-sensitive action — not cashiers (sell-only)
  requirePermission('ledger'),
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

/** Poll provider status and sync PaymentAttempt. */
paymentsRouter.post(
  '/:id/poll',
  requireAuth,
  requireBusinessMember,
  requirePermission('sell'),
  async (req: AuthedRequest, res) => {
    const payment = await prisma.paymentAttempt.findFirst({
      where: { id: req.params.id, businessId: req.businessId! },
    })
    if (!payment) return res.status(404).json({ error: 'Payment not found' })
    if (payment.status === 'CONFIRMED' || payment.status === 'FAILED') {
      return res.json({
        payment,
        lifecycle: lifecycleFromDb[payment.status],
        polled: false,
      })
    }

    const provider = getPaymentProvider(payment.provider)
    let lifecycle: keyof typeof statusMap = 'pending'
    if (provider.poll && payment.externalRef) {
      lifecycle = (await provider.poll(payment.externalRef)) as keyof typeof statusMap
    } else if (payment.externalRef && payment.provider.includes('mtn')) {
      const { status } = await getRequestToPayStatus(payment.externalRef)
      if (status === 'confirmed') lifecycle = 'confirmed'
      else if (status === 'failed') lifecycle = 'failed'
      else if (status === 'cancelled') lifecycle = 'cancelled'
    }

    if (lifecycle === 'pending' || lifecycle === 'initiated') {
      return res.json({ payment, lifecycle: 'pending', polled: true })
    }

    const updated = await prisma.paymentAttempt.update({
      where: { id: payment.id },
      data: { status: statusMap[lifecycle] },
    })

    await writeAudit('payment.poll', {
      businessId: req.businessId!,
      userId: req.auth!.sub,
      entity: 'PaymentAttempt',
      entityId: payment.id,
      before: { status: payment.status },
      after: { status: updated.status },
    })

    res.json({ payment: updated, lifecycle, polled: true })
  },
)

/**
 * MoMo / provider webhooks — no JWT (provider callback).
 * Shared secret required in production (boot-enforced); always verified when set.
 */
paymentsRouter.post('/webhooks/:provider', async (req, res) => {
  const provider = String(req.params.provider || '')
  const secret = process.env.MOMO_WEBHOOK_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production'
  if (isProd && !secret) {
    return res.status(503).json({ error: 'Webhook secret not configured' })
  }
  if (secret) {
    const hdr =
      req.header('x-callback-secret') ||
      req.header('authorization')?.replace(/^Bearer\s+/i, '') ||
      ''
    if (hdr !== secret) {
      return res.status(401).json({ error: 'Invalid webhook secret' })
    }
  } else {
    console.warn(
      '[payments.webhook] MOMO_WEBHOOK_SECRET unset — accepting unauthenticated webhook (dev only)',
    )
  }

  const body = (req.body || {}) as Record<string, unknown>
  const ref =
    (typeof body.referenceId === 'string' && body.referenceId) ||
    (typeof body.externalId === 'string' && body.externalId) ||
    (typeof req.header('x-reference-id') === 'string'
      ? req.header('x-reference-id')
      : null)

  const rawStatus = String(
    body.status || body.financialTransactionId || '',
  ).toUpperCase()

  console.info('[payments.webhook]', provider, {
    ref,
    status: rawStatus || Object.keys(body),
  })

  if (!ref) {
    return res.json({ ok: true, received: true, matched: false })
  }

  const payment = await prisma.paymentAttempt.findFirst({
    where: { externalRef: ref },
  })
  if (!payment) {
    return res.json({ ok: true, received: true, matched: false })
  }

  let next: keyof typeof statusMap | null = null
  if (
    rawStatus === 'SUCCESSFUL' ||
    rawStatus === 'SUCCESS' ||
    rawStatus === 'CONFIRMED'
  ) {
    next = 'confirmed'
  } else if (rawStatus === 'FAILED') {
    next = 'failed'
  } else if (
    rawStatus === 'REJECTED' ||
    rawStatus === 'TIMEOUT' ||
    rawStatus === 'CANCELLED'
  ) {
    next = 'cancelled'
  }

  // If body has no status, re-poll Collection API
  if (!next && payment.externalRef && provider.includes('mtn')) {
    try {
      const { status } = await getRequestToPayStatus(payment.externalRef)
      if (status === 'confirmed') next = 'confirmed'
      else if (status === 'failed') next = 'failed'
      else if (status === 'cancelled') next = 'cancelled'
    } catch {
      /* keep pending */
    }
  }

  if (!next || payment.status === statusMap[next]) {
    return res.json({
      ok: true,
      received: true,
      matched: true,
      status: payment.status,
    })
  }

  const updated = await prisma.paymentAttempt.update({
    where: { id: payment.id },
    data: { status: statusMap[next] },
  })

  await writeAudit('payment.webhook', {
    businessId: payment.businessId,
    entity: 'PaymentAttempt',
    entityId: payment.id,
    before: { status: payment.status },
    after: { status: updated.status, provider },
  })

  res.json({ ok: true, received: true, matched: true, status: updated.status })
})
