import { test, expect } from '@playwright/test'

test.describe('Login Flow', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/')
    
    // Check if login form is visible
    await expect(page.locator('form')).toBeVisible()
    await expect(page.locator('input[type="text"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should show error on wrong credentials', async ({ page }) => {
    await page.goto('/')
    
    // Fill wrong credentials
    await page.fill('input[type="text"]', 'wronguser')
    await page.fill('input[type="password"]', 'wrongpass')
    await page.click('button[type="submit"]')
    
    // Should show error message
    await expect(page.locator('text=登录失败')).toBeVisible()
  })

  test('should login successfully with correct credentials', async ({ page }) => {
    await page.goto('/')
    
    // Fill correct credentials (assuming test user exists)
    await page.fill('input[type="text"]', 'test')
    await page.fill('input[type="password"]', '123456')
    await page.click('button[type="submit"]')
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/)
    await expect(page.locator('text=仪表盘')).toBeVisible()
  })
})
