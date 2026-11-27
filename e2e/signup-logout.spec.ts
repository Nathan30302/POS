import { expect, test } from '@playwright/test'

test.describe('Signup pending + logout', () => {
  test('signup submits for approval and does not enter shop', async ({
    page,
  }) => {
    const stamp = Date.now()
    await page.goto('/signup')
    await page
      .getByLabel(/shop name/i)
      .fill(`E2E Shop ${stamp}`)
    await page.getByLabel(/^your name$/i).fill('E2E Owner')
    await page.getByLabel(/login email/i).fill(`e2e-${stamp}@example.com`)
    await page.getByLabel(/password/i).fill('E2ePass1!')
    await page.getByRole('button', { name: /submit shop for approval/i }).click()

    await expect(
      page.getByText(/must approve|submitted|NEXORA admin/i).first(),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page).not.toHaveURL(/\/app\//)
  })

  test('owner can sign out', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('owner@demo.shop')
    await page.getByLabel('Password').fill('DemoOwner1!')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/app\//, { timeout: 15_000 })

    await page.getByRole('button', { name: /sign out/i }).first().click()
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })
})
