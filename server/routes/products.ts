import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { createOwnerAlert } from '../alerts.js'
import {
  refreshBatchExhaustion,
  syncBarcodePoolClaim,
} from '../barcodeCodes.js'
import {
  applyBranchStockDelta,
  ensureBranchStockSeeded,
  resolveStockBranchId,
} from '../branchStock.js'
import {
  requireAuth,
  requireAnyPermission,
  requireBusinessMember,
  requirePermission,
  writeAudit,
  type AuthedRequest,
} from '../middleware.js'
import { prisma } from '../prisma.js'

export const productsRouter = Router()
productsRouter.use(requireAuth, requireBusinessMember)

const uploadRoot = path.join(process.cwd(), 'uploads', 'products')
fs.mkdirSync(uploadRoot, { recursive: true })

function sniffImage(buf: Buffer): 'jpg' | 'png' | 'gif' | 'webp' | 'heic' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpg'
  }
  if (buf.length >= 8 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') {
    return 'png'
  }
  if (
    buf.length >= 6 &&
    (buf.toString('ascii', 0, 6) === 'GIF87a' ||
      buf.toString('ascii', 0, 6) === 'GIF89a')
  ) {
    return 'gif'
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp'
  }
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12).toLowerCase()
    if (
      brand === 'heic' ||
      brand === 'heix' ||
      brand === 'heif' ||
      brand === 'mif1' ||
      brand === 'msf1' ||
      brand === 'hevc' ||
      brand === 'avif'
    ) {
      return 'heic'
    }
  }
  return null
}

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadRoot),
    filename: (_req, file, cb) => {
      const raw = path.extname(file.originalname || '').toLowerCase()
      const ext = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(raw)
        ? raw
        : '.jpg'
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const type = (file.mimetype || '').toLowerCase()
    if (
      type.startsWith('image/') ||
      type === 'application/octet-stream' ||
      type === ''
    ) {
      cb(null, true)
      return
    }
    cb(new Error('Only image uploads are allowed'))
  },
})

/** Upload a product photo from phone or laptop — returns a public URL. */
productsRouter.post(
  '/upload-image',
  requirePermission('inventory'),
  (req: AuthedRequest, res, next) => {
    imageUpload.single('image')(req, res, (err) => {
      if (err) {
        const message =
          err instanceof Error ? err.message : 'Upload failed'
        return res.status(400).json({ error: message })
      }
      next()
    })
  },
  (req: AuthedRequest, res) => {
    const file = req.file
    if (!file) return res.status(400).json({ error: 'Choose a photo to upload' })
    let head: Buffer
    try {
      const fh = fs.openSync(file.path, 'r')
      try {
        head = Buffer.alloc(16)
        fs.readSync(fh, head, 0, 16, 0)
      } finally {
        fs.closeSync(fh)
      }
    } catch {
      fs.unlink(file.path, () => undefined)
      return res.status(400).json({ error: 'Could not read that photo' })
    }
    const kind = sniffImage(head)
    if (!kind || kind === 'heic') {
      fs.unlink(file.path, () => undefined)
      return res.status(400).json({
        error:
          kind === 'heic'
            ? 'This phone saved a format the shop can’t show. Tap the photo again, or take a new picture.'
            : 'That file is not a usable photo. Try JPEG or PNG.',
      })
    }
    const ext = kind === 'jpg' ? '.jpg' : `.${kind}`
    let filename = file.filename
    if (!filename.toLowerCase().endsWith(ext)) {
      const next = filename.replace(/\.[^.]+$/, '') + ext
      try {
        fs.renameSync(file.path, path.join(uploadRoot, next))
        filename = next
      } catch {
        fs.unlink(file.path, () => undefined)
        return res.status(400).json({ error: 'Could not store that photo' })
      }
    }
    res.status(201).json({ url: `/uploads/products/${filename}` })
  },
)

productsRouter.get(
  '/',
  requireAnyPermission('sell', 'inventory', 'labels'),
  async (req: AuthedRequest, res) => {
  const q = String(req.query.q || '').trim()
  // Sell path: lean=1 skips supplier join + batch counts (faster till open)
  const lean = String(req.query.lean || '') === '1'
  const products = await prisma.product.findMany({
    where: {
      businessId: req.businessId!,
      active: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { barcode: { contains: q } },
              { sku: { contains: q } },
            ],
          }
        : {}),
    },
    // Hot path (Sell + Inventory) — skip description / variants / unused columns
    select: {
      id: true,
      name: true,
      barcode: true,
      sku: true,
      costPrice: true,
      sellingPrice: true,
      stockQuantity: true,
      lowStockThreshold: true,
      trackExpiry: true,
      expiryDate: true,
      requiresPrescription: true,
      imageUrl: true,
      preferredSupplierId: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { name: true } },
      ...(lean
        ? {}
        : {
            preferredSupplier: { select: { id: true, name: true } },
            _count: {
              select: {
                batches: { where: { quantity: { gt: 0 } } },
              },
            },
          }),
    },
    orderBy: { name: 'asc' },
  })
  res.json({ products })
},
)

/**
 * CSV import — headers: name,sellingPrice,costPrice,stockQuantity,barcode,sku,category,lowStockThreshold
 * Upserts by barcode when present; otherwise always creates.
 */
productsRouter.post(
  '/import-csv',
  requirePermission('inventory'),
  async (req: AuthedRequest, res) => {
    const body = z
      .object({
        csv: z.string().min(10).max(2_000_000),
        dryRun: z.boolean().optional(),
      })
      .safeParse(req.body)
    if (!body.success) {
      return res.status(400).json({ error: 'Provide csv text (name + sellingPrice required)' })
    }

    const lines = body.data.csv
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV needs a header row and at least one product' })
    }

    const split = (row: string) => {
      const cells: string[] = []
      let cur = ''
      let inQ = false
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]
        if (ch === '"') {
          if (inQ && row[i + 1] === '"') {
            cur += '"'
            i++
          } else inQ = !inQ
          continue
        }
        if (ch === ',' && !inQ) {
          cells.push(cur.trim())
          cur = ''
          continue
        }
        cur += ch
      }
      cells.push(cur.trim())
      return cells
    }

    const headers = split(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ''))
    const idx = (aliases: string[]) =>
      headers.findIndex((h) => aliases.includes(h))

    const iName = idx(['name', 'product', 'productname', 'title'])
    const iSell = idx(['sellingprice', 'price', 'sell', 'selling'])
    const iCost = idx(['costprice', 'cost', 'buy'])
    const iStock = idx(['stockquantity', 'stock', 'qty', 'quantity'])
    const iBarcode = idx(['barcode', 'ean', 'upc'])
    const iSku = idx(['sku', 'code'])
    const iCat = idx(['category', 'cat'])
    const iLow = idx(['lowstockthreshold', 'threshold', 'reorder'])

    if (iName < 0 || iSell < 0) {
      return res.status(400).json({
        error: 'CSV must include name and sellingPrice (or price) columns',
      })
    }

    const businessId = req.businessId!
    const created: string[] = []
    const updated: string[] = []
    const skipped: Array<{ line: number; reason: string }> = []

    for (let li = 1; li < lines.length; li++) {
      const cells = split(lines[li])
      const name = (cells[iName] || '').trim()
      const sellRaw = cells[iSell] || ''
      const sellingPrice = Number(String(sellRaw).replace(/[^0-9.]/g, ''))
      if (!name || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
        skipped.push({ line: li + 1, reason: 'Missing name or sellingPrice' })
        continue
      }
      const costPrice =
        iCost >= 0
          ? Math.max(0, Number(String(cells[iCost] || '0').replace(/[^0-9.]/g, '')) || 0)
          : 0
      const stockQuantity =
        iStock >= 0
          ? Math.max(0, Math.floor(Number(cells[iStock]) || 0))
          : 0
      const lowStockThreshold =
        iLow >= 0
          ? Math.max(0, Math.floor(Number(cells[iLow]) || 10))
          : 10
      const barcode = iBarcode >= 0 ? (cells[iBarcode] || '').trim() || undefined : undefined
      const sku = iSku >= 0 ? (cells[iSku] || '').trim() || undefined : undefined
      const category = iCat >= 0 ? (cells[iCat] || '').trim() || undefined : undefined

      if (body.data.dryRun) {
        created.push(name)
        continue
      }

      let categoryId: string | undefined
      if (category) {
        const cat = await prisma.category.upsert({
          where: { businessId_name: { businessId, name: category } },
          update: {},
          create: { businessId, name: category },
        })
        categoryId = cat.id
      }

      if (barcode) {
        const existing = await prisma.product.findFirst({
          where: { businessId, barcode, active: true },
        })
        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              name,
              sellingPrice,
              costPrice,
              stockQuantity,
              lowStockThreshold,
              sku: sku ?? existing.sku,
              categoryId: categoryId ?? existing.categoryId,
            },
          })
          updated.push(name)
          continue
        }
      }

      await prisma.product.create({
        data: {
          businessId,
          name,
          barcode,
          sku,
          categoryId,
          costPrice,
          sellingPrice,
          stockQuantity,
          lowStockThreshold,
        },
      })
      created.push(name)
    }

    if (!body.data.dryRun) {
      await writeAudit('products.import_csv', {
        businessId,
        userId: req.auth!.sub,
        entity: 'Product',
        after: {
          created: created.length,
          updated: updated.length,
          skipped: skipped.length,
        },
      })
    }

    res.json({
      dryRun: Boolean(body.data.dryRun),
      created: created.length,
      updated: updated.length,
      skipped,
      sample: created.slice(0, 5),
    })
  },
)

productsRouter.post('/', requirePermission('inventory'), async (req: AuthedRequest, res) => {
  const body = z
    .object({
      name: z.string().min(1),
      barcode: z.string().optional(),
      sku: z.string().optional(),
      category: z.string().optional(),
      costPrice: z.number().nonnegative().default(0),
      sellingPrice: z.number().nonnegative(),
      stockQuantity: z.number().int().nonnegative().default(0),
      lowStockThreshold: z.number().int().nonnegative().default(10),
      imageUrl: z.string().optional(),
      preferredSupplierId: z.string().min(1).optional().nullable(),
      trackExpiry: z.boolean().optional(),
      requiresPrescription: z.boolean().optional(),
    })
    .safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'Invalid product' })

  const businessId = req.businessId!
  let categoryId: string | undefined
  if (body.data.category) {
    const cat = await prisma.category.upsert({
      where: { businessId_name: { businessId, name: body.data.category } },
      update: {},
      create: { businessId, name: body.data.category },
    })
    categoryId = cat.id
  }

  let preferredSupplierId: string | null =
    body.data.preferredSupplierId === undefined
      ? null
      : body.data.preferredSupplierId
  if (preferredSupplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: preferredSupplierId, businessId },
    })
    if (!supplier) {
      return res.status(400).json({ error: 'Unknown preferred supplier' })
    }
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      // Seed existing catalogue first so opening stock is not double-counted
      await ensureBranchStockSeeded(businessId, tx)
      const created = await tx.product.create({
        data: {
          businessId,
          categoryId,
          preferredSupplierId,
          name: body.data.name,
          barcode: body.data.barcode || null,
          sku: body.data.sku || null,
          costPrice: body.data.costPrice,
          sellingPrice: body.data.sellingPrice,
          stockQuantity: 0,
          lowStockThreshold: body.data.lowStockThreshold,
          imageUrl: body.data.imageUrl || null,
          trackExpiry: body.data.trackExpiry ?? false,
          requiresPrescription: body.data.requiresPrescription ?? false,
        },
      })
      const branchId = await resolveStockBranchId(
        businessId,
        req.branchId,
        tx,
      )
      if (branchId && body.data.stockQuantity > 0) {
        await applyBranchStockDelta(tx, {
          businessId,
          branchId,
          productId: created.id,
          delta: body.data.stockQuantity,
          movementType: 'PURCHASE',
          note: 'Opening stock',
        })
      } else if (branchId) {
        await tx.branchStock.create({
          data: {
            businessId,
            branchId,
            productId: created.id,
            quantity: 0,
          },
        })
      } else if (body.data.stockQuantity > 0) {
        await tx.product.update({
          where: { id: created.id },
          data: { stockQuantity: body.data.stockQuantity },
        })
      }
      return tx.product.findUniqueOrThrow({ where: { id: created.id } })
    })
    await syncBarcodePoolClaim(
      prisma,
      businessId,
      product.id,
      product.barcode,
    )
    if (product.barcode) {
      const claimed = await prisma.barcodeCode.findFirst({
        where: { businessId, code: product.barcode, status: 'CLAIMED' },
        select: { batchId: true },
      })
      if (claimed) await refreshBatchExhaustion(prisma, claimed.batchId)
    }
    await writeAudit('product.create', {
      businessId,
      userId: req.auth!.sub,
      entity: 'Product',
      entityId: product.id,
      after: {
        name: product.name,
        sellingPrice: product.sellingPrice,
        stockQuantity: product.stockQuantity,
      },
    })
    res.status(201).json({ product })
  } catch {
    res.status(400).json({ error: 'Could not create product (duplicate barcode/SKU?)' })
  }
})

productsRouter.put('/:id', requirePermission('inventory'), async (req: AuthedRequest, res) => {
  const businessId = req.businessId!
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, businessId },
  })
  if (!existing) return res.status(404).json({ error: 'Product not found' })

  const body = z
    .object({
      name: z.string().min(1),
      barcode: z.string().optional().nullable(),
      sku: z.string().optional().nullable(),
      costPrice: z.number().nonnegative(),
      sellingPrice: z.number().nonnegative(),
      stockQuantity: z.number().int().nonnegative(),
      lowStockThreshold: z.number().int().nonnegative(),
      imageUrl: z.string().optional().nullable(),
      category: z.string().optional(),
      preferredSupplierId: z.string().min(1).optional().nullable(),
      trackExpiry: z.boolean().optional(),
      requiresPrescription: z.boolean().optional(),
    })
    .safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'Invalid product' })

  let categoryId = existing.categoryId
  if (body.data.category) {
    const cat = await prisma.category.upsert({
      where: { businessId_name: { businessId, name: body.data.category } },
      update: {},
      create: { businessId, name: body.data.category },
    })
    categoryId = cat.id
  }

  let preferredSupplierId =
    body.data.preferredSupplierId === undefined
      ? existing.preferredSupplierId
      : body.data.preferredSupplierId
  if (preferredSupplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: preferredSupplierId, businessId },
    })
    if (!supplier) {
      return res.status(400).json({ error: 'Unknown preferred supplier' })
    }
  }

  try {
    const stockDelta = body.data.stockQuantity - existing.stockQuantity
    const product = await prisma.$transaction(async (tx) => {
      await ensureBranchStockSeeded(businessId, tx)
      const branchId = await resolveStockBranchId(
        businessId,
        req.branchId,
        tx,
      )

      if (stockDelta !== 0 && branchId) {
        await applyBranchStockDelta(tx, {
          businessId,
          branchId,
          productId: existing.id,
          delta: stockDelta,
          movementType: stockDelta < 0 ? 'ADJUSTMENT' : 'PURCHASE',
          note:
            stockDelta < 0
              ? 'Manual stock decrease (integrity watch)'
              : 'Manual stock increase',
          allowNegative: true,
        })
      }

      const data: {
        name: string
        barcode: string | null
        sku: string | null
        costPrice: number
        sellingPrice: number
        stockQuantity?: number
        lowStockThreshold: number
        imageUrl: string | null
        categoryId: string | null
        preferredSupplierId: string | null
        trackExpiry?: boolean
        requiresPrescription?: boolean
      } = {
        name: body.data.name,
        barcode: body.data.barcode || null,
        sku: body.data.sku || null,
        costPrice: body.data.costPrice,
        sellingPrice: body.data.sellingPrice,
        preferredSupplierId,
        lowStockThreshold: body.data.lowStockThreshold,
        imageUrl: body.data.imageUrl || null,
        categoryId,
      }
      if (body.data.trackExpiry !== undefined) {
        data.trackExpiry = body.data.trackExpiry
      }
      if (body.data.requiresPrescription !== undefined) {
        data.requiresPrescription = body.data.requiresPrescription
      }
      // Branch path already synced Product.stockQuantity to branch sum
      if (!(stockDelta !== 0 && branchId)) {
        data.stockQuantity = body.data.stockQuantity
      }
      return tx.product.update({ where: { id: existing.id }, data })
    })
    await syncBarcodePoolClaim(
      prisma,
      businessId,
      product.id,
      product.barcode,
    )
    if (product.barcode) {
      const claimed = await prisma.barcodeCode.findFirst({
        where: { businessId, code: product.barcode, status: 'CLAIMED' },
        select: { batchId: true },
      })
      if (claimed) await refreshBatchExhaustion(prisma, claimed.batchId)
    }
    await writeAudit(
      stockDelta < 0 ? 'product.stock_shrink' : 'product.update',
      {
        businessId,
        userId: req.auth!.sub,
        entity: 'Product',
        entityId: product.id,
        before: {
          name: existing.name,
          sellingPrice: existing.sellingPrice,
          costPrice: existing.costPrice,
          stockQuantity: existing.stockQuantity,
        },
        after: {
          name: product.name,
          sellingPrice: product.sellingPrice,
          costPrice: product.costPrice,
          stockQuantity: product.stockQuantity,
          stockDelta: stockDelta !== 0 ? stockDelta : undefined,
        },
      },
    )
    if (stockDelta <= -5) {
      await createOwnerAlert({
        businessId,
        type: 'RISK',
        title: 'Stock shrink adjustment',
        body: `${product.name}: stock dropped by ${Math.abs(stockDelta)} units outside a sale.`,
        meta: { productId: product.id, stockDelta },
      })
    }
    res.json({ product })
  } catch {
    res.status(400).json({ error: 'Update failed' })
  }
})

productsRouter.get(
  '/:id/batches',
  requireAnyPermission('inventory', 'sell'),
  async (req: AuthedRequest, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, businessId: req.businessId! },
      select: { id: true, name: true },
    })
    if (!product) return res.status(404).json({ error: 'Product not found' })
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const batches = await prisma.productBatch.findMany({
      where: { businessId: req.businessId!, productId: product.id },
      orderBy: [{ expiryDate: 'asc' }, { receivedAt: 'asc' }],
    })
    res.json({
      product,
      batches: batches.map((b) => ({
        ...b,
        expired: b.expiryDate < today,
        daysLeft: Math.ceil(
          (b.expiryDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
        ),
      })),
    })
  },
)

productsRouter.delete('/:id', requirePermission('inventory'), async (req: AuthedRequest, res) => {
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, businessId: req.businessId! },
  })
  if (!existing) return res.status(404).json({ error: 'Product not found' })
  await prisma.product.update({
    where: { id: existing.id },
    data: { active: false },
  })
  await writeAudit('product.deactivate', {
    businessId: req.businessId!,
    userId: req.auth!.sub,
    entity: 'Product',
    entityId: existing.id,
    before: { active: true, name: existing.name },
    after: { active: false },
  })
  res.json({ ok: true })
})

productsRouter.post('/:id/receive', requirePermission('receive_stock'), async (req: AuthedRequest, res) => {
  const businessId = req.businessId!
  const qty = Number(req.body.quantity)
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Quantity must be > 0' })
  }
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, businessId },
  })
  if (!existing) return res.status(404).json({ error: 'Product not found' })

  const product = await prisma.$transaction(async (tx) => {
    await ensureBranchStockSeeded(businessId, tx)
    const branchId = await resolveStockBranchId(businessId, req.branchId, tx)
    const amount = Math.floor(qty)
    if (branchId) {
      await applyBranchStockDelta(tx, {
        businessId,
        branchId,
        productId: existing.id,
        delta: amount,
        movementType: 'PURCHASE',
        note: req.body.note || 'Stock received',
      })
      return tx.product.findUniqueOrThrow({ where: { id: existing.id } })
    }
    const updated = await tx.product.update({
      where: { id: existing.id },
      data: { stockQuantity: { increment: amount } },
    })
    await tx.stockMovement.create({
      data: {
        businessId,
        productId: existing.id,
        type: 'PURCHASE',
        quantity: amount,
        note: req.body.note || 'Stock received',
      },
    })
    return updated
  })

  await writeAudit('product.receive_stock', {
    businessId,
    userId: req.auth!.sub,
    entity: 'Product',
    entityId: existing.id,
    before: { stockQuantity: existing.stockQuantity, name: existing.name },
    after: {
      name: product.name,
      stockQuantity: product.stockQuantity,
      received: Math.floor(qty),
    },
  })
  res.json({ product })
})

productsRouter.get(
  '/:id/movements',
  requireAnyPermission('inventory', 'receive_stock'),
  async (req: AuthedRequest, res) => {
  const businessId = req.businessId!
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, businessId },
  })
  if (!existing) return res.status(404).json({ error: 'Product not found' })

  const movements = await prisma.stockMovement.findMany({
    where: { businessId, productId: existing.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  res.json({ movements })
},
)

