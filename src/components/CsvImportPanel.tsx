import { useState, type FormEvent } from 'react'
import { FileUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { api } from '@/lib/api'

const SAMPLE = `name,sellingPrice,costPrice,stockQuantity,barcode,sku,category,lowStockThreshold
Cola 500ml,8,5,40,6001234567890,COLA500,Drinks,10
Bread loaf,12,7,20,,BRD01,Bakery,5`

type ImportResult = {
  dryRun?: boolean
  created: number
  updated: number
  skipped: Array<{ line: number; reason: string }>
  sample?: string[]
}

export function CsvImportPanel({ onDone }: { onDone?: () => void }) {
  const [csv, setCsv] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  async function run(dryRun: boolean) {
    setBusy(true)
    setErr('')
    setResult(null)
    try {
      const data = await api<ImportResult>('/products/import-csv', {
        method: 'POST',
        body: JSON.stringify({ csv, dryRun }),
      })
      setResult(data)
      if (!dryRun) onDone?.()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void run(false)
  }

  function onFile(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCsv(String(reader.result || ''))
    reader.readAsText(file)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-royal/10 text-royal">
          <FileUp className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Import catalogue CSV</p>
          <p className="text-xs text-ink-soft">
            Columns: name, sellingPrice (required). Optional: costPrice, stock,
            barcode, sku, category, lowStockThreshold. Matching barcode updates
            the existing SKU.
          </p>
        </div>
      </div>

      {err ? <FormBanner tone="error">{err}</FormBanner> : null}
      {result ? (
        <FormBanner tone="ok">
          {result.dryRun ? 'Dry run · ' : ''}
          {result.created} create · {result.updated} update
          {result.skipped.length
            ? ` · ${result.skipped.length} skipped`
            : ''}
        </FormBanner>
      ) : null}

      <input
        type="file"
        accept=".csv,text/csv"
        className="block w-full text-xs text-ink-soft"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />

      <textarea
        className="min-h-[120px] w-full rounded-xl border border-line bg-card px-3 py-2 font-mono text-xs text-ink"
        placeholder={SAMPLE}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={busy || csv.trim().length < 10}
          onClick={() => void run(true)}
        >
          Dry run
        </Button>
        <Button type="submit" disabled={busy || csv.trim().length < 10}>
          {busy ? 'Importing…' : 'Import CSV'}
        </Button>
        <button
          type="button"
          className="text-xs font-semibold text-royal hover:underline"
          onClick={() => setCsv(SAMPLE)}
        >
          Paste sample
        </button>
      </div>
    </form>
  )
}
