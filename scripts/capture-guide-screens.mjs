/**
 * Capture real NEXORA UI screenshots for the operator guide.
 * Requires: npm run dev (web :5173 + API :4000)
 *
 *   node scripts/capture-guide-screens.mjs
 */
import { chromium, devices } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173'
const OUT = path.resolve('public/docs/guide-screens')

const PAGES = [
  { id: 'sell', path: '/app/checkout', wait: /Sell|catalogue|Complete/i },
  { id: 'command', path: '/app/dashboard', wait: /Command|Trust|revenue|today/i },
  { id: 'inventory', path: '/app/products', wait: /Stock|catalogue|Inventory/i },
  { id: 'ledger', path: '/app/sales', wait: /Ledger|Sales|sale/i },
  { id: 'pulse', path: '/app/insights', wait: /Pulse|Health|integrity/i },
  { id: 'customers', path: '/app/customers', wait: /Customer/i },
  { id: 'team', path: '/app/team', wait: /Team|staff|Invite/i },
  { id: 'settings', path: '/app/settings', wait: /Settings|Business|theme/i },
  { id: 'expenses', path: '/app/expenses', wait: /Expense/i },
  { id: 'audit', path: '/app/audit', wait: /Audit/i },
]

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email').fill('owner@demo.shop')
  await page.getByLabel('Password').fill('DemoOwner1!')
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/app\//, { timeout: 20_000 })
}

async function shoot(browser, label, contextOptions) {
  const context = await browser.newContext({
    ...contextOptions,
    baseURL: BASE,
  })
  const page = await context.newPage()
  await login(page)

  for (const route of PAGES) {
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle' }).catch(() =>
      page.goto(`${BASE}${route.path}`, { waitUntil: 'domcontentloaded' }),
    )
    await page.waitForTimeout(900)
    try {
      await page.getByText(route.wait).first().waitFor({ timeout: 12_000 })
    } catch {
      /* still capture whatever rendered */
    }
    const file = path.join(OUT, `${route.id}-${label}.png`)
    await page.screenshot({ path: file, fullPage: false })
    console.log('wrote', file)
  }

  await context.close()
}

fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
try {
  await shoot(browser, 'desktop', {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })
  await shoot(browser, 'phone', {
    ...devices['iPhone 13'],
  })
} finally {
  await browser.close()
}

console.log('Done →', OUT)
