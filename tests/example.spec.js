// @ts-check
import { test, expect } from '@playwright/test';

test.describe('KUCET CMS Portal Landing & Public Navigation', () => {
  test('should load public landing page with college title and navigation', async ({ page }) => {
    await page.goto('/');

    // Expect page title or institutional branding
    await expect(page).toHaveTitle(/KUCET/i);
    await expect(page.getByText(/Kakatiya University/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('should provide student and staff login interaction', async ({ page }) => {
    await page.goto('/');

    // Check presence of login buttons / links
    const studentBtn = page.getByRole('button', { name: /STUDENT LOGIN/i }).or(page.getByText(/STUDENT LOGIN/i)).first();
    await expect(studentBtn).toBeVisible({ timeout: 10000 });
  });
});
