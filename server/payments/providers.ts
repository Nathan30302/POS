import {
  getRequestToPayStatus,
  momoKeysPresent,
  requestToPay,
} from './momoCollection.js'
import type {
  InitiatePaymentInput,
  InitiatePaymentResult,
  PaymentLifecycle,
  PaymentProvider,
  PaymentProviderId,
} from './types.js'

/** Cash is confirmed at the counter immediately. */
const cashProvider: PaymentProvider = {
  id: 'cash',
  label: 'Cash',
  async initiate(input) {
    return {
      provider: 'cash',
      status: 'confirmed',
      externalRef: `CASH-${input.clientRef.slice(0, 8)}`,
      message: 'Cash collected at counter',
      manualFallback: false,
    }
  },
}

/** Manual agent-number path — never auto-confirms MoMo. */
function manualMomo(
  id: 'mtn_momo' | 'airtel_money',
  label: string,
): PaymentProvider {
  return {
    id,
    label,
    async initiate(input) {
      return {
        provider: id,
        status: 'pending',
        externalRef: `MANUAL-${id}-${input.clientRef.slice(0, 8)}`,
        message:
          'Manual mobile money — confirm customer payment against your agent number before marking the sale complete.',
        manualFallback: true,
      }
    },
  }
}

/**
 * Live / sandbox MTN Collection API.
 * Requires MOMO_SUBSCRIPTION_KEY + MOMO_API_USER + MOMO_API_KEY.
 * Without credentials, returns pending + agent fallback.
 */
const mtnCollection: PaymentProvider = {
  id: 'mtn_momo_sandbox',
  label: 'MTN MoMo (Collection)',
  async initiate(input): Promise<InitiatePaymentResult> {
    if (!momoKeysPresent()) {
      return {
        provider: 'mtn_momo_sandbox',
        status: 'pending',
        message:
          'MTN Collection keys not configured (MOMO_SUBSCRIPTION_KEY, MOMO_API_USER, MOMO_API_KEY). Payment stays pending — use agent fallback or set keys.',
        manualFallback: true,
      }
    }
    if (!input.phone?.trim()) {
      return {
        provider: 'mtn_momo_sandbox',
        status: 'pending',
        message:
          'Customer phone required for MoMo request-to-pay — fall back to agent number or enter MSISDN.',
        manualFallback: true,
      }
    }
    try {
      const result = await requestToPay({
        amount: input.amount,
        currency: input.currency,
        phone: input.phone,
        externalId: input.clientRef,
        payerMessage: 'NEXORA payment',
        payeeNote: input.saleId ? `Sale ${input.saleId.slice(0, 12)}` : 'Shop sale',
      })
      if (result.status === 'failed' || !result.referenceId) {
        return {
          provider: 'mtn_momo_sandbox',
          status: 'pending',
          message: `${result.message} — use agent fallback.`,
          manualFallback: true,
        }
      }
      return {
        provider: 'mtn_momo_sandbox',
        status: 'pending',
        externalRef: result.referenceId,
        message: result.message,
        manualFallback: false,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'MoMo error'
      return {
        provider: 'mtn_momo_sandbox',
        status: 'pending',
        message: `${msg} — use agent fallback.`,
        manualFallback: true,
      }
    }
  },
  async poll(externalRef): Promise<PaymentLifecycle> {
    if (!externalRef) return 'pending'
    try {
      const { status } = await getRequestToPayStatus(externalRef)
      if (status === 'confirmed') return 'confirmed'
      if (status === 'failed') return 'failed'
      if (status === 'cancelled') return 'cancelled'
      return 'pending'
    } catch {
      return 'pending'
    }
  },
}

/** When live keys exist and MOMO_USE_SANDBOX is not forced off, prefer Collection. */
const mtnLiveOrManual: PaymentProvider = {
  id: 'mtn_momo',
  label: 'MTN MoMo',
  async initiate(input) {
    if (momoKeysPresent() && process.env.MOMO_FORCE_MANUAL !== '1') {
      const live = await mtnCollection.initiate(input)
      return { ...live, provider: 'mtn_momo' }
    }
    return manualMomo('mtn_momo', 'MTN MoMo').initiate(input)
  },
  async poll(externalRef) {
    if (mtnCollection.poll) return mtnCollection.poll(externalRef)
    return 'pending'
  },
}

const cardProvider: PaymentProvider = {
  id: 'card',
  label: 'Card',
  async initiate(input) {
    return {
      provider: 'card',
      status: 'pending',
      externalRef: `CARD-${input.clientRef.slice(0, 8)}`,
      message: 'Card terminal / processor not connected — confirm manually.',
      manualFallback: true,
    }
  },
}

const bankProvider: PaymentProvider = {
  id: 'bank_transfer',
  label: 'Bank transfer',
  async initiate(input) {
    return {
      provider: 'bank_transfer',
      status: 'pending',
      externalRef: `BANK-${input.clientRef.slice(0, 8)}`,
      message: 'Awaiting bank transfer confirmation.',
      manualFallback: true,
    }
  },
}

const otherProvider: PaymentProvider = {
  id: 'other',
  label: 'Other',
  async initiate(input) {
    return {
      provider: 'other',
      status: 'confirmed',
      externalRef: `OTHER-${input.clientRef.slice(0, 8)}`,
      message: 'Other payment recorded.',
      manualFallback: false,
    }
  },
}

const registry: Record<PaymentProviderId, PaymentProvider> = {
  cash: cashProvider,
  card: cardProvider,
  bank_transfer: bankProvider,
  mtn_momo: mtnLiveOrManual,
  airtel_money: manualMomo('airtel_money', 'Airtel Money'),
  other: otherProvider,
  mtn_momo_sandbox: mtnCollection,
}

export function getPaymentProvider(id: string): PaymentProvider {
  return registry[id as PaymentProviderId] || otherProvider
}

export function listPaymentProviders() {
  return Object.values(registry).map((p) => ({
    id: p.id,
    label: p.label,
    live: p.id.startsWith('mtn') ? momoKeysPresent() : false,
  }))
}

export function mapSalePaymentMethod(
  method: string,
): PaymentProviderId {
  switch (method) {
    case 'CASH':
      return 'cash'
    case 'CARD':
      return 'card'
    case 'MTN_MOMO':
      return process.env.MOMO_USE_SANDBOX === '1'
        ? 'mtn_momo_sandbox'
        : 'mtn_momo'
    case 'AIRTEL_MONEY':
      return 'airtel_money'
    case 'BANK_TRANSFER':
      return 'bank_transfer'
    default:
      return 'other'
  }
}
