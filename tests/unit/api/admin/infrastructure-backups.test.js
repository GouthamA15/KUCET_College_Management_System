import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiUtils from '@/lib/api-utils';
import { DatabaseBackupService } from '@/services/backup/DatabaseBackupService.js';
import { GET as listBackups, POST as createBackup } from '@/app/api/admin/infrastructure/backups/route.js';
import { POST as restoreBackup } from '@/app/api/admin/infrastructure/backups/restore/route.js';

describe('Admin Infrastructure Backups API Routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/admin/infrastructure/backups', () => {
    it('should return 401 if user is not authenticated as admin', async () => {
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValue(null);
      const res = await listBackups(new Request('http://localhost/api/admin/infrastructure/backups'));
      expect(res.status).toBe(401);
    });

    it('should return list of backups for authenticated admin', async () => {
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });
      vi.spyOn(DatabaseBackupService, 'listBackups').mockResolvedValue([
        { filename: 'kucet_cms_2026-08-28.sql.gz', size: 1024, created_at: new Date().toISOString() }
      ]);

      const res = await listBackups(new Request('http://localhost/api/admin/infrastructure/backups'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.backups).toHaveLength(1);
      expect(data.backups[0].filename).toBe('kucet_cms_2026-08-28.sql.gz');
    });
  });

  describe('POST /api/admin/infrastructure/backups', () => {
    it('should return 401 if user is not admin', async () => {
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValue(null);
      const res = await createBackup(new Request('http://localhost/api/admin/infrastructure/backups', { method: 'POST' }));
      expect(res.status).toBe(401);
    });

    it('should create manual backup when requested by super admin', async () => {
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });
      vi.spyOn(DatabaseBackupService, 'createBackup').mockResolvedValue({
        filename: 'kucet_cms_2026-08-28_12-00-00.sql.gz',
        checksum: 'sha256-mock-hash',
        sizeBytes: 2048,
        durationMs: 120,
      });

      const res = await createBackup(new Request('http://localhost/api/admin/infrastructure/backups', { method: 'POST' }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.backup.filename).toBe('kucet_cms_2026-08-28_12-00-00.sql.gz');
    });
  });

  describe('POST /api/admin/infrastructure/backups/restore', () => {
    it('should reject restore request if confirm phrase is missing or invalid', async () => {
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });
      
      const req = new Request('http://localhost/api/admin/infrastructure/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'kucet_cms_2026-08-28.sql.gz', confirmPhrase: 'WRONG' }),
      });

      const res = await restoreBackup(req);
      expect(res.status).toBe(400);
    });

    it('should trigger guarded restore when valid confirmation phrase is provided', async () => {
      vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });
      vi.spyOn(DatabaseBackupService, 'restoreBackup').mockResolvedValue({
        success: true,
        message: 'Database restored',
        verifiedTables: 24,
        emergencyBackupFilename: 'kucet_cms_emergency.sql.gz',
      });

      const req = new Request('http://localhost/api/admin/infrastructure/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'kucet_cms_2026-08-28.sql.gz', confirmPhrase: 'RESTORE' }),
      });

      const res = await restoreBackup(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.emergencyBackupFilename).toBe('kucet_cms_emergency.sql.gz');
    });
  });
});
