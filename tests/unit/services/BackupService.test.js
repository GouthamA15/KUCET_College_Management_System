import { describe, it, expect, vi, beforeEach } from 'vitest';
import BackupService from '@/services/archive/BackupService';
import { DatabaseBackupService } from '@/services/backup/DatabaseBackupService';

describe('BackupService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should run automated backup and return summary', async () => {
    vi.spyOn(DatabaseBackupService, 'createBackup').mockResolvedValue({
      filename: 'kucet_cms_2026-08-28.sql.gz',
      checksum: 'mock-sha256-hash',
      sizeBytes: 1024,
    });

    const summary = await BackupService.runAutomatedBackup({ includeDatabase: true, includeArchive: true });
    expect(summary.status).toBe('SUCCESS');
    expect(summary.checksum).toBe('mock-sha256-hash');
    expect(summary.databaseIncluded).toBe(true);
  });

  it('should verify backup checksum integrity', async () => {
    const verification = await BackupService.verifyBackup('BACKUP-123');
    expect(verification.verified).toBe(true);
    expect(verification.integrityChecksumMatch).toBe(true);
  });

  it('should prune expired backups according to retention days', async () => {
    vi.spyOn(DatabaseBackupService, 'pruneRetention').mockResolvedValue({
      prunedCount: 2,
      prunedFiles: ['old1.sql.gz', 'old2.sql.gz'],
    });

    const prune = await BackupService.pruneExpiredBackups(14);
    expect(prune.retentionDays).toBe(14);
    expect(prune.cutoffDate).toBeDefined();
    expect(prune.prunedCount).toBe(2);
  });
});
