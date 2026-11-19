import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Mic, ScanLine, Sparkles } from 'lucide-react'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { VoiceMicButton } from '@/components/VoiceMicButton'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useSpeechDictation } from '@/hooks/useSpeechDictation'
import {
  parseSpokenProduct,
  spokenToDigits,
  spokenToMoney,
  tidySpokenName,
} from '@/lib/speechDigits'
import type { Product, ProductInput } from '@/types/database'
import { PRODUCT_CATEGORIES } from '@/types/database'

type Props = {
  initial?: Product | null
  showCost?: boolean
  onSubmit: (input: ProductInput) => Promise<void>
  onCancel: () => void
}

type VoiceTarget =
  | 'name'
  | 'barcode'
  | 'price'
  | 'guide-name'
  | 'guide-price'
  | 'guide-barcode'
  | 'describe'
  | null

function toInput(product?: Product | null): ProductInput {
  return {
    name: product?.name ?? '',
    barcode: product?.barcode ?? '',
    sku: product?.sku ?? '',
    category: product?.category ?? 'Writing',
    cost_price: Number(product?.cost_price ?? 0),
    selling_price: Number(product?.selling_price ?? 0),
    stock_quantity: Number(product?.stock_quantity ?? 0),
    low_stock_threshold: Number(product?.low_stock_threshold ?? 10),
    image_url: product?.image_url ?? '',
  }
}

export function ProductForm({
  initial,
  showCost = true,
  onSubmit,
  onCancel,
}: Props) {
  const [form, setForm] = useState<ProductInput>(() => toInput(initial))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  const [voiceTarget, setVoiceTarget] = useState<VoiceTarget>(null)
  const [voiceHint, setVoiceHint] = useState(
    'Tap Voice fill, or describe the product in one go — name, price, barcode.',
  )

  const voiceTargetRef = useRef<VoiceTarget>(null)
  voiceTargetRef.current = voiceTarget
  const pendingNext = useRef<VoiceTarget>(null)

  const applyVoice = useCallback((transcript: string) => {
    const target = voiceTargetRef.current
    if (!target) return

    if (target === 'describe') {
      const parts = parseSpokenProduct(transcript)
      if (!parts.name && parts.price == null && !parts.barcode) {
        setVoiceHint(
          'Didn’t catch that — try “Blue notebook, price twenty, barcode …”',
        )
        return
      }
      setForm((prev) => ({
        ...prev,
        name: parts.name || prev.name,
        barcode: parts.barcode || prev.barcode,
        selling_price:
          parts.price != null ? parts.price : prev.selling_price,
        stock_quantity:
          parts.stock != null ? parts.stock : prev.stock_quantity,
        category:
          parts.category &&
          PRODUCT_CATEGORIES.includes(
            parts.category as (typeof PRODUCT_CATEGORIES)[number],
          )
            ? parts.category
            : prev.category,
      }))
      const bits = [
        parts.name ? `name “${parts.name}”` : null,
        parts.price != null ? `price ${parts.price}` : null,
        parts.barcode ? `barcode ${parts.barcode}` : null,
        parts.stock != null ? `stock ${parts.stock}` : null,
      ].filter(Boolean)
      setVoiceHint(`Filled ${bits.join(' · ')}. Check and save.`)
      setVoiceTarget(null)
      return
    }

    if (target === 'name' || target === 'guide-name') {
      const name = tidySpokenName(transcript)
      if (!name) {
        setVoiceHint('Didn’t catch a name — try again.')
        return
      }
      setForm((prev) => ({ ...prev, name }))
      if (target === 'guide-name') {
        setVoiceHint(`Got “${name}”. Now say the selling price…`)
        pendingNext.current = 'guide-price'
        setVoiceTarget('guide-price')
      } else {
        setVoiceHint(`Product name set: ${name}`)
        setVoiceTarget(null)
      }
      return
    }

    if (target === 'price' || target === 'guide-price') {
      const money = spokenToMoney(transcript)
      if (money === null || money < 0) {
        setVoiceHint('No price heard — say e.g. “fifteen” or “12.50”.')
        return
      }
      setForm((prev) => ({ ...prev, selling_price: money }))
      if (target === 'guide-price') {
        setVoiceHint(
          `Price ${money}. Say the barcode digits, or tap Skip barcode.`,
        )
        pendingNext.current = 'guide-barcode'
        setVoiceTarget('guide-barcode')
      } else {
        setVoiceHint(`Selling price set: ${money}`)
        setVoiceTarget(null)
      }
      return
    }

    if (target === 'barcode' || target === 'guide-barcode') {
      const digits = spokenToDigits(transcript)
      if (!digits) {
        setVoiceHint(
          'No barcode digits heard — say the numbers clearly, or skip.',
        )
        return
      }
      setForm((prev) => ({ ...prev, barcode: digits }))
      setVoiceHint(`Barcode set: ${digits}. Review stock & save.`)
      setVoiceTarget(null)
    }
  }, [])

  const dictation = useSpeechDictation({
    lang: 'en-GB',
    onFinal: applyVoice,
  })

  const startListening = dictation.start

  useEffect(() => {
    if (
      (voiceTarget === 'guide-price' || voiceTarget === 'guide-barcode') &&
      pendingNext.current === voiceTarget
    ) {
      pendingNext.current = null
      const timer = window.setTimeout(() => startListening(), 380)
      return () => window.clearTimeout(timer)
    }
  }, [voiceTarget, startListening])

  function startFieldVoice(
    target: VoiceTarget,
    prompt: string,
    opts?: { continuous?: boolean },
  ) {
    setError('')
    setVoiceTarget(target)
    setVoiceHint(prompt)
    window.setTimeout(() => startListening(opts), 40)
  }

  function startGuidedVoice() {
    if (!initial) {
      setForm((prev) => ({
        ...prev,
        name: '',
        barcode: '',
        selling_price: 0,
      }))
    }
    startFieldVoice(
      'guide-name',
      'Say the product name clearly… then we’ll ask for the price.',
    )
  }

  function startDescribeVoice() {
    startFieldVoice(
      'describe',
      'Describe it — e.g. “Blue notebook, price twenty five, barcode …” Then tap Stop.',
      { continuous: true },
    )
  }

  function skipBarcodeStep() {
    dictation.stop()
    setVoiceTarget(null)
    setVoiceHint('Barcode skipped. Add stock if needed, then save.')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (!form.name.trim()) throw new Error('Name is required')
      if (form.selling_price < 0 || form.cost_price < 0) {
        throw new Error('Prices cannot be negative')
      }
      await onSubmit({
        ...form,
        name: form.name.trim(),
        barcode: form.barcode.trim(),
        sku: form.sku.trim(),
        category: form.category.trim() || 'General',
        image_url: form.image_url.trim(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save product')
      setSaving(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {dictation.supported ? (
          <div className="rounded-2xl border border-royal/25 bg-gradient-to-br from-royal/10 via-card to-teal/10 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-royal text-white">
                <Mic className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-royal">
                  <Sparkles className="h-3.5 w-3.5" />
                  Voice fill
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  Speak the name, selling price, and barcode — step by step or
                  in one description. Less typing when stocking shelves.
                </p>
                <p className="mt-2 text-sm font-medium text-ink">
                  {dictation.listening
                    ? dictation.interim
                      ? `Hearing: “${dictation.interim}”`
                      : 'Listening…'
                    : voiceHint}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="rounded-xl"
                    onClick={startGuidedVoice}
                  >
                    <Mic className="h-4 w-4" />
                    {dictation.listening && voiceTarget?.startsWith('guide')
                      ? 'Listening…'
                      : 'Voice: name → price → barcode'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-xl"
                    onClick={startDescribeVoice}
                  >
                    Describe in one go
                  </Button>
                  {voiceTarget === 'guide-barcode' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-xl"
                      onClick={skipBarcodeStep}
                    >
                      Skip barcode
                    </Button>
                  ) : null}
                  {dictation.listening ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-xl"
                      onClick={() => {
                        dictation.stop()
                        setVoiceTarget(null)
                        setVoiceHint('Voice stopped.')
                      }}
                    >
                      Stop
                    </Button>
                  ) : null}
                </div>
                {dictation.error ? (
                  <p className="mt-2 text-xs text-danger">{dictation.error}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            Voice fill works best in Chrome or Edge (laptop or Android). You can
            still type or scan barcodes here.
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink">Product name</span>
            <VoiceMicButton
              supported={dictation.supported}
              listening={dictation.listening && voiceTarget === 'name'}
              label="Voice name"
              onClick={() =>
                dictation.listening && voiceTarget === 'name'
                  ? dictation.stop()
                  : startFieldVoice('name', 'Say the product name…')
              }
            />
          </div>
          <input
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="e.g. Black Gel Pen 0.7mm"
            required
            className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">Barcode</span>
              <div className="flex items-center gap-2">
                <VoiceMicButton
                  supported={dictation.supported}
                  listening={dictation.listening && voiceTarget === 'barcode'}
                  label="Voice code"
                  onClick={() =>
                    dictation.listening && voiceTarget === 'barcode'
                      ? dictation.stop()
                      : startFieldVoice('barcode', 'Say the barcode digits…')
                  }
                />
                <button
                  type="button"
                  onClick={() => setScanOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-deep"
                >
                  <ScanLine className="h-3.5 w-3.5" />
                  Scan
                </button>
              </div>
            </div>
            <input
              value={form.barcode}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, barcode: e.target.value }))
              }
              placeholder="USB gun, voice, or type"
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15"
              autoComplete="off"
              inputMode="numeric"
            />
          </div>

          <Input
            label="SKU"
            value={form.sku}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, sku: e.target.value }))
            }
            placeholder="PEN-BLK-07"
          />
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Category</span>
          <select
            value={form.category}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, category: e.target.value }))
            }
            className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15"
          >
            {PRODUCT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <div className={`grid gap-4 ${showCost ? 'sm:grid-cols-2' : ''}`}>
          {showCost ? (
            <Input
              label="Cost price (ZMW)"
              type="number"
              min="0"
              step="0.01"
              value={form.cost_price}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  cost_price: Number(e.target.value),
                }))
              }
            />
          ) : null}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">
                Selling price (ZMW)
              </span>
              <VoiceMicButton
                supported={dictation.supported}
                listening={dictation.listening && voiceTarget === 'price'}
                label="Voice price"
                onClick={() =>
                  dictation.listening && voiceTarget === 'price'
                    ? dictation.stop()
                    : startFieldVoice(
                        'price',
                        'Say the selling price — e.g. fifteen or 12.50',
                      )
                }
              />
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.selling_price}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  selling_price: Number(e.target.value),
                }))
              }
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Stock quantity"
            type="number"
            min="0"
            step="1"
            value={form.stock_quantity}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                stock_quantity: Number(e.target.value),
              }))
            }
          />
          <Input
            label="Low stock threshold"
            type="number"
            min="0"
            step="1"
            value={form.low_stock_threshold}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                low_stock_threshold: Number(e.target.value),
              }))
            }
          />
        </div>

        <Input
          label="Image URL (optional)"
          value={form.image_url}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, image_url: e.target.value }))
          }
          placeholder="/products/pen-black.jpg"
          hint="Optional product photo URL — shows on the Sell catalogue tiles."
        />

        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Add product'}
          </Button>
        </div>
      </form>

      {scanOpen ? (
        <Modal title="Scan barcode" onClose={() => setScanOpen(false)}>
          <BarcodeScanner
            onScan={(code) => {
              setForm((prev) => ({ ...prev, barcode: code }))
              setScanOpen(false)
            }}
            onClose={() => setScanOpen(false)}
          />
        </Modal>
      ) : null}
    </>
  )
}
