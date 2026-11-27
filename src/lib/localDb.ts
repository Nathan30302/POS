import { SEED_PRODUCTS } from '@/lib/seed'
import type {
  PaymentMethod,
  Product,
  ProductInput,
  Sale,
  SaleItem,
  SaleWithItems,
} from '@/types/database'

const STORAGE_KEY = 'nexora-local-v1'

type DbShape = {
  products: Product[]
  sales: Sale[]
  sale_items: SaleItem[]
}

function now() {
  return new Date().toISOString()
}

function id() {
  return crypto.randomUUID()
}

function blankDb(): DbShape {
  const stamp = now()
  return {
    products: SEED_PRODUCTS.map((p) => ({
      ...p,
      id: id(),
      created_at: stamp,
      updated_at: stamp,
    })),
    sales: [],
    sale_items: [],
  }
}

function read(): DbShape {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const fresh = blankDb()
    write(fresh)
    return fresh
  }
  try {
    return JSON.parse(raw) as DbShape
  } catch {
    const fresh = blankDb()
    write(fresh)
    return fresh
  }
}

function write(db: DbShape) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

function normalizeProduct(input: ProductInput) {
  return {
    name: input.name.trim(),
    barcode: input.barcode.trim() || null,
    sku: input.sku.trim() || null,
    category: input.category.trim() || 'General',
    cost_price: Number(input.cost_price) || 0,
    selling_price: Number(input.selling_price) || 0,
    stock_quantity: Math.max(0, Math.floor(Number(input.stock_quantity) || 0)),
    low_stock_threshold: Math.max(
      0,
      Math.floor(Number(input.low_stock_threshold) || 0),
    ),
    image_url: input.image_url.trim() || null,
    preferred_supplier_id: input.preferred_supplier_id?.trim() || null,
    preferred_supplier_name: null as string | null,
  }
}

export const localDb = {
  listProducts(): Product[] {
    return [...read().products].sort((a, b) => a.name.localeCompare(b.name))
  },

  getProduct(productId: string) {
    return read().products.find((p) => p.id === productId) ?? null
  },

  findByBarcode(barcode: string) {
    const code = barcode.trim()
    if (!code) return null
    return (
      read().products.find(
        (p) => p.barcode === code || p.sku?.toLowerCase() === code.toLowerCase(),
      ) ?? null
    )
  },

  createProduct(input: ProductInput): Product {
    const db = read()
    const stamp = now()
    const product: Product = {
      id: id(),
      ...normalizeProduct(input),
      created_at: stamp,
      updated_at: stamp,
    }
    assertUniqueCodes(db.products, product)
    db.products.push(product)
    write(db)
    return product
  },

  updateProduct(productId: string, input: ProductInput): Product {
    const db = read()
    const index = db.products.findIndex((p) => p.id === productId)
    if (index < 0) throw new Error('Product not found')
    const next: Product = {
      ...db.products[index],
      ...normalizeProduct(input),
      updated_at: now(),
    }
    assertUniqueCodes(
      db.products.filter((p) => p.id !== productId),
      next,
    )
    db.products[index] = next
    write(db)
    return next
  },

  deleteProduct(productId: string) {
    const db = read()
    db.products = db.products.filter((p) => p.id !== productId)
    write(db)
  },

  completeSale(args: {
    lines: { productId: string; quantity: number }[]
    discount: number
    paymentMethod: PaymentMethod
    notes?: string
  }): SaleWithItems {
    const db = read()
    if (!args.lines.length) throw new Error('Cart is empty')

    const items: SaleItem[] = []
    let subtotal = 0

    for (const line of args.lines) {
      const product = db.products.find((p) => p.id === line.productId)
      if (!product) throw new Error('A product in the cart no longer exists')
      if (line.quantity <= 0) throw new Error('Invalid quantity')
      if (product.stock_quantity < line.quantity) {
        throw new Error(`Not enough stock for ${product.name}`)
      }

      const unit = Number(product.selling_price)
      const lineTotal = unit * line.quantity
      subtotal += lineTotal
      items.push({
        id: id(),
        sale_id: '',
        product_id: product.id,
        product_name: product.name,
        quantity: line.quantity,
        unit_price: unit,
        line_total: lineTotal,
      })
    }

    const discount = Math.max(0, Number(args.discount) || 0)
    if (discount > subtotal) throw new Error('Discount cannot exceed total')

    const saleId = id()
    const sale: Sale = {
      id: saleId,
      total: Number((subtotal - discount).toFixed(2)),
      discount,
      payment_method: args.paymentMethod,
      notes: args.notes?.trim() || null,
      created_at: now(),
    }

    for (const item of items) {
      item.sale_id = saleId
      const product = db.products.find((p) => p.id === item.product_id)!
      product.stock_quantity -= item.quantity
      product.updated_at = now()
    }

    db.sales.unshift(sale)
    db.sale_items.push(...items)
    write(db)

    return { ...sale, items }
  },

  listSales(): SaleWithItems[] {
    const db = read()
    return db.sales.map((sale) => ({
      ...sale,
      items: db.sale_items.filter((i) => i.sale_id === sale.id),
    }))
  },

  getSale(saleId: string): SaleWithItems | null {
    const db = read()
    const sale = db.sales.find((s) => s.id === saleId)
    if (!sale) return null
    return {
      ...sale,
      items: db.sale_items.filter((i) => i.sale_id === sale.id),
    }
  },

  receiveStock(productId: string, quantity: number): Product {
    const qty = Math.floor(Number(quantity))
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('Enter a quantity greater than 0')
    }
    const db = read()
    const product = db.products.find((p) => p.id === productId)
    if (!product) throw new Error('Product not found')
    product.stock_quantity += qty
    product.updated_at = now()
    write(db)
    return product
  },

  lowStockProducts(): Product[] {
    return this.listProducts().filter(
      (p) => p.stock_quantity <= p.low_stock_threshold,
    )
  },

  todaySummary() {
    const sales = this.listSales().filter((sale) => isSameLocalDay(sale.created_at))
    const paymentBreakdown: Record<PaymentMethod, number> = {
      cash: 0,
      card: 0,
      mtn: 0,
      airtel: 0,
      credit: 0,
      other: 0,
    }
    let total = 0
    for (const sale of sales) {
      total += sale.total
      paymentBreakdown[sale.payment_method] += sale.total
    }
    return {
      date: new Date().toLocaleDateString(),
      transactionCount: sales.length,
      total: Number(total.toFixed(2)),
      paymentBreakdown,
      sales,
    }
  },

  /** Cancel a sale and put stock back on the shelf. */
  voidSale(saleId: string) {
    const db = read()
    const sale = db.sales.find((s) => s.id === saleId)
    if (!sale) throw new Error('Sale not found')
    const items = db.sale_items.filter((i) => i.sale_id === saleId)
    for (const item of items) {
      const product = db.products.find((p) => p.id === item.product_id)
      if (product) {
        product.stock_quantity += item.quantity
        product.updated_at = now()
      }
    }
    db.sales = db.sales.filter((s) => s.id !== saleId)
    db.sale_items = db.sale_items.filter((i) => i.sale_id !== saleId)
    write(db)
  },

  /** Dev helper: wipe and reseed stationery catalogue */
  resetDemoData() {
    write(blankDb())
  },
}

function isSameLocalDay(iso: string) {
  const d = new Date(iso)
  const nowDate = new Date()
  return (
    d.getFullYear() === nowDate.getFullYear() &&
    d.getMonth() === nowDate.getMonth() &&
    d.getDate() === nowDate.getDate()
  )
}

function assertUniqueCodes(others: Product[], product: Product) {
  if (
    product.barcode &&
    others.some((p) => p.barcode && p.barcode === product.barcode)
  ) {
    throw new Error('That barcode is already used by another product')
  }
  if (
    product.sku &&
    others.some(
      (p) => p.sku && p.sku.toLowerCase() === product.sku!.toLowerCase(),
    )
  ) {
    throw new Error('That SKU is already used by another product')
  }
}
