import { describe, it, expect } from 'vitest';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { v2 as cloudinary } from 'cloudinary';
import { db } from '@/db/index';
import { staffAccounts } from '@/db/schema/identity';
import { getAssetUrl } from '@/lib/assets';
import { getStorageProvider } from '@/lib/providers/storage/factory';
import logger from '@/lib/logger';
import { eq } from 'drizzle-orm';

const hasCloudinaryCreds = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

const hasDbCreds = Boolean(process.env.DB_HOST);

if (hasCloudinaryCreds) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

describe('Complete End-to-End Image Retrieval & Rendering Verification', () => {
  it.skipIf(!hasCloudinaryCreds || !hasDbCreds)('End-to-End Live Upload, DB Write, Read, URL Generation, & HTTP 200 Verification', async () => {
    process.env.STORAGE_TYPE = 'cloudinary';
    process.env.NEXT_PUBLIC_STORAGE_TYPE = 'cloudinary';

    // 1. Prepare sample binary file buffer
    const sampleBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    // 2. Perform StorageProvider upload
    const provider = getStorageProvider();
    const uploadRes = await provider.upload(sampleBuffer, 'staff/pfp');
    logger.info({ path: uploadRes.path }, 'Step 1 - StorageProvider.upload() path');
    expect(uploadRes.path).not.toContain('http://');
    expect(uploadRes.path).not.toContain('https://');
    expect(uploadRes.path.includes('staff/pfp/')).toBe(true);

    // 3. Write canonical relative key to database
    const testStaffId = 6;
    await db.update(staffAccounts).set({ pfp: uploadRes.path }).where(eq(staffAccounts.id, testStaffId));

    // 4. Read record back from database
    const [dbStaff] = await db.select({ id: staffAccounts.id, pfp: staffAccounts.pfp }).from(staffAccounts).where(eq(staffAccounts.id, testStaffId));
    logger.info({ pfp: dbStaff?.pfp }, 'Step 2 - DB Stored pfp value');
    if (dbStaff) {
      expect(dbStaff.pfp).toBe(uploadRes.path);
    }

    // 5. Generate browser URL using getAssetUrl()
    const deliveryUrl = getAssetUrl(uploadRes.path);
    logger.info({ deliveryUrl }, 'Step 3 - getAssetUrl() delivery URL');
    expect(deliveryUrl).toContain('https://res.cloudinary.com/');
    expect(deliveryUrl).toContain(uploadRes.path);

    // 6. Perform browser HTTP GET fetch request
    const httpRes = await fetch(deliveryUrl);
    logger.info({ status: httpRes.status }, 'Step 4 - HTTP GET Status');
    expect(httpRes.status).toBe(200);

    // 7. Cleanup Cloudinary test asset
    await provider.delete(uploadRes.path);
  }, 60000);
});
