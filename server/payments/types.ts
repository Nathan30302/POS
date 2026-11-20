export type PaymentProviderId =
  | 'cash'
  | 'card'
  | 'bank_transfer'
  | 'mtn_momo'
  | 'airtel_money'
  | 'other'
  | 'mtn_momo_sandbox'

export type PaymentLifecycle =
  | 'initiated'
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'cancelled'
  | 'reversed'

export type InitiatePaymentInput = {
  businessId: string
  amount: number
  currency: string
  clientRef: string
  phone?: string
  saleId?: string
  meta?: Record<string, unknown>
}

export type InitiatePaymentResult = {
  provider: PaymentProviderId
  status: PaymentLifecycle
  externalRef?: string
  message: string
  /** true when cashier must complete payment manually (agent number) */
  manualFallback: boolean
}

export interface PaymentProvider {
  id: PaymentProviderId
  label: string
  initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult>
  poll?(externalRef: string): Promise<PaymentLifecycle>
}
