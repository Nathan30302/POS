import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { authRouter } from './routes/auth.js'
import { businessRouter } from './routes/business.js'
import { customersRouter } from './routes/customers.js'
import { insightsRouter } from './routes/insights.js'
import { onboardingRouter } from './routes/onboarding.js'
import { platformRouter } from './routes/platform.js'
import { productsRouter } from './routes/products.js'
import { salesRouter } from './routes/sales.js'
import { teamRouter } from './routes/team.js'

const app = express()
const PORT = Number(process.env.PORT || 4000)

app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'nexora-api', product: 'NEXORA', version: '0.1.0' })
})

app.use('/api/auth', authRouter)
app.use('/api/platform', platformRouter)
app.use('/api/business', businessRouter)
app.use('/api/products', productsRouter)
app.use('/api/sales', salesRouter)
app.use('/api/customers', customersRouter)
app.use('/api/team', teamRouter)
app.use('/api/onboarding', onboardingRouter)
app.use('/api/insights', insightsRouter)

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`NEXORA API listening on http://localhost:${PORT}`)
  })
}

export default app
export { app }
