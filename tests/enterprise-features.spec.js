import { test, expect } from '@playwright/test';

test.describe('Enterprise Capabilities & Infrastructure Verification', () => {
  test('should serve web app manifest.json correctly', async ({ request }) => {
    const response = await request.get('/manifest.json');
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.short_name).toBe('KUCET CMS');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
  });

  test('should render offline fallback page with shortcuts and connection diagnostics', async ({ page }) => {
    // 1. Visit /offline in standard mode (diagnostics view)
    await page.goto('/offline');
    const heading = page.getByRole('heading', { name: /You are Offline|Service Temporarily Unavailable|Connection Restored/i });
    await expect(heading).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Digital ID Card')).toBeVisible();
    await expect(page.getByText('Fee Receipts')).toBeVisible();
    await expect(page.getByText('Weekly Timetable')).toBeVisible();

    // 2. Simulate offline browser context while on the offline diagnostics page
    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.getByRole('heading', { name: 'You are Offline' })).toBeVisible({ timeout: 10000 });
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
  });

  test('should enforce baseline authentication on admin backup schedule API', async ({ request }) => {
    const response = await request.get('/api/admin/infrastructure/backups/schedule');
    expect(response.status()).toBe(401);
  });

  test('should enforce baseline authentication on admin storage audit API', async ({ request }) => {
    const response = await request.get('/api/admin/infrastructure/storage/audit');
    expect(response.status()).toBe(401);
  });

  test('should enforce baseline authentication on push notification subscribe API', async ({ request }) => {
    const response = await request.post('/api/notifications/subscribe', {
      data: {
        subscription: {
          endpoint: 'https://push.example.com/test',
          keys: { p256dh: 'p256dh', auth: 'auth' },
        },
      },
    });
    expect(response.status()).toBe(401);
  });
});
