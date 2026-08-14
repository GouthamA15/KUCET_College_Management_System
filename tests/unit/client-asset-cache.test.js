import { describe, it, expect, beforeEach } from 'vitest';
import { getAssetUrl, invalidateAssetCache, getAssetCacheSnapshot } from '@/lib/assets';

describe('Client-Side Image Caching Layer', () => {
  beforeEach(() => {
    // Reset cache before each test
    invalidateAssetCache();
  });

  it('Requirement 1 & 2: Should cache URL on first load and reuse on subsequent requests', () => {
    process.env.STORAGE_TYPE = 'cloudinary';
    process.env.NEXT_PUBLIC_STORAGE_TYPE = 'cloudinary';

    const path = 'kucet/clerks/pfp/c70735b60f3d4d43b72eef4b2a26e270.webp';

    // 1st request - resolves and populates cache
    const url1 = getAssetUrl(path);
    expect(url1).toContain('https://res.cloudinary.com/');
    expect(url1).toContain(path);

    // Verify snapshot contains entry
    const snapshot1 = getAssetCacheSnapshot();
    expect(Object.keys(snapshot1).length).toBeGreaterThan(0);

    // 2nd request - returns cached URL
    const url2 = getAssetUrl(path);
    expect(url2).toBe(url1);

    // 3rd request from another component - returns cached URL
    const url3 = getAssetUrl(path);
    expect(url3).toBe(url1);
  });

  it('Requirement 3: Automatic selective cache invalidation should clear only specified asset', () => {
    process.env.STORAGE_TYPE = 'cloudinary';
    process.env.NEXT_PUBLIC_STORAGE_TYPE = 'cloudinary';

    const pfpPath = 'kucet/clerks/pfp/clerk1_photo.webp';
    const sigPath = 'kucet/clerks/signatures/clerk1_signature.webp';

    // Populate cache with 2 assets
    const pfpUrl1 = getAssetUrl(pfpPath);
    const sigUrl1 = getAssetUrl(sigPath);

    expect(getAssetCacheSnapshot()[pfpPath]).toBe(pfpUrl1);
    expect(getAssetCacheSnapshot()[sigPath]).toBe(sigUrl1);

    // Invalidate ONLY the profile photo key
    invalidateAssetCache(pfpPath);

    // Signature remains cached
    expect(getAssetCacheSnapshot()[sigPath]).toBe(sigUrl1);

    // Profile photo key has been removed from cache
    expect(getAssetCacheSnapshot()[pfpPath]).toBeUndefined();
  });

  it('Requirement 7: Caching layer must be storage-provider agnostic (Local & Cloudinary modes)', () => {
    // Test Local mode
    process.env.STORAGE_TYPE = 'local';
    process.env.NEXT_PUBLIC_STORAGE_TYPE = 'local';

    const localPath = 'kucet/students/pfp/student123.webp';
    const localUrl = getAssetUrl(localPath);
    expect(localUrl).toBe('/api/assets/view/kucet/students/pfp/student123.webp');
    expect(getAssetUrl(localPath)).toBe(localUrl);

    // Test Cloudinary mode
    invalidateAssetCache();
    process.env.STORAGE_TYPE = 'cloudinary';
    process.env.NEXT_PUBLIC_STORAGE_TYPE = 'cloudinary';

    const cloudPath = 'kucet/students/pfp/student123.webp';
    const cloudUrl = getAssetUrl(cloudPath);
    expect(cloudUrl).toContain('https://res.cloudinary.com/');
    expect(getAssetUrl(cloudPath)).toBe(cloudUrl);
  });

  it('Requirement 4: Should preserve pass-through Data URIs and static public assets', () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    expect(getAssetUrl(dataUri)).toBe(dataUri);

    const staticLogo = '/assets/ku-logo.png';
    expect(getAssetUrl(staticLogo)).toBe('/assets/ku-logo.png');
  });

  it('Bypass Cache Option: Should allow bypassing cache when requested', () => {
    process.env.STORAGE_TYPE = 'cloudinary';
    process.env.NEXT_PUBLIC_STORAGE_TYPE = 'cloudinary';

    const path = 'kucet/requests/pfp/test_bypass.webp';

    const url1 = getAssetUrl(path);
    const url2 = getAssetUrl(path, 'f_auto,q_auto', { bypassCache: true });

    expect(url1).toBe(url2);
  });
});
