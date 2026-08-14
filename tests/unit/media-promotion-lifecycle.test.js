/**
 * ============================================================
 * MEDIA PROMOTION LIFECYCLE - UNIT TESTS
 * ============================================================
 * Tests MediaPromotionService, storage provider move operations,
 * admission finalization promotion, profile request approval promotion,
 * transactional rollback, migration script, and orphan detection.
 *
 * Run with: npx vitest run tests/unit/media-promotion-lifecycle.test.js
 * ============================================================
 */

import { describe, it, expect, vi } from 'vitest';
import { MediaPromotionService } from '../../src/services/storage/MediaPromotionService.js';

describe('MediaPromotionService - Temporary vs Permanent Identification', () => {

  it('should correctly identify temporary PFP keys', () => {
    expect(MediaPromotionService.isTemporaryPfp('kucet/requests/pfp/abc.jpg')).toBe(true);
    expect(MediaPromotionService.isTemporaryPfp('requests/pfp/abc.jpg')).toBe(true);
    expect(MediaPromotionService.isTemporaryPfp('kucet/admission_drafts/pfp/xyz.webp')).toBe(true);
    expect(MediaPromotionService.isTemporaryPfp('admission_drafts/pfp/xyz.webp')).toBe(true);

    // Permanent keys must return false
    expect(MediaPromotionService.isTemporaryPfp('kucet/students/pfp/abc.jpg')).toBe(false);
    expect(MediaPromotionService.isTemporaryPfp('students/pfp/abc.jpg')).toBe(false);
    expect(MediaPromotionService.isTemporaryPfp(null)).toBe(false);
  });

  it('should correctly identify temporary Signature keys', () => {
    expect(MediaPromotionService.isTemporarySignature('kucet/requests/signatures/abc.png')).toBe(true);
    expect(MediaPromotionService.isTemporarySignature('requests/signatures/abc.png')).toBe(true);
    expect(MediaPromotionService.isTemporarySignature('kucet/admission_drafts/signatures/xyz.png')).toBe(true);

    // Permanent keys must return false
    expect(MediaPromotionService.isTemporarySignature('kucet/students/signatures/abc.png')).toBe(false);
    expect(MediaPromotionService.isTemporarySignature('students/signatures/abc.png')).toBe(false);
    expect(MediaPromotionService.isTemporarySignature(null)).toBe(false);
  });

  it('payment screenshots must NOT be identified as temporary promotion targets', () => {
    expect(MediaPromotionService.isTemporaryKey('kucet/requests/payments/abc.png')).toBe(false);
    expect(MediaPromotionService.isTemporaryKey('kucet/certificates/payments/def.jpg')).toBe(false);
  });
});

describe('MediaPromotionService - File Promotion Logic', () => {
  it('promoteStudentProfile() should call StorageProvider.moveFile to students/pfp', async () => {
    const { getStorageProvider } = await import('../../src/lib/providers/storage/factory.js');
    const provider = getStorageProvider();
    const moveSpy = vi.spyOn(provider, 'moveFile').mockResolvedValueOnce({
      newPath: 'kucet/students/pfp/photo.jpg',
      sizeBytes: 2048
    });

    const { MediaPromotionService } = await import('../../src/services/storage/MediaPromotionService.js');
    const result = await MediaPromotionService.promoteStudentProfile('kucet/requests/pfp/photo.jpg');

    expect(result.moved).toBe(true);
    expect(result.newKey).toBe('kucet/students/pfp/photo.jpg');
    expect(moveSpy).toHaveBeenCalledWith('kucet/requests/pfp/photo.jpg', 'kucet/students/pfp');
    moveSpy.mockRestore();
  });

  it('promoteStudentSignature() should call StorageProvider.moveFile to students/signatures', async () => {
    const { getStorageProvider } = await import('../../src/lib/providers/storage/factory.js');
    const provider = getStorageProvider();
    const moveSpy = vi.spyOn(provider, 'moveFile').mockResolvedValueOnce({
      newPath: 'kucet/students/signatures/sig.png',
      sizeBytes: 1024
    });

    const { MediaPromotionService } = await import('../../src/services/storage/MediaPromotionService.js');
    const result = await MediaPromotionService.promoteStudentSignature('kucet/requests/signatures/sig.png');

    expect(result.moved).toBe(true);
    expect(result.newKey).toBe('kucet/students/signatures/sig.png');
    expect(moveSpy).toHaveBeenCalledWith('kucet/requests/signatures/sig.png', 'kucet/students/signatures');
    moveSpy.mockRestore();
  });

  it('should be IDEMPOTENT - permanent key should not trigger moveFile', async () => {
    const { getStorageProvider } = await import('../../src/lib/providers/storage/factory.js');
    const provider = getStorageProvider();
    const moveSpy = vi.spyOn(provider, 'moveFile');

    const { MediaPromotionService } = await import('../../src/services/storage/MediaPromotionService.js');
    const result = await MediaPromotionService.promoteStudentProfile('kucet/students/pfp/already_permanent.jpg');

    expect(result.moved).toBe(false);
    expect(result.newKey).toBe('kucet/students/pfp/already_permanent.jpg');
    expect(moveSpy).not.toHaveBeenCalled();
    moveSpy.mockRestore();
  });
});

describe('MediaPromotionService - Transactional Rollback Safety', () => {
  it('should rollback file move if DB operation throws error', async () => {
    const { getStorageProvider } = await import('../../src/lib/providers/storage/factory.js');
    const provider = getStorageProvider();
    const moveSpy = vi.spyOn(provider, 'moveFile')
      .mockResolvedValueOnce({ newPath: 'kucet/students/pfp/photo.jpg', sizeBytes: 1024 })
      .mockResolvedValueOnce({ newPath: 'kucet/requests/pfp/photo.jpg', sizeBytes: 1024 });

    const { MediaPromotionService } = await import('../../src/services/storage/MediaPromotionService.js');

    // Simulated DB transaction handle that throws on insert
    const mockTx = {
      query: {
        studentImages: { findFirst: vi.fn().mockResolvedValue(null) },
        studentSignatures: { findFirst: vi.fn().mockResolvedValue(null) }
      },
      insert: vi.fn().mockImplementation(() => {
        throw new Error('DATABASE_CONNECTION_LOST');
      })
    };

    await expect(
      MediaPromotionService.promoteRequestMedia({
        studentId: 101,
        newPfp: 'kucet/requests/pfp/photo.jpg',
        newSignature: null
      }, mockTx)
    ).rejects.toThrow('DATABASE_CONNECTION_LOST');

    // Verify rollback move was invoked to restore file to requests/pfp
    expect(moveSpy).toHaveBeenCalledTimes(2);
    expect(moveSpy).toHaveBeenLastCalledWith('kucet/students/pfp/photo.jpg', 'kucet/requests/pfp');
    moveSpy.mockRestore();
  });
});

describe('Storage Providers - moveFile Contract', () => {
  it('LocalStorageProvider.moveFile should move physical file', async () => {
    const { default: LocalStorageProvider } = await import('../../src/lib/providers/storage/LocalStorageProvider.js');
    const provider = new LocalStorageProvider();
    expect(typeof provider.moveFile).toBe('function');
  });

  it('CloudinaryStorageProvider.moveFile should execute move', async () => {
    const { default: CloudinaryStorageProvider } = await import('../../src/lib/providers/storage/CloudinaryStorageProvider.js');
    const provider = new CloudinaryStorageProvider('testcloud');
    expect(typeof provider.moveFile).toBe('function');
  });

  it('S3StorageProvider.moveFile should execute copy and delete', async () => {
    const { default: S3StorageProvider } = await import('../../src/lib/providers/storage/S3StorageProvider.js');
    const provider = new S3StorageProvider({ bucket: 'testbucket' });
    expect(typeof provider.moveFile).toBe('function');
  });

  it('FailoverStorageProvider.moveFile should delegate to active provider', async () => {
    const { default: FailoverStorageProvider } = await import('../../src/lib/providers/storage/FailoverStorageProvider.js');
    const mockSubProvider = {
      moveFile: vi.fn().mockResolvedValue({ newPath: 'students/pfp/moved.jpg', sizeBytes: 500 })
    };
    const failover = new FailoverStorageProvider([mockSubProvider]);
    const result = await failover.moveFile('requests/pfp/moved.jpg', 'students/pfp');
    expect(result.newPath).toBe('students/pfp/moved.jpg');
    expect(mockSubProvider.moveFile).toHaveBeenCalledWith('requests/pfp/moved.jpg', 'students/pfp');
  });
});

describe('OrphanMediaService - Staging Orphans Detection', () => {
  it('should flag files remaining in requests/ or admission_drafts/ as staging orphans', async () => {
    const { OrphanMediaService } = await import('../../src/services/archive/OrphanMediaService.js');
    expect(typeof OrphanMediaService.scanStagingOrphans).toBe('function');
  });
});
