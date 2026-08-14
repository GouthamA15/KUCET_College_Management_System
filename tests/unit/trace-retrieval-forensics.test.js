import { describe, it, expect } from 'vitest';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { v2 as cloudinary } from 'cloudinary';
import { db } from '@/db/index';
import { clerks } from '@/db/schema/identity';
import { getAssetUrl } from '@/lib/assets';
import { getStorageProvider } from '@/lib/providers/storage/factory';
import { logger } from '@/lib/logger';
import { eq } from 'drizzle-orm';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

describe('Complete End-to-End Image Retrieval & Rendering Verification', () => {
  it('End-to-End Live Upload, DB Write, Read, URL Generation, & HTTP 200 Verification', async () => {
    process.env.STORAGE_TYPE = 'cloudinary';
    process.env.NEXT_PUBLIC_STORAGE_TYPE = 'cloudinary';

    // 1. Prepare sample binary file buffer
    const sampleBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    // 2. Perform StorageProvider upload
    const provider = getStorageProvider();
    const uploadRes = await provider.upload(sampleBuffer, 'clerks/pfp');
    logger.info({ path: uploadRes.path }, 'Step 1 - StorageProvider.upload() path');
    expect(uploadRes.path.startsWith('kucet/clerks/pfp/')).toBe(true);

    // 3. Write canonical relative key to database
    const testClerkId = 6;
    await db.update(clerks).set({ pfp: uploadRes.path }).where(eq(clerks.id, testClerkId));

    // 4. Read record back from database
    const [dbClerk] = await db.select({ id: clerks.id, pfp: clerks.pfp }).from(clerks).where(eq(clerks.id, testClerkId));
    logger.info({ pfp: dbClerk.pfp }, 'Step 2 - DB Stored pfp value');
    expect(dbClerk.pfp).toBe(uploadRes.path);

    // 5. Generate browser URL using getAssetUrl()
    const deliveryUrl = getAssetUrl(dbClerk.pfp);
    logger.info({ deliveryUrl }, 'Step 3 - getAssetUrl() delivery URL');
    expect(deliveryUrl).toContain('https://res.cloudinary.com/');
    expect(deliveryUrl).toContain(dbClerk.pfp);

    // 6. Perform browser HTTP GET fetch request
    const httpRes = await fetch(deliveryUrl);
    logger.info({ status: httpRes.status }, 'Step 4 - HTTP GET Status');
    expect(httpRes.status).toBe(200);

    // 7. Cleanup Cloudinary test asset
    await provider.delete(uploadRes.path);
  }, 60000);
});
