import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';

// Mock storage config / base path
vi.mock('@/lib/providers/storage/LocalStorageProvider', () => ({
  getLocalStorageBasePath: vi.fn(() => '/mock/storage'),
}));

vi.mock('@/lib/institution-assets', () => ({
  resolveInstitutionalFilename: vi.fn(() => null),
  isPrivateInstitutionalAsset: vi.fn(() => false),
}));

import { resolveLocalFilePath } from '@/app/api/assets/view/[...path]/route';

describe('Asset Lifecycle Promotion Fallback Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves promoted student photo when requested via draft path', () => {
    const draftKey = 'kucet/admission_drafts/pfp/0519a66b222c5a1e4588.webp';
    const promotedPath = path.resolve('/mock/storage', 'kucet', 'students', 'pfp', '0519a66b222c5a1e4588.webp');

    vi.spyOn(fs, 'existsSync').mockImplementation((checkPath) => {
      // The staging path no longer exists (file was promoted/moved)
      if (typeof checkPath === 'string' && checkPath.includes('admission_drafts')) return false;
      // The promoted path in students/pfp exists!
      if (checkPath === promotedPath) return true;
      return false;
    });

    vi.spyOn(fs, 'statSync').mockReturnValue({
      isFile: () => true,
      size: 12345,
    });

    const result = resolveLocalFilePath(draftKey);
    expect(result.filePath).toBe(promotedPath);
    expect(result.stat).not.toBeNull();
  });

  it('resolves promoted student signature when requested via request path', () => {
    const requestSigKey = 'requests/signatures/sig999.webp';
    const promotedSigPath = path.resolve('/mock/storage', 'students', 'signatures', 'sig999.webp');

    vi.spyOn(fs, 'existsSync').mockImplementation((checkPath) => {
      if (typeof checkPath === 'string' && checkPath.includes('requests')) return false;
      if (checkPath === promotedSigPath) return true;
      return false;
    });

    vi.spyOn(fs, 'statSync').mockReturnValue({
      isFile: () => true,
      size: 6789,
    });

    const result = resolveLocalFilePath(requestSigKey);
    expect(result.filePath).toBe(promotedSigPath);
    expect(result.stat).not.toBeNull();
  });

  it('resolves draft file when requested directly and still in staging', () => {
    const draftKey = 'kucet/admission_drafts/pfp/draft123.webp';
    const directPath = path.resolve('/mock/storage', 'kucet', 'admission_drafts', 'pfp', 'draft123.webp');

    vi.spyOn(fs, 'existsSync').mockImplementation((checkPath) => {
      if (checkPath === directPath) return true;
      return false;
    });

    vi.spyOn(fs, 'statSync').mockReturnValue({
      isFile: () => true,
      size: 5432,
    });

    const result = resolveLocalFilePath(draftKey);
    expect(result.filePath).toBe(directPath);
    expect(result.stat).not.toBeNull();
  });
});
