import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { lanIpv4Addresses, shopUrlsForLan } from './lan.js'
import { auditRouter } from './routes/audit.js'
import { authRouter } from './routes/auth.js'
import { branchesRouter } from './routes/branches.js'
import { businessRouter } from './routes/business.js'
import { customersRouter } from './routes/customers.js'
import { insightsRouter } from './routes/insights.js'
import { onboardingRouter } from './routes/onboarding.js'
import { paymentsRouter } from './routes/payments.js'
import { platformRouter } from './routes/platform.js'
import { productsRouter } from './routes/products.js'
import { salesRouter } from './routes/sales.js'
import { teamRouter } from './routes/team.js'

const app = express()
const PORT = Number(process.env.PORT || 4000)
const WEB_PORT = Number(process.env.WEB_PORT || 5173)

app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'nexora-api',
    product: 'NEXORA',
    version: '0.1.0',
    phase: 'p1-rbac',
  })
})

/** Wi‑Fi / public shop URLs for phone QR (prefer real HTTPS tunnel if set). */
app.get('/api/lan', (_req, res) => {
  const addresses = lanIpv4Addresses()
  const shopUrls = shopUrlsForLan(WEB_PORT)
  const publicOrigin = (process.env.SHOP_PUBLIC_ORIGIN || '').replace(/\/$/, '')
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
app.use('/api/sales', salesRouter)
app.use('/api/customers', customersRouter)
app.use('/api/team', teamRouter)
app.use('/api/onboarding', onboardingRouter)
app.use('/api/insights', insightsRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/audit', auditRouter)

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    const shops = shopUrlsForLan(WEB_PORT)
    console.log(`NEXORA API listening on http://0.0.0.0:${PORT}`)
    if (shops.length) {
      console.log(`Wi‑Fi shop (open on counter / phone): ${shops[0]}`)
    } else {
      console.log(`Shop UI: http://localhost:${WEB_PORT}`)
    }
  })
}

export default app
export { app }
