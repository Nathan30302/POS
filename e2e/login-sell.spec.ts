import { expect, test } from '@playwright/test'

/**
 * Happy-path: landing → login (demo) → Sell loads.
 * Requires: API + Vite running (npm run dev) OR webServer in playwright.config.
 */
test.describe('NEXORA login → Sell', () => {
  test('owner can open Sell', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('owner@demo.shop')
    await page.getByLabel('Password').fill('DemoOwner1!')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/app\//, { timeout: 15_000 })

    // Navigate to Sell if not already home
    const sellLink = page.getByRole('link', { name: /^Sell$/i }).first()
    if (await sellLink.isVisible().catch(() => false)) {
      await sellLink.click()
    } else {
      await page.goto('/app/checkout')
    }

    await expect(page.getByText(/sell|catalogue|cart|checkout/i).first()).toBeVisible({
      timeout: 15_000,
    })
  })
})
