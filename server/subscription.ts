import type { Business, BusinessStatus } from '@prisma/client'
import { prisma } from './prisma.js'
import {
  GRACE_DAYS,
  TRIAL_DAYS,
  getPlan,
  isPlanId,
  type PlanId,
} from './plans.js'

export type EntitlementOverrides = {
  maxBranches?: number
  maxUsers?: number
}

export type SubscriptionSnapshot = {
  businessId: string
  plan: PlanId
  planLabel: string
  status: BusinessStatus
  trialEndsAt: string | null
  subscriptionEndsAt: string | null
  graceEndsAt: string | null
  billingProvider: string
  lastPaymentAt: string | null
  lastPaymentRef: string | null
  access: 'ok' | 'trial' | 'grace' | 'blocked'
  accessMessage: string
  /** Full paid access vs limited trial / grace / blocked */
  fullAccess: boolean
  entitlements: {
    maxBranches: number
    maxUsers: number
    features: string[]
    overrides: EntitlementOverrides | null
  }
  priceMonthlyZmw: number
}

export function parseEntitlementOverrides(
  settingsJson: string | null | undefined,
): EntitlementOverrides | null {
  try {
    const settings = JSON.parse(settingsJson || '{}') as {
      entitlementOverrides?: EntitlementOverrides
    }
    const raw = settings.entitlementOverrides
    if (!raw || typeof raw !== 'object') return null
    const out: EntitlementOverrides = {}
    if (
      typeof raw.maxBranches === 'number' &&
      Number.isFinite(raw.maxBranches) &&
      raw.maxBranches >= 1
    ) {
      out.maxBranches = Math.floor(raw.maxBranches)
    }
    if (
      typeof raw.maxUsers === 'number' &&
      Number.isFinite(raw.maxUsers) &&
      raw.maxUsers >= 1
    ) {
      out.maxUsers = Math.floor(raw.maxUsers)
    }
    return Object.keys(out).length ? out : null
  } catch {
    return null
  }
}

export function effectiveEntitlements(business: Business) {
  const plan = getPlan(business.plan)
  const overrides = parseEntitlementOverrides(business.settingsJson)
  return {
    maxBranches: overrides?.maxBranches ?? plan.maxBranches,
    maxUsers: overrides?.maxUsers ?? plan.maxUsers,
    features: plan.features,
    overrides,
  }
}

function asIso(d: Date | null | undefined) {
  return d ? d.toISOString() : null
}

/** Recompute status when trial/sub ends — call on login / member load. */
export async function refreshSubscriptionState(
  businessId: string,
): Promise<Business> {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
  })
  const now = new Date()

  if (
    business.status === 'CANCELLED' ||
    business.status === 'SUSPENDED' ||
    business.status === 'PENDING_APPROVAL'
  ) {
    return business
  }

  // Trial expired → grace then suspend
  if (business.status === 'TRIAL' && business.trialEndsAt) {
    if (now > business.trialEndsAt) {
      const graceEnd =
        business.graceEndsAt ||
        new Date(business.trialEndsAt.getTime() + GRACE_DAYS * 86400000)
      if (now > graceEnd) {
        return prisma.business.update({
          where: { id: businessId },
          data: { status: 'SUSPENDED', graceEndsAt: graceEnd },
        })
      }
      if (!business.graceEndsAt) {
        return prisma.business.update({
          where: { id: businessId },
          data: { graceEndsAt: graceEnd },
        })
      }
    }
  }

  // Paid period ended → grace then suspend
  if (
    business.status === 'ACTIVE' &&
    business.subscriptionEndsAt &&
    now > business.subscriptionEndsAt
  ) {
    const graceEnd =
      business.graceEndsAt ||
      new Date(business.subscriptionEndsAt.getTime() + GRACE_DAYS * 86400000)
    if (now > graceEnd) {
      return prisma.business.update({
        where: { id: businessId },
        data: { status: 'SUSPENDED', graceEndsAt: graceEnd },
      })
    }
    if (!business.graceEndsAt) {
      return prisma.business.update({
        where: { id: businessId },
        data: { graceEndsAt: graceEnd },
      })
    }
  }

  return business
}

export function accessFromBusiness(business: Business): {
  access: SubscriptionSnapshot['access']
  accessMessage: string
} {
  const now = new Date()
  if (business.status === 'PENDING_APPROVAL') {
    return {
      access: 'blocked',
      accessMessage:
        'Your shop is waiting for NEXORA approval. You will be able to sign in once an admin activates it.',
    }
  }
  if (business.status === 'SUSPENDED') {
    return {
      access: 'blocked',
      accessMessage: 'Subscription suspended — contact NEXORA to reactivate.',
    }
  }
  if (business.status === 'CANCELLED') {
    return {
      access: 'blocked',
      accessMessage: 'Subscription cancelled.',
    }
  }
  if (business.status === 'TRIAL') {
    if (business.trialEndsAt && now > business.trialEndsAt) {
      if (business.graceEndsAt && now <= business.graceEndsAt) {
        return {
          access: 'grace',
          accessMessage: 'Trial ended — grace period active. Renew to keep access.',
        }
      }
    }
    return {
      access: 'trial',
      accessMessage: business.trialEndsAt
        ? `Trial until ${business.trialEndsAt.toLocaleDateString()}`
        : 'Trial active',
    }
  }
  if (
    business.status === 'ACTIVE' &&
    business.subscriptionEndsAt &&
    now > business.subscriptionEndsAt &&
    business.graceEndsAt &&
    now <= business.graceEndsAt
  ) {
    return {
      access: 'grace',
      accessMessage: 'Renewal overdue — grace period active.',
    }
  }
  return { access: 'ok', accessMessage: 'Subscription active' }
}

export function snapshotSubscription(business: Business): SubscriptionSnapshot {
  const plan = getPlan(business.plan)
  const { access, accessMessage } = accessFromBusiness(business)
  const entitlements = effectiveEntitlements(business)
  return {
    businessId: business.id,
    plan: isPlanId(business.plan) ? business.plan : 'starter',
    planLabel: plan.label,
    status: business.status,
    trialEndsAt: asIso(business.trialEndsAt),
    subscriptionEndsAt: asIso(business.subscriptionEndsAt),
    graceEndsAt: asIso(business.graceEndsAt),
    billingProvider: business.billingProvider || 'manual',
    lastPaymentAt: asIso(business.lastPaymentAt),
    lastPaymentRef: business.lastPaymentRef,
    access,
    accessMessage,
    fullAccess: access === 'ok',
    entitlements,
    priceMonthlyZmw: plan.priceMonthlyZmw,
  }
}

export function defaultTrialEndsAt(from = new Date()) {
  return new Date(from.getTime() + TRIAL_DAYS * 86400000)
}

export async function assertWithinEntitlement(
  businessId: string,
  kind: 'branches' | 'users',
): Promise<{ ok: true } | { ok: false; error: string }> {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
  })
  const plan = getPlan(business.plan)
  const entitlements = effectiveEntitlements(business)
  if (kind === 'branches') {
    // Branch has no `active` flag — count all branches for this shop
    const count = await prisma.branch.count({
      where: { businessId },
    })
    if (count >= entitlements.maxBranches) {
      return {
        ok: false,
        error: `${plan.label} plan allows ${entitlements.maxBranches} branch${entitlements.maxBranches === 1 ? '' : 'es'}. Upgrade to add more.`,
      }
    }
  }
  if (kind === 'users') {
    const count = await prisma.membership.count({
      where: { businessId, active: true },
    })
    if (count >= entitlements.maxUsers) {
      return {
        ok: false,
        error: `${plan.label} plan allows ${entitlements.maxUsers} users. Upgrade to add more.`,
      }
    }
  }
  return { ok: true }
}

export async function recordSubscriptionEvent(opts: {
  businessId: string
  kind: string
  plan?: string
  amount?: number
  currency?: string
  provider?: string
  externalRef?: string
  note?: string
  actorUserId?: string
}) {
  return prisma.subscriptionEvent.create({
    data: {
      businessId: opts.businessId,
      kind: opts.kind,
      plan: opts.plan,
      amount: opts.amount ?? 0,
      currency: opts.currency ?? 'ZMW',
      provider: opts.provider ?? 'manual',
      externalRef: opts.externalRef,
      note: opts.note,
      actorUserId: opts.actorUserId,
    },
  })
}
