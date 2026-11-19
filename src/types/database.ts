export type Product = {
  id: string
  name: string
  barcode: string | null
  sku: string | null
  category: string
  cost_price: number
  selling_price: number
  stock_quantity: number
  low_stock_threshold: number
  image_url: string | null
  created_at: string
  updated_at: string
}

export type ProductInput = {
  name: string
  barcode: string
  sku: string
  category: string
  cost_price: number
  selling_price: number
  stock_quantity: number
  low_stock_threshold: number
  image_url: string
}

export type PaymentMethod = 'cash' | 'card' | 'mtn' | 'airtel' | 'other'

export type Sale = {
  id: string
  total: number
  discount: number
  payment_method: PaymentMethod
  notes: string | null
  created_at: string
}

export type SaleItem = {
  id: string
  sale_id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
}

export type SaleWithItems = Sale & { items: SaleItem[] }

export type CartLine = {
  product: Product
  quantity: number
}

export type ReceiptTender = {
  cashGiven: number | null
  changeDue: number | null
}

export const PRODUCT_CATEGORIES = [
  'Writing',
  'Books',
  'Paper',
  'Tools',
  'Adhesives',
  'School',
  'Art',
  'Office',
  'Files',
  'General',
] as const

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'mtn', label: 'MTN MoMo' },
  { value: 'airtel', label: 'Airtel Money' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
]

export const PAYMENT_API: Record<PaymentMethod, string> = {
  cash: 'CASH',
  card: 'CARD',
  mtn: 'MTN_MOMO',
  airtel: 'AIRTEL_MONEY',
  other: 'OTHER',
}

export function mapApiPayment(method: string): PaymentMethod {
  switch (method) {
    case 'CARD':
      return 'card'
    case 'MTN_MOMO':
      return 'mtn'
    case 'AIRTEL_MONEY':
      return 'airtel'
    case 'OTHER':
    case 'ZAMTEL':
    case 'BANK_TRANSFER':
      return 'other'
    case 'CASH':
    default:
      return 'cash'
  }
}

export function paymentLabel(method: PaymentMethod) {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label || method
}

/** Friendly label for API enums (CASH, MTN_MOMO, …) or frontend keys. */
export function apiPaymentLabel(method: string) {
  const mapped = mapApiPayment(method)
  if (
    method === 'cash' ||
    method === 'card' ||
    method === 'mtn' ||
    method === 'airtel' ||
    method === 'other'
  ) {
    return paymentLabel(method)
  }
  if (method === 'BANK_TRANSFER') return 'Bank transfer'
  if (method === 'ZAMTEL') return 'Zamtel'
  return paymentLabel(mapped)
}
