/**
 * Subscription billing provider abstraction.
 * Core subscription state never hardcodes a PSP — swap providers here.
 */

export type BillingProviderId =
  | 'manual'
  | 'mtn_momo'
  | 'airtel_money'
  | 'stripe_stub'

export type BillingChargeInput = {
  businessId: string
  amount: number
  currency: string
  plan: string
  period: 'monthly' | 'yearly'
  phone?: string
  note?: string
}

export type BillingChargeResult = {
  provider: BillingProviderId
  status: 'pending' | 'confirmed' | 'failed'
  externalRef?: string
  message: string
}

export interface BillingProvider {
  id: BillingProviderId
  label: string
  charge(input: BillingChargeInput): Promise<BillingChargeResult>
}

const manual: BillingProvider = {
  id: 'manual',
  label: 'Manual (cash / agent / bank)',
  async charge(input) {
    return {
      provider: 'manual',
      status: 'confirmed',
      externalRef: `MANUAL-${Date.now()}`,
      message: `Recorded manual payment of ${input.amount} ${input.currency} for ${input.plan} (${input.period}).`,
    }
  },
}

const mtn: BillingProvider = {
  id: 'mtn_momo',
  label: 'MTN MoMo',
  async charge(input) {
    const keyed =
      process.env.MOMO_SUBSCRIPTION_KEY &&
      process.env.MOMO_API_USER &&
      process.env.MOMO_API_KEY
    if (!keyed) {
      return {
        provider: 'mtn_momo',
        status: 'pending',
        externalRef: `MOMO-PEND-${Date.now()}`,
        message:
          'MTN Collection keys not set — mark pending. Confirm agent payment then record as confirmed.',
      }
    }
    return {
      provider: 'mtn_momo',
      status: 'pending',
      externalRef: `MOMO-${Date.now()}`,
      message: `MoMo request-to-pay stub for ${input.amount} ${input.currency} (wire Collection API).`,
    }
  },
}

const airtel: BillingProvider = {
  id: 'airtel_money',
  label: 'Airtel Money',
  async charge(input) {
    return {
      provider: 'airtel_money',
      status: 'pending',
      externalRef: `AIRTEL-${Date.now()}`,
      message: `Airtel Money stub for ${input.amount} ${input.currency} — confirm manually.`,
    }
  },
}

const stripeStub: BillingProvider = {
  id: 'stripe_stub',
  label: 'Card (Stripe stub)',
  async charge(input) {
    return {
      provider: 'stripe_stub',
      status: 'pending',
      externalRef: `STRIPE-STUB-${Date.now()}`,
      message: `Stripe not configured — pending ${input.amount} ${input.currency}.`,
    }
  },
}

const registry: Record<BillingProviderId, BillingProvider> = {
  manual,
  mtn_momo: mtn,
  airtel_money: airtel,
  stripe_stub: stripeStub,
}

export function getBillingProvider(id: string): BillingProvider {
  return registry[id as BillingProviderId] || manual
}

export function listBillingProviders() {
  return Object.values(registry).map((p) => ({ id: p.id, label: p.label }))
}
