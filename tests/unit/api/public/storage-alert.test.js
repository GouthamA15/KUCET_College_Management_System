import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiUtils from '@/lib/api-utils';
import { v2 as cloudinary } from 'cloudinary';
import { GET as getStorageAlert } from '@/app/api/public/system/storage-alert/route';

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    api: {
      usage: vi.fn(),
    },
  },
}));

vi.mock('@/lib/email', () => ({
  sendInstitutionalEmail: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Storage Limit Alert Route Security & Trigger Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.CRON_SECRET = 'super-secret-cron-token';
  });

  it('should reject unauthenticated calls without cron secret or admin session with 401', async () => {
    vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValue(null);

    const req = new Request('http://localhost/api/public/system/storage-alert');
    const res = await getStorageAlert(req);
    expect(res.status).toBe(401);
  });

  it('should allow execution with valid Bearer CRON_SECRET and report safe usage', async () => {
    cloudinary.api.usage.mockResolvedValue({
      storage: {
        usage: 5 * 1024 * 1024 * 1024, // 5GB
        limit: 25 * 1024 * 1024 * 1024, // 25GB
      },
    });

    const req = new Request('http://localhost/api/public/system/storage-alert', {
      headers: { authorization: 'Bearer super-secret-cron-token' },
    });
    const res = await getStorageAlert(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.alert_sent).toBe(false);
    expect(data.usage).toBe('5.00 GB');
  });

  it('should allow execution with admin session and trigger alert when usage >= 20GB', async () => {
    vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });
    cloudinary.api.usage.mockResolvedValue({
      storage: {
        usage: 22 * 1024 * 1024 * 1024, // 22GB
        limit: 25 * 1024 * 1024 * 1024,
      },
    });

    const req = new Request('http://localhost/api/public/system/storage-alert');
    const res = await getStorageAlert(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.alert_sent).toBe(true);
    expect(data.usage).toBe('22.00 GB');
  });
});
