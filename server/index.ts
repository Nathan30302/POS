import 'dotenv/config'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import fs from 'node:fs'
import path from 'node:path'
import { loadAppEnv } from './env.js'
import { lanIpv4Addresses, shopUrlsForLan } from './lan.js'
import { csrfOriginCheck } from './csrfOrigin.js'
import { log } from './logger.js'
import { requireAuth } from './middleware.js'
import { prisma } from './prisma.js'
import { requestContext } from './requestContext.js'
import { auditRouter } from './routes/audit.js'
import { authRouter } from './routes/auth.js'
import { barcodeBatchesRouter } from './routes/barcodeBatches.js'
import { branchesRouter } from './routes/branches.js'
import { businessRouter } from './routes/business.js'
import { customersRouter } from './routes/customers.js'
import { expensesRouter } from './routes/expenses.js'
import { insightsRouter } from './routes/insights.js'
import { notificationsRouter } from './routes/notifications.js'
import { onboardingRouter } from './routes/onboarding.js'
import { paymentsRouter } from './routes/payments.js'
import { platformRouter } from './routes/platform.js'
import { productsRouter } from './routes/products.js'
import { purchasingRouter } from './routes/purchasing.js'
import { salesRouter } from './routes/sales.js'
import { shiftsRouter } from './routes/shifts.js'
import { subscriptionRouter } from './routes/subscription.js'
import { pharmacyRouter } from './routes/pharmacy.js'
import { teamRouter } from './routes/team.js'
import { transfersRouter } from './routes/transfers.js'

const env = loadAppEnv()
const app = express()
const PORT = env.port
const WEB_PORT = env.webPort
const startedAt = Date.now()

if (env.isProd) {
  app.set('trust proxy', 1)
}

app.use(
  helmet({
    // SPA + API same origin / Vite proxy — avoid blocking inline styles/scripts in UI
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
)
app.use(requestContext)

if (env.corsOrigins?.length) {
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || env.corsOrigins!.includes(origin)) cb(null, true)
        else cb(null, false)
      },
      credentials: true,
    }),
  )
} else {
  // Reflect request origin so credentialed cookie auth works in LAN/dev
  app.use(cors({ origin: true, credentials: true }))
}

app.use(cookieParser())
app.use(csrfOriginCheck)
app.use(express.json({ limit: '2mb' }))

const uploadsStatic = express.static(path.join(process.cwd(), 'uploads'), {
  maxAge: '7d',
  fallthrough: false,
  index: false,
  dotfiles: 'deny',
  setHeaders(res, filePath) {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Disposition', 'inline')
    const lower = filePath.toLowerCase()
    if (!/\.(png|jpe?g|gif|webp|svg)$/.test(lower)) {
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Disposition', 'attachment')
    }
  },
})
if (env.isProd) {
  // Production: require a valid session (cookie or Bearer) to read uploads
  app.use('/uploads', requireAuth, uploadsStatic)
} else {
  app.use('/uploads', uploadsStatic)
}

app.get('/api/health', async (_req, res) => {
  let dbOk = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbOk = true
  } catch {
    dbOk = false
  }
  const status = dbOk ? 200 : 503
  // Do not expose raw DB error strings to anonymous callers
  res.status(status).json({
    ok: dbOk,
    service: 'nexora-api',
    product: 'NEXORA',
    version: '0.1.0',
    phase: 'p6-saas-commercialization',
    env: env.nodeEnv,
    dbProvider: env.dbProvider,
    dbOk,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
  })
})

app.get('/api/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ ready: true })
  } catch {
    res.status(503).json({ ready: false })
  }
})

/** Wi‑Fi / public shop URLs for phone QR (prefer real HTTPS tunnel if set). */
app.get('/api/lan', (_req, res) => {
  const addresses = lanIpv4Addresses()
  const shopUrls = shopUrlsForLan(WEB_PORT)
  const publicOrigin = env.shopPublicOrigin
  const preferredOrigin = publicOrigin || shopUrls[0] || null
  res.json({
    addresses,
    shopUrls: publicOrigin ? [publicOrigin, ...shopUrls] : shopUrls,
    preferredOrigin,
    webPort: WEB_PORT,
  })
})

app.use('/api/auth', authRouter)
app.use('/api/platform', platformRouter)
app.use('/api/business', businessRouter)
app.use('/api/branches', branchesRouter)
app.use('/api/products', productsRouter)
app.use('/api/barcode-batches', barcodeBatchesRouter)
app.use('/api/sales', salesRouter)
app.use('/api/customers', customersRouter)
app.use('/api/expenses', expensesRouter)
app.use('/api/team', teamRouter)
app.use('/api/onboarding', onboardingRouter)
app.use('/api/insights', insightsRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/audit', auditRouter)
app.use('/api/shifts', shiftsRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/transfers', transfersRouter)
app.use('/api/purchasing', purchasingRouter)
app.use('/api/subscription', subscriptionRouter)
app.use('/api/pharmacy', pharmacyRouter)

// Production, or SERVE_SPA=1 (phone / Cloudflare tunnel on one port)
const distDir = path.join(process.cwd(), 'dist')
const serveSpa =
  (env.isProd || process.env.SERVE_SPA === '1') && fs.existsSync(distDir)
if (serveSpa) {
  // Tunnel terminates TLS; trust X-Forwarded-* for correct Host matching
  app.set('trust proxy', 1)
  app.use(express.static(distDir, { maxAge: '1h', index: false }))
  app.get(/^(?!\/api\/|\/uploads\/).*/, (req, res) => {
    // Missing pictures must 404. Returning index.html makes <img> look blank.
    if (
      /\.(?:png|jpe?g|gif|webp|svg|ico|avif|css|js|map|woff2?|ttf|mp4|webm|pdf)$/i.test(
        req.path,
      )
    ) {
      res.status(404).type('text/plain').send('Not found')
      return
    }
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error('unhandled', {
    requestId: req.requestId,
    err: err instanceof Error ? err.message : 'unknown',
  })
  res.status(500).json({ error: 'Internal server error' })
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    const shops = shopUrlsForLan(WEB_PORT)
    log.info('api.listen', {
      port: PORT,
      dbProvider: env.dbProvider,
      env: env.nodeEnv,
    })
    if (shops.length) {
      log.info('shop.url', { url: shops[0] })
    } else {
      log.info('shop.url', { url: `http://localhost:${WEB_PORT}` })
    }
  })
}

export default app
export { app }
