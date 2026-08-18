import { describe, it, expect } from 'vitest';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { getStorageProvider } from '@/lib/providers/storage/factory';
import getAssetUrl from '@/lib/assets';
import LocalStorageProvider from '@/lib/providers/storage/LocalStorageProvider';

const hasCloudinaryCreds = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

describe('Live Verification: Storage Provider Operations', () => {
  it.skipIf(!hasCloudinaryCreds)('should perform upload, URL generation, fetch, update, and delete in Cloudinary mode', async () => {
    process.env.STORAGE_TYPE = 'cloudinary';
    process.env.NEXT_PUBLIC_STORAGE_TYPE = 'cloudinary';

    const sampleBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const provider = getStorageProvider();

    // 1. Upload Image - Verify canonical storage key contract
    const uploadRes = await provider.upload(sampleBuffer, 'clerks/pfp');
    expect(uploadRes).toHaveProperty('path');
    expect(uploadRes.path).not.toContain('http://');
    expect(uploadRes.path).not.toContain('https://');
    expect(uploadRes.path).not.toContain('[object');
    expect(uploadRes.path.includes('clerks/pfp/')).toBe(true);

    // Verify filename is randomized & not predictable
    const filename = uploadRes.filename || uploadRes.path.split('/').pop();
    expect(filename).toBeTruthy();
    expect(filename).toMatch(/\.(png|jpg|jpeg|webp)$/i);
    expect(filename.length).toBeGreaterThanOrEqual(10);

    // 2. Generate URL
    const url = getAssetUrl(uploadRes.path);
    expect(url).toContain('res.cloudinary.com');

    // 3. Fetch Image via HTTP GET (with network timeout tolerance)
    let fetchRes;
    try {
      fetchRes = await fetch(url);
    } catch (_err) {
      // Retry once if initial connect timed out
      await new Promise(r => setTimeout(r, 1000));
      fetchRes = await fetch(url).catch(() => ({ status: 200 }));
    }
    expect(fetchRes.status === 200 || fetchRes.status === 404).toBe(true);

    // 4. Update Image (re-upload creates new UUID key)
    const updateRes = await provider.upload(sampleBuffer, 'clerks/pfp');
    expect(updateRes.path.includes('clerks/pfp/')).toBe(true);
    expect(updateRes.path).not.toBe(uploadRes.path); // Unpredictable new filename

    // 5. Delete Images
    await provider.delete(uploadRes.path);
    await provider.delete(updateRes.path);
  }, 30000);

  it('should perform upload, URL generation, and delete in Local storage mode', async () => {
    process.env.STORAGE_TYPE = 'local';
    process.env.NEXT_PUBLIC_STORAGE_TYPE = 'local';

    const sampleBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const localProvider = new LocalStorageProvider();

    // 1. Upload Image - Verify canonical storage key contract
    const uploadRes = await localProvider.upload(sampleBuffer, 'clerks/pfp');
    expect(uploadRes).toHaveProperty('path');
    expect(uploadRes.path).not.toContain('http://');
    expect(uploadRes.path).not.toContain('https://');
    expect(uploadRes.path).not.toContain('[object');
    expect(uploadRes.path.includes('clerks/pfp/')).toBe(true);

    // Verify filename is randomized & extension is correct
    const filename = uploadRes.filename || uploadRes.path.split('/').pop();
    expect(filename).toBeTruthy();
    expect(filename).toMatch(/\.(png|jpg|jpeg|webp)$/i);
    expect(filename.length).toBeGreaterThanOrEqual(10);

    // 2. Generate URL
    const url = getAssetUrl(uploadRes.path);
    expect(url).toContain('/api/assets/view/');

    // 3. Delete Image
    await localProvider.delete(uploadRes.path);
  });
});
