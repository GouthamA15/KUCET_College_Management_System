import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import zlib from 'zlib';
import crypto from 'crypto';
import { DatabaseBackupService } from '@/services/backup/DatabaseBackupService.js';

describe('DatabaseBackupService', () => {
  let testBackupDir;

  beforeEach(() => {
    testBackupDir = path.join(os.tmpdir(), `kucet_backup_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    fs.mkdirSync(testBackupDir, { recursive: true });
    vi.spyOn(DatabaseBackupService, 'getBackupDirectory').mockReturnValue(testBackupDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(testBackupDir)) {
      try {
        fs.rmSync(testBackupDir, { recursive: true, force: true });
      } catch (_e) { /* ignore */ }
    }
  });

  describe('Locking Mechanism', () => {
    it('should acquire and release lock cleanly', () => {
      const lockFile = DatabaseBackupService.acquireLock('test-op');
      expect(fs.existsSync(lockFile)).toBe(true);

      const lockContent = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      expect(lockContent.operation).toBe('test-op');
      expect(lockContent.pid).toBe(process.pid);

      DatabaseBackupService.releaseLock();
      expect(fs.existsSync(lockFile)).toBe(false);
    });

    it('should throw error if concurrent operation attempts to acquire active lock', () => {
      DatabaseBackupService.acquireLock('first-op');
      
      expect(() => {
        DatabaseBackupService.acquireLock('second-op');
      }).toThrow(/already in progress/i);

      DatabaseBackupService.releaseLock();
    });

    it('should overwrite stale lock older than timeout', () => {
      const lockPath = path.join(testBackupDir, '.backup.lock');
      // Create stale lock (20 minutes old)
      const staleTime = Date.now() - (20 * 60 * 1000);
      fs.writeFileSync(lockPath, JSON.stringify({ operation: 'stale-op', timestamp: staleTime, pid: 99999 }));

      const newLock = DatabaseBackupService.acquireLock('fresh-op');
      expect(fs.existsSync(newLock)).toBe(true);
      const content = JSON.parse(fs.readFileSync(newLock, 'utf8'));
      expect(content.operation).toBe('fresh-op');
      DatabaseBackupService.releaseLock();
    });
  });

  describe('SHA-256 Checksum Calculation', () => {
    it('should accurately calculate file SHA-256 hash', async () => {
      const testFile = path.join(testBackupDir, 'sample.txt');
      const testContent = 'KUCET College Management System Backup Integrity Test';
      fs.writeFileSync(testFile, testContent, 'utf8');

      const expectedHash = crypto.createHash('sha256').update(testContent).digest('hex');
      const calculatedHash = await DatabaseBackupService.calculateFileSha256(testFile);

      expect(calculatedHash).toBe(expectedHash);
    });
  });

  describe('Retention Policy (14 Days) & Invariants', () => {
    it('should prune backups older than 14 days and preserve recent backups', async () => {
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;

      // 1. Recent backup (2 days old)
      const recentFile = path.join(testBackupDir, 'kucet_cms_recent.sql.gz');
      fs.writeFileSync(recentFile, 'data-recent');
      fs.utimesSync(recentFile, (now - 2 * oneDayMs) / 1000, (now - 2 * oneDayMs) / 1000);

      // 2. Medium backup (10 days old)
      const mediumFile = path.join(testBackupDir, 'kucet_cms_medium.sql.gz');
      fs.writeFileSync(mediumFile, 'data-medium');
      fs.utimesSync(mediumFile, (now - 10 * oneDayMs) / 1000, (now - 10 * oneDayMs) / 1000);

      // 3. Expired backup (20 days old)
      const expiredFile = path.join(testBackupDir, 'kucet_cms_expired_20.sql.gz');
      fs.writeFileSync(expiredFile, 'data-expired-20');
      fs.utimesSync(expiredFile, (now - 20 * oneDayMs) / 1000, (now - 20 * oneDayMs) / 1000);

      // 4. Expired backup (35 days old)
      const expiredFile2 = path.join(testBackupDir, 'kucet_cms_expired_35.sql.gz');
      fs.writeFileSync(expiredFile2, 'data-expired-35');
      fs.utimesSync(expiredFile2, (now - 35 * oneDayMs) / 1000, (now - 35 * oneDayMs) / 1000);

      const result = await DatabaseBackupService.pruneRetention(14);

      expect(result.prunedCount).toBe(2);
      expect(result.prunedFiles).toContain('kucet_cms_expired_20.sql.gz');
      expect(result.prunedFiles).toContain('kucet_cms_expired_35.sql.gz');

      // Verify files on disk
      expect(fs.existsSync(recentFile)).toBe(true);
      expect(fs.existsSync(mediumFile)).toBe(true);
      expect(fs.existsSync(expiredFile)).toBe(false);
      expect(fs.existsSync(expiredFile2)).toBe(false);
    });

    it('INVARIANT: should NEVER delete the latest backup even if older than 14 days', async () => {
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;

      // Only one old backup exists (30 days old)
      const singleOldFile = path.join(testBackupDir, 'kucet_cms_lone_old_backup.sql.gz');
      fs.writeFileSync(singleOldFile, 'data-lone-old');
      fs.utimesSync(singleOldFile, (now - 30 * oneDayMs) / 1000, (now - 30 * oneDayMs) / 1000);

      const result = await DatabaseBackupService.pruneRetention(14);

      // Should skip pruning when <= 1 file exists
      expect(result.prunedCount).toBe(0);
      expect(fs.existsSync(singleOldFile)).toBe(true);
    });

    it('INVARIANT: with multiple old backups, must retain the newest one', async () => {
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;

      // All backups are older than 14 days
      const newestOfOld = path.join(testBackupDir, 'kucet_cms_old_20_days.sql.gz');
      fs.writeFileSync(newestOfOld, 'data-20');
      fs.utimesSync(newestOfOld, (now - 20 * oneDayMs) / 1000, (now - 20 * oneDayMs) / 1000);

      const olderFile = path.join(testBackupDir, 'kucet_cms_old_40_days.sql.gz');
      fs.writeFileSync(olderFile, 'data-40');
      fs.utimesSync(olderFile, (now - 40 * oneDayMs) / 1000, (now - 40 * oneDayMs) / 1000);

      const result = await DatabaseBackupService.pruneRetention(14);

      expect(result.prunedCount).toBe(1);
      expect(result.prunedFiles).toContain('kucet_cms_old_40_days.sql.gz');
      expect(fs.existsSync(newestOfOld)).toBe(true); // Newest is preserved
      expect(fs.existsSync(olderFile)).toBe(false);
    });
  });

  describe('Restore Validation and Security Guards', () => {
    it('should reject restore if confirmation phrase does not match RESTORE', async () => {
      await expect(DatabaseBackupService.restoreBackup({
        filename: 'kucet_cms_2026-08-28.sql.gz',
        adminEmail: 'admin@kucet.ac.in',
        confirmPhrase: 'CONFIRM'
      })).rejects.toThrow(/confirmation phrase must be exactly "RESTORE"/i);
    });

    it('should reject restore with path traversal attempt', async () => {
      await expect(DatabaseBackupService.restoreBackup({
        filename: '../../etc/passwd',
        adminEmail: 'admin@kucet.ac.in',
        confirmPhrase: 'RESTORE'
      })).rejects.toThrow(/invalid backup filename format/i);
    });

    it('should reject restore if file does not exist on disk', async () => {
      await expect(DatabaseBackupService.restoreBackup({
        filename: 'kucet_cms_nonexistent_file.sql.gz',
        adminEmail: 'admin@kucet.ac.in',
        confirmPhrase: 'RESTORE'
      })).rejects.toThrow(/does not exist on disk/i);
    });
  });

  describe('Download Stream Validation', () => {
    it('should return read stream and size for valid backup file', async () => {
      const validFilename = 'kucet_cms_2026-08-28_12-00-00.sql.gz';
      const filePath = path.join(testBackupDir, validFilename);
      const content = zlib.gzipSync('SELECT 1;');
      fs.writeFileSync(filePath, content);

      const streamInfo = DatabaseBackupService.getBackupStream(validFilename);
      expect(streamInfo.filename).toBe(validFilename);
      expect(streamInfo.size).toBe(content.length);
      expect(streamInfo.isGzip).toBe(true);
      expect(streamInfo.stream).toBeDefined();

      // Drain stream cleanly
      await new Promise((resolve) => {
        streamInfo.stream.on('data', () => {});
        streamInfo.stream.on('end', resolve);
        streamInfo.stream.on('close', resolve);
      });
    });

    it('should throw error for path traversal download attempt', () => {
      expect(() => {
        DatabaseBackupService.getBackupStream('../../../etc/shadow');
      }).toThrow(/invalid backup filename/i);
    });
  });
});
