import { describe, it, expect } from 'vitest';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { getStorageProvider } from '@/lib/providers/storage/factory';
import getAssetUrl from '@/lib/assets';
import LocalStorageProvider from '@/lib/providers/storage/LocalStorageProvider';

describe('Live Verification: Storage Provider Operations', () => {
  it('should perform upload, URL generation, fetch, update, and delete in Cloudinary mode', async () => {
    process.env.STORAGE_TYPE = 'cloudinary';
    process.env.NEXT_PUBLIC_STORAGE_TYPE = 'cloudinary';

    const sampleBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const provider = getStorageProvider();

    // 1. Upload Image
    const uploadRes = await provider.upload(sampleBuffer, 'clerks/pfp');
    expect(uploadRes).toHaveProperty('path');
    expect(uploadRes.path.startsWith('kucet/clerks/pfp/')).toBe(true);

    // 2. Generate URL
    const url = getAssetUrl(uploadRes.path);
    expect(url).toContain('res.cloudinary.com');

    // 3. Fetch Image via HTTP GET
    const fetchRes = await fetch(url);
    expect(fetchRes.status).toBe(200);

    // 4. Update Image (re-upload creates new UUID key)
    const updateRes = await provider.upload(sampleBuffer, 'clerks/pfp');
    expect(updateRes.path.startsWith('kucet/clerks/pfp/')).toBe(true);

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

    // 1. Upload Image
    const uploadRes = await localProvider.upload(sampleBuffer, 'clerks/pfp');
    expect(uploadRes).toHaveProperty('path');
    expect(uploadRes.path.startsWith('clerks/pfp/')).toBe(true);

    // 2. Generate URL
    const url = getAssetUrl(uploadRes.path);
    expect(url).toContain('/api/assets/view/');

    // 3. Delete Image
    await localProvider.delete(uploadRes.path);
  });
});
