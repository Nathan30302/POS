import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Keyboard,
  Mic,
  ScanLine,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { ProductPhoto } from '@/components/ProductPhoto'
import { VoiceMicButton } from '@/components/VoiceMicButton'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { prepareProductPhoto, usableImageUrl } from '@/lib/productPhoto'
import { useSpeechDictation } from '@/hooks/useSpeechDictation'
import {
  parseSpokenProduct,
  spokenToDigits,
  spokenToMoney,
  tidySpokenName,
} from '@/lib/speechDigits'
import { useAuth } from '@/context/AuthContext'
import {
  categoriesForUser,
  hasLotModule,
  isPharmacyShop,
} from '@/lib/industry'
import type { Product, ProductInput } from '@/types/database'

type Props = {
  initial?: Product | null
  showCost?: boolean
  onSubmit: (input: ProductInput) => Promise<void>
  onCancel: () => void
  onDelete?: () => void
  onHistory?: () => void
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

type BarcodeEntry = 'type' | 'webcam'

function isMobileUa() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

function toInput(product?: Product | null, fallbackCategory = 'General'): ProductInput {
  return {
    name: product?.name ?? '',
    barcode: product?.barcode ?? '',
    sku: product?.sku ?? '',
    category: product?.category ?? fallbackCategory,
    cost_price: Number(product?.cost_price ?? 0),
    selling_price: Number(product?.selling_price ?? 0),
    stock_quantity: Number(product?.stock_quantity ?? 0),
    low_stock_threshold: Number(product?.low_stock_threshold ?? 10),
    image_url: usableImageUrl(product?.image_url),
    preferred_supplier_id: product?.preferred_supplier_id ?? '',
    track_expiry: Boolean(product?.track_expiry),
    requires_prescription: Boolean(product?.requires_prescription),
  }
}

export function ProductForm({
  initial,
  showCost = true,
  onSubmit,
  onCancel,
  onDelete,
  onHistory,
}: Props) {
  const { user } = useAuth()
  const categoryOptions = categoriesForUser(user)
  const pharmacyShop = isPharmacyShop(user)
  const lotShop = hasLotModule(user)
  const mobile = isMobileUa()
  const [form, setForm] = useState<ProductInput>(() =>
    toInput(initial, categoryOptions[0] || 'General'),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [barcodeEntry, setBarcodeEntry] = useState<BarcodeEntry>('type')
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [photoBroken, setPhotoBroken] = useState(false)
  const previewRef = useRef<string | null>(null)
  const [poolCodes, setPoolCodes] = useState<{ id: string; code: string }[]>(
    [],
  )
  const fileRef = useRef<HTMLInputElement | null>(null)
  const barcodeRef = useRef<HTMLInputElement | null>(null)
  const [voiceTarget, setVoiceTarget] = useState<VoiceTarget>(null)
  const [voiceHint, setVoiceHint] = useState(
    'Speak name → price → barcode, or describe once.',
  )
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [suppliers, setSuppliers] = useState<
    Array<{ id: string; name: string }>
  >([])

  const voiceTargetRef = useRef<VoiceTarget>(null)
  voiceTargetRef.current = voiceTarget
  const pendingNext = useRef<VoiceTarget>(null)

  useEffect(() => {
    let cancelled = false
    void api<{ suppliers: Array<{ id: string; name: string }> }>(
      '/purchasing/suppliers',
    )
      .then((data) => {
        if (!cancelled) setSuppliers(data.suppliers)
      })
      .catch(() => undefined)
    void api<{ codes: { id: string; code: string }[] }>(
      '/barcode-batches/codes/available?limit=40',
    )
      .then((data) => {
        if (!cancelled) setPoolCodes(data.codes)
      })
      .catch(() => {
        if (!cancelled) setPoolCodes([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    }
  }, [])

  function replacePreview(next: string | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = next
    setPreviewUrl(next)
  }

  // Desktop add: focus barcode for USB guns without starting the camera.
  useEffect(() => {
    if (initial || mobile || barcodeEntry !== 'type') return
    const t = window.setTimeout(() => barcodeRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [initial, mobile, barcodeEntry])

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
          parts.category && categoryOptions.includes(parts.category)
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
    setVoiceOpen(true)
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

  function chooseBarcodeEntry(next: BarcodeEntry) {
    setBarcodeEntry(next)
    if (next === 'type') {
      window.setTimeout(() => barcodeRef.current?.focus(), 40)
    }
  }

  async function uploadPhoto(file: File) {
    setUploading(true)
    setError('')
    setPhotoBroken(false)
    try {
      const prepared = await prepareProductPhoto(file)
      replacePreview(URL.createObjectURL(prepared))
      const body = new FormData()
      body.append('image', prepared, prepared.name)
      const data = await api<{ url: string }>('/products/upload-image', {
        method: 'POST',
        body,
      })
      const url = usableImageUrl(data.url)
      if (!url) throw new Error('Upload did not return a photo')
      setForm((prev) => ({ ...prev, image_url: url }))
    } catch (err) {
      replacePreview(null)
      setError(err instanceof Error ? err.message : 'Photo upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function clearPhoto() {
    setForm((prev) => ({ ...prev, image_url: '' }))
    replacePreview(null)
    setPhotoBroken(false)
    if (fileRef.current) fileRef.current.value = ''
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

  const storedPhoto = usableImageUrl(form.image_url)
  const shownPhoto = photoBroken ? '' : previewUrl || storedPhoto
  const categoryChoices = [
    ...(form.category && !categoryOptions.includes(form.category)
      ? [form.category]
      : []),
    ...(categoryOptions.length ? categoryOptions : ['General']),
  ]

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 bg-card text-ink [&_.nx-field]:text-base"
    >
      <section className="space-y-2">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h3 className="nx-section-title text-base">Photo</h3>
            <p className="mt-0.5 text-xs text-ink-soft">
              Tap the picture to take or replace it.
            </p>
          </div>
          {shownPhoto || storedPhoto ? (
            <button
              type="button"
              className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-soft"
              onClick={clearPhoto}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove photo
            </button>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-2xl border border-dashed border-line bg-surface">
          <button
            type="button"
            className="relative block w-full text-left disabled:cursor-wait"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <div className="relative aspect-[4/3] min-h-[180px] w-full bg-surface sm:aspect-[16/9] sm:max-h-72">
              {previewUrl && !photoBroken ? (
                <img
                  src={previewUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full bg-surface object-cover"
                  onError={() => replacePreview(null)}
                />
              ) : (
                <ProductPhoto
                  src={shownPhoto}
                  name={form.name || 'Product'}
                  category={form.category}
                  hint={photoBroken ? 'Photo didn’t load' : 'Add photo'}
                  className="absolute inset-0 h-full w-full"
                />
              )}
              <span className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white">
                {uploading
                  ? 'Saving photo…'
                  : shownPhoto
                    ? 'Tap photo to change'
                    : 'Tap to add'}
              </span>
            </div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.heic,.heif,.jpg,.jpeg,.png,.webp"
            className="sr-only"
            tabIndex={-1}
            aria-label={shownPhoto ? 'Change product photo' : 'Add product photo'}
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void uploadPhoto(file)
            }}
          />
        </div>
      </section>

      {/* Essentials */}
      <section className="space-y-3.5">
        <div>
          <h3 className="nx-section-title text-base">Essentials</h3>
          <p className="mt-0.5 text-xs text-ink-soft">
            Name, barcode, and price — enough to sell.
          </p>
        </div>

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
            className="nx-field"
            autoComplete="off"
          />
        </div>

        <div className="space-y-2.5 rounded-2xl border border-line bg-surface/50 p-3.5 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">Barcode</p>
            </div>
            {dictation.supported ? (
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
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-card p-1 ring-1 ring-line">
            <button
              type="button"
              onClick={() => chooseBarcodeEntry('type')}
              aria-pressed={barcodeEntry === 'type'}
              className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition sm:text-sm ${
                barcodeEntry === 'type'
                  ? 'bg-royal text-white shadow-sm'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Keyboard className="h-3.5 w-3.5" />
              Type
            </button>
            <button
              type="button"
              onClick={() => chooseBarcodeEntry('webcam')}
              aria-pressed={barcodeEntry === 'webcam'}
              className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition sm:text-sm ${
                barcodeEntry === 'webcam'
                  ? 'bg-royal text-white shadow-sm'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <ScanLine className="h-3.5 w-3.5" />
              Scan
            </button>
          </div>

          {barcodeEntry === 'type' ? (
            <div className="space-y-2">
              <input
                ref={barcodeRef}
                value={form.barcode}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, barcode: e.target.value }))
                }
                placeholder={mobile ? 'Barcode digits…' : 'Barcode…'}
                className="nx-field font-mono tracking-wide"
                autoComplete="off"
                inputMode="numeric"
              />
              {form.barcode.trim() ? (
                <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  Ready · {form.barcode.trim()}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              {form.barcode.trim() ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5">
                  <p className="font-mono text-sm font-semibold text-ink">
                    {form.barcode.trim()}
                  </p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-brand hover:text-brand-deep"
                    onClick={() => chooseBarcodeEntry('type')}
                  >
                    Edit as text
                  </button>
                </div>
              ) : null}
              <BarcodeScanner
                continuous={false}
                captureOnly
                onScan={(code) => {
                  setForm((prev) => ({ ...prev, barcode: code }))
                  setBarcodeEntry('type')
                }}
                onClose={() => setBarcodeEntry('type')}
                showDone
              />
            </div>
          )}

          {poolCodes.length > 0 && !form.barcode.trim() ? (
            <div className="space-y-1.5 border-t border-line/70 pt-2.5">
              <p className="text-[11px] text-ink-soft">
                Unused pre-printed labels — tap to assign
              </p>
              <div className="flex flex-wrap gap-1.5">
                {poolCodes.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, barcode: c.code }))
                      setBarcodeEntry('type')
                    }}
                    className="min-h-9 rounded-lg border border-line bg-card px-2.5 py-1.5 font-mono text-[11px] font-semibold text-ink hover:border-brand/40"
                  >
                    {c.code}
                  </button>
                ))}
                {poolCodes.length > 8 ? (
                  <select
                    className="nx-field !min-h-9 !py-1 text-xs"
                    defaultValue=""
                    onChange={(e) => {
                      const v = e.target.value
                      if (v) {
                        setForm((prev) => ({ ...prev, barcode: v }))
                        setBarcodeEntry('type')
                      }
                    }}
                  >
                    <option value="">More unused…</option>
                    {poolCodes.slice(8).map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className={`grid gap-3.5 ${showCost ? 'sm:grid-cols-2' : ''}`}>
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
              className="nx-field"
            />
          </div>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
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
      </section>

      {/* Details */}
      <section className="space-y-3.5">
        <div>
          <h3 className="nx-section-title text-base">Details</h3>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Category</span>
            <select
              value={form.category || categoryChoices[0]}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, category: e.target.value }))
              }
              className="nx-field"
            >
              {categoryChoices.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="SKU"
            value={form.sku}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, sku: e.target.value }))
            }
            placeholder="PEN-BLK-07"
          />
        </div>

        {lotShop || form.track_expiry ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border border-line bg-surface/50 px-3 py-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={Boolean(form.track_expiry)}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    track_expiry: e.target.checked,
                  }))
                }
              />
              Track expiry / lots
            </label>
            {pharmacyShop ? (
              <label className="flex items-center gap-2 rounded-xl border border-line bg-surface/50 px-3 py-2.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={Boolean(form.requires_prescription)}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      requires_prescription: e.target.checked,
                    }))
                  }
                />
                Requires prescription (Rx)
              </label>
            ) : null}
          </div>
        ) : null}
        {initial?.id ? (
          <p className="text-[11px] text-ink-soft">
            Product id <span className="font-mono">{initial.id}</span> · use
            with Pharmacy → Receive lot
            {initial.open_batches
              ? ` · ${initial.open_batches} open lot(s)`
              : ''}
            {initial.expiry_date
              ? ` · next expiry ${String(initial.expiry_date).slice(0, 10)}`
              : ''}
          </p>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">
            Preferred supplier
          </span>
          <select
            value={form.preferred_supplier_id || ''}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                preferred_supplier_id: e.target.value,
              }))
            }
            className="nx-field"
          >
            <option value="">None</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

      </section>

      {/* Voice — collapsed by default so laptop add stays fast */}
      {dictation.supported ? (
        <details
          className="group rounded-2xl border border-line bg-surface/40 open:border-brand/25 open:bg-gradient-to-br open:from-brand/5 open:via-card open:to-teal/5"
          open={voiceOpen}
          onToggle={(e) => setVoiceOpen(e.currentTarget.open)}
        >
          <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3.5 py-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand">
              <Mic className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              Voice fill
              <span className="mt-0.5 block text-xs font-normal text-ink-soft">
                Hands-free name, price, barcode
              </span>
            </span>
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand opacity-70" />
          </summary>
          <div className="space-y-3 border-t border-line/60 px-3.5 pb-3.5 pt-3">
            <p className="text-sm font-medium text-ink">
              {dictation.listening
                ? dictation.interim
                  ? `Hearing: “${dictation.interim}”`
                  : 'Listening…'
                : voiceHint}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="rounded-xl"
                onClick={startGuidedVoice}
              >
                <Mic className="h-4 w-4" />
                {dictation.listening && voiceTarget?.startsWith('guide')
                  ? 'Listening…'
                  : 'Name → price → barcode'}
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
              <p className="text-xs text-danger">{dictation.error}</p>
            ) : null}
          </div>
        </details>
      ) : null}

      {error ? <FormBanner tone="error">{error}</FormBanner> : null}

      <div className="sticky bottom-0 z-10 -mx-1 space-y-2 border-t border-line bg-card/95 px-1 pt-3 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        {onHistory ? (
          <button
            type="button"
            className="text-xs font-semibold text-royal"
            onClick={onHistory}
          >
            Stock history
          </button>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="submit"
            disabled={saving || uploading}
            className="w-full sm:w-auto"
          >
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Add product'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
        </div>
        {onDelete ? (
          <div className="border-t border-line pt-2">
            <Button
              type="button"
              variant="danger"
              className="w-full"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete product
            </Button>
          </div>
        ) : null}
      </div>
    </form>
  )
}
