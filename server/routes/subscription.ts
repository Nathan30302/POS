import { Router } from 'express'
import { z } from 'zod'
import { listBillingProviders, getBillingProvider } from '../billing/providers.js'
import {
  requireAuth,
  requireBusinessMember,
  requirePlatformSuperAdmin,
  writeAudit,
  type AuthedRequest,
} from '../middleware.js'
import { listPlans, getPlan, isPlanId, TRIAL_DAYS } from '../plans.js'
import { prisma } from '../prisma.js'
import {
  recordSubscriptionEvent,
  refreshSubscriptionState,
  snapshotSubscription,
} from '../subscription.js'

export const subscriptionRouter = Router()

/** Public catalog (authenticated shops + platform). */
subscriptionRouter.get(
  '/plans',
  requireAuth,
  (_req, res) => {
    res.json({
      plans: listPlans(),
      trialDays: TRIAL_DAYS,
      providers: listBillingProviders(),
    })
  },
)

/** Owner/manager: current shop subscription. */
subscriptionRouter.get(
  '/current',
  requireAuth,
  requireBusinessMember,
  async (req: AuthedRequest, res) => {
    const business = await refreshSubscriptionState(req.businessId!)
    const [events, userCount, branchCount] = await Promise.all([
      prisma.subscriptionEvent.findMany({
        where: { businessId: business.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.membership.count({
        where: { businessId: business.id, active: true },
      }),
      prisma.branch.count({ where: { businessId: business.id } }),
    ])
    const subscription = snapshotSubscription(business)
    res.json({
      subscription,
      usage: {
        users: userCount,
        branches: branchCount,
        maxUsers: subscription.entitlements.maxUsers,
        maxBranches: subscription.entitlements.maxBranches,
        canAddUser: userCount < subscription.entitlements.maxUsers,
        canAddBranch: branchCount < subscription.entitlements.maxBranches,
      },
      events,
    })
  },
)

/** Platform: update plan / dates / status / entitlement overrides. */
subscriptionRouter.patch(
  '/platform/businesses/:id',
  requireAuth,
  requirePlatformSuperAdmin,
  async (req: AuthedRequest, res) => {
    const body = z
      .object({
        plan: z.string().optional(),
        status: z
          .enum(['ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED', 'PENDING_APPROVAL'])
          .optional(),
        trialEndsAt: z.string().datetime().nullable().optional(),
        subscriptionEndsAt: z.string().datetime().nullable().optional(),
        graceEndsAt: z.string().datetime().nullable().optional(),
        billingProvider: z.string().optional(),
        maxBranches: z.number().int().min(1).max(500).nullable().optional(),
        maxUsers: z.number().int().min(1).max(5000).nullable().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return res.status(400).json({ error: 'Invalid payload' })
    if (body.data.plan && !isPlanId(body.data.plan)) {
      return res.status(400).json({ error: 'Unknown plan' })
    }

    const before = await prisma.business.findUnique({
      where: { id: req.params.id },
    })
    if (!before) return res.status(404).json({ error: 'Business not found' })

    let settingsJson: string | undefined
    if (
      body.data.maxBranches !== undefined ||
      body.data.maxUsers !== undefined
    ) {
      let settings: Record<string, unknown> = {}
      try {
        settings = JSON.parse(before.settingsJson || '{}') as Record<
          string,
          unknown
        >
      } catch {
        settings = {}
      }
      const prev =
        settings.entitlementOverrides &&
        typeof settings.entitlementOverrides === 'object'
          ? ({
              ...(settings.entitlementOverrides as Record<string, unknown>),
            } as {
              maxBranches?: number
              maxUsers?: number
            })
          : {}
      if (body.data.maxBranches === null) delete prev.maxBranches
      else if (typeof body.data.maxBranches === 'number') {
        prev.maxBranches = body.data.maxBranches
      }
      if (body.data.maxUsers === null) delete prev.maxUsers
      else if (typeof body.data.maxUsers === 'number') {
        prev.maxUsers = body.data.maxUsers
      }
      if (Object.keys(prev).length === 0) {
        delete settings.entitlementOverrides
      } else {
        settings.entitlementOverrides = prev
      }
      settingsJson = JSON.stringify(settings)
    }

    const business = await prisma.business.update({
      where: { id: req.params.id },
      data: {
        plan: body.data.plan,
        status: body.data.status,
        trialEndsAt:
          body.data.trialEndsAt === undefined
            ? undefined
            : body.data.trialEndsAt
              ? new Date(body.data.trialEndsAt)
              : null,
        subscriptionEndsAt:
          body.data.subscriptionEndsAt === undefined
            ? undefined
            : body.data.subscriptionEndsAt
              ? new Date(body.data.subscriptionEndsAt)
              : null,
        graceEndsAt:
          body.data.graceEndsAt === undefined
            ? undefined
            : body.data.graceEndsAt
              ? new Date(body.data.graceEndsAt)
              : null,
        billingProvider: body.data.billingProvider,
        ...(settingsJson !== undefined ? { settingsJson } : {}),
      },
    })

    await recordSubscriptionEvent({
      businessId: business.id,
      kind: 'platform.update',
      plan: business.plan,
      note: `Platform updated subscription`,
      actorUserId: req.auth!.sub,
      provider: business.billingProvider,
    })
    await writeAudit('subscription.platform_update', {
      businessId: business.id,
      userId: req.auth!.sub,
      entity: 'Business',
      entityId: business.id,
      before: { plan: before.plan, status: before.status },
      after: { plan: business.plan, status: business.status },
    })

    res.json({ subscription: snapshotSubscription(business) })
  },
)

/** Platform: record a renewal payment (manual / MoMo / etc.). */
subscriptionRouter.post(
  '/platform/businesses/:id/charge',
  requireAuth,
  requirePlatformSuperAdmin,
  async (req: AuthedRequest, res) => {
    const body = z
      .object({
        period: z.enum(['monthly', 'yearly']).default('monthly'),
        provider: z.string().default('manual'),
        amount: z.number().nonnegative().optional(),
        phone: z.string().optional(),
        note: z.string().max(500).optional(),
        confirm: z.boolean().default(true),
        plan: z.string().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return res.status(400).json({ error: 'Invalid charge' })

    const business = await prisma.business.findUnique({
      where: { id: req.params.id },
    })
    if (!business) return res.status(404).json({ error: 'Business not found' })

    const planId = body.data.plan && isPlanId(body.data.plan)
      ? body.data.plan
      : isPlanId(business.plan)
        ? business.plan
        : 'starter'
    const plan = getPlan(planId)
    const amount =
      body.data.amount ??
      (body.data.period === 'yearly'
        ? plan.priceYearlyZmw
        : plan.priceMonthlyZmw)

    const provider = getBillingProvider(body.data.provider)
    const result = await provider.charge({
      businessId: business.id,
      amount,
      currency: business.currency || 'ZMW',
      plan: planId,
      period: body.data.period,
      phone: body.data.phone,
      note: body.data.note,
    })

    const months = body.data.period === 'yearly' ? 12 : 1
    const base =
      business.subscriptionEndsAt && business.subscriptionEndsAt > new Date()
        ? business.subscriptionEndsAt
        : new Date()
    const ends = new Date(base)
    ends.setMonth(ends.getMonth() + months)

    let updated = business
    if (result.status === 'confirmed' || body.data.confirm) {
      updated = await prisma.business.update({
        where: { id: business.id },
        data: {
          plan: planId,
          status: 'ACTIVE',
          subscriptionEndsAt: ends,
          graceEndsAt: null,
          trialEndsAt: business.trialEndsAt,
          billingProvider: provider.id,
          lastPaymentAt: new Date(),
          lastPaymentRef: result.externalRef || null,
        },
      })
    }

    await recordSubscriptionEvent({
      businessId: business.id,
      kind:
        result.status === 'confirmed' || body.data.confirm
          ? 'payment.confirmed'
          : 'payment.pending',
      plan: planId,
      amount,
      currency: business.currency || 'ZMW',
      provider: provider.id,
      externalRef: result.externalRef,
      note: body.data.note || result.message,
      actorUserId: req.auth!.sub,
    })

    await writeAudit('subscription.charge', {
      businessId: business.id,
      userId: req.auth!.sub,
      entity: 'Business',
      entityId: business.id,
      after: {
        plan: planId,
        amount,
        provider: provider.id,
        status: result.status,
        subscriptionEndsAt: updated.subscriptionEndsAt,
      },
    })

    res.json({
      charge: result,
      subscription: snapshotSubscription(updated),
    })
  },
)

/** Platform helper: start/extend trial. */
subscriptionRouter.post(
  '/platform/businesses/:id/start-trial',
  requireAuth,
  requirePlatformSuperAdmin,
  async (req: AuthedRequest, res) => {
    const rawDays = Number((req.body as { days?: number })?.days)
    const trialDays =
      Number.isFinite(rawDays) && rawDays >= 1 && rawDays <= 90
        ? Math.floor(rawDays)
        : TRIAL_DAYS
    const ends = new Date(Date.now() + trialDays * 86400000)
    const business = await prisma.business.update({
      where: { id: req.params.id },
      data: {
        status: 'TRIAL',
        trialEndsAt: ends,
        graceEndsAt: null,
      },
    })
    await recordSubscriptionEvent({
      businessId: business.id,
      kind: 'trial.start',
      plan: business.plan,
      note: `Trial ${trialDays} days`,
      actorUserId: req.auth!.sub,
    })
    res.json({ subscription: snapshotSubscription(business) })
  },
)
