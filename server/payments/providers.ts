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
function manualMomo(id: 'mtn_momo' | 'airtel_money', label: string): PaymentProvider {
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
 * Sandbox stub for MTN Collection API.
 * Requires MOMO_SUBSCRIPTION_KEY + MOMO_API_USER + MOMO_API_KEY to go live.
 * Without credentials, returns pending + clear documentation message.
 */
const mtnSandbox: PaymentProvider = {
  id: 'mtn_momo_sandbox',
  label: 'MTN MoMo (sandbox)',
  async initiate(input): Promise<InitiatePaymentResult> {
    const sub = process.env.MOMO_SUBSCRIPTION_KEY
    const user = process.env.MOMO_API_USER
    const key = process.env.MOMO_API_KEY
    if (!sub || !user || !key) {
      return {
        provider: 'mtn_momo_sandbox',
        status: 'pending',
        message:
          'MTN sandbox credentials not configured (MOMO_SUBSCRIPTION_KEY, MOMO_API_USER, MOMO_API_KEY). Payment stays pending — use agent fallback or set keys.',
        manualFallback: true,
      }
    }
    // Structure ready for real request-to-pay call
    return {
      provider: 'mtn_momo_sandbox',
      status: 'pending',
      externalRef: `MOMO-SBX-${Date.now()}`,
      message: `Sandbox request-to-pay prepared for ${input.amount} ${input.currency} (wire Collection API next).`,
      manualFallback: false,
    }
  },
  async poll(_externalRef): Promise<PaymentLifecycle> {
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
  mtn_momo: manualMomo('mtn_momo', 'MTN MoMo'),
  airtel_money: manualMomo('airtel_money', 'Airtel Money'),
  other: otherProvider,
  mtn_momo_sandbox: mtnSandbox,
}

export function getPaymentProvider(id: string): PaymentProvider {
  return registry[id as PaymentProviderId] || otherProvider
}

export function listPaymentProviders() {
  return Object.values(registry).map((p) => ({ id: p.id, label: p.label }))
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
      return process.env.MOMO_USE_SANDBOX === '1' ? 'mtn_momo_sandbox' : 'mtn_momo'
    case 'AIRTEL_MONEY':
      return 'airtel_money'
    case 'BANK_TRANSFER':
      return 'bank_transfer'
    default:
      return 'other'
  }
}
