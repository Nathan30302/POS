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

export type PaymentMethod = 'cash' | 'card' | 'eft' | 'other'

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
  { value: 'card', label: 'Card' },
  { value: 'eft', label: 'EFT / Mobile money' },
  { value: 'other', label: 'Other' },
]
