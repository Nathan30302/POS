import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
page.on('pageerror', (err) => console.error('pageerror', err.message))
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('console', msg.text())
})
await page.goto('http://127.0.0.1:5173/scan-bench', { waitUntil: 'networkidle' })
await page.waitForFunction(
  () => {
    const el = document.getElementById('scan-bench-result')
    return el && el.textContent && !el.textContent.includes('running')
  },
  { timeout: 25000 },
)
const text = (await page.textContent('#scan-bench-result'))?.trim() || ''
console.log(text)
await browser.close()
if (!text.startsWith('PASS')) process.exit(1)
