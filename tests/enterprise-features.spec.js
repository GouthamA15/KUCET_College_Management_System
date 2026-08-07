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

  test('should render offline fallback page at /offline', async ({ page }) => {
    await page.goto('/offline');
    await expect(page.getByRole('heading', { name: 'You are Offline' })).toBeVisible();
    await expect(page.getByText('Digital ID Card')).toBeVisible();
    await expect(page.getByText('Fee Receipts')).toBeVisible();
    await expect(page.getByText('Weekly Timetable')).toBeVisible();
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
