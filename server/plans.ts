/** Commercial plan catalog — entitlements are soft-capped, not fake UI locks. */

export type PlanId = 'starter' | 'growth' | 'business' | 'enterprise'

export type PlanDefinition = {
  id: PlanId
  label: string
  blurb: string
  /** ZMW / month list price (manual billing reference) */
  priceMonthlyZmw: number
  priceYearlyZmw: number
  maxBranches: number
  maxUsers: number
  features: string[]
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: 'starter',
    label: 'Starter',
    blurb: 'One branch · core Sell & inventory',
    priceMonthlyZmw: 199,
    priceYearlyZmw: 1990,
    maxBranches: 1,
    maxUsers: 5,
    features: ['sell', 'inventory', 'ledger', 'customers', 'labels'],
  },
  growth: {
    id: 'growth',
    label: 'Growth',
    blurb: 'More seats · Pulse · Integrity basics',
    priceMonthlyZmw: 449,
    priceYearlyZmw: 4490,
    maxBranches: 2,
    maxUsers: 15,
    features: [
      'sell',
      'inventory',
      'ledger',
      'customers',
      'labels',
      'pulse',
      'integrity',
    ],
  },
  business: {
    id: 'business',
    label: 'Business',
    blurb: 'Multi-branch · transfers · HO view',
    priceMonthlyZmw: 899,
    priceYearlyZmw: 8990,
    maxBranches: 8,
    maxUsers: 50,
    features: [
      'sell',
      'inventory',
      'ledger',
      'customers',
      'labels',
      'pulse',
      'integrity',
      'transfers',
      'purchasing',
      'head_office',
    ],
  },
  enterprise: {
    id: 'enterprise',
    label: 'Enterprise',
    blurb: 'Larger orgs · custom limits',
    priceMonthlyZmw: 0,
    priceYearlyZmw: 0,
    maxBranches: 100,
    maxUsers: 500,
    features: ['all'],
  },
}

export function isPlanId(v: string): v is PlanId {
  return v in PLANS
}

export function getPlan(id: string): PlanDefinition {
  if (isPlanId(id)) return PLANS[id]
  return PLANS.starter
}

export const TRIAL_DAYS = 14
export const GRACE_DAYS = 7

export function listPlans() {
  return Object.values(PLANS)
}

/** Commercial feature keys used by requirePlanFeature. */
export type PlanFeature =
  | 'sell'
  | 'inventory'
  | 'ledger'
  | 'customers'
  | 'labels'
  | 'pulse'
  | 'integrity'
  | 'transfers'
  | 'purchasing'
  | 'head_office'

export function planIncludesFeature(
  planId: string,
  feature: PlanFeature | string,
): boolean {
  const plan = getPlan(planId)
  if (plan.features.includes('all')) return true
  return plan.features.includes(feature)
}
