import type { SaleWithItems } from '@/types/database'

function escapeCell(value: string | number) {
  const text = String(value)
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

export function salesToCsv(sales: SaleWithItems[]) {
  const header = [
    'sale_id',
    'date',
    'payment_method',
    'discount',
    'total',
    'item_name',
    'quantity',
    'unit_price',
    'line_total',
  ]

  const rows = sales.flatMap((sale) =>
    sale.items.map((item) =>
      [
        sale.id,
        sale.created_at,
        sale.payment_method,
        sale.discount,
        sale.total,
        item.product_name,
        item.quantity,
        item.unit_price,
        item.line_total,
      ]
        .map(escapeCell)
        .join(','),
    ),
  )

  return [header.join(','), ...rows].join('\n')
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
