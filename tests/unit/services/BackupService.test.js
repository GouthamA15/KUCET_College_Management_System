import { describe, it, expect } from 'vitest';
import BackupService from '@/services/archive/BackupService';

describe('BackupService', () => {
  it('should run automated backup and return summary', async () => {
    const summary = await BackupService.runAutomatedBackup({ includeDatabase: true, includeArchive: true });
    expect(summary.status).toBe('SUCCESS');
    expect(summary.checksum).toBeDefined();
    expect(summary.databaseIncluded).toBe(true);
  });

  it('should verify backup checksum integrity', async () => {
    const verification = await BackupService.verifyBackup('BACKUP-123');
    expect(verification.verified).toBe(true);
    expect(verification.integrityChecksumMatch).toBe(true);
  });

  it('should prune expired backups according to retention days', async () => {
    const prune = await BackupService.pruneExpiredBackups(30);
    expect(prune.retentionDays).toBe(30);
    expect(prune.cutoffDate).toBeDefined();
  });
});
