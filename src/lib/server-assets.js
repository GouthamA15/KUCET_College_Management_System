import { NextResponse } from 'next/server';
import { getAssetUrl } from '@/lib/assets';
import { getLocalStorageBasePath } from '@/lib/providers/storage/LocalStorageProvider';
import logger from '@/lib/logger';
import fs from 'fs';
import path from 'path';

/**
 * Server-Side Asset Response Helper.
 * Serves assets (remote Cloudinary/S3, local VPS disk storage, or BLOB/Buffer fallbacks) cleanly.
 * Keeps server-only dependencies (fs, path, logger) isolated from client bundles.
 */
export async function serveAssetResponse(assetValue, options = {}) {
  const { cacheControl = 'no-store, no-cache, must-revalidate, max-age=0' } = options;

  if (!assetValue) {
    return new NextResponse('Image not found', { status: 404 });
  }

  const resolvedUrl = getAssetUrl(assetValue);

  if (resolvedUrl.startsWith('http')) {
    // Remote Asset (Cloudinary / S3)
    const imageRes = await fetch(resolvedUrl);
    if (!imageRes.ok) throw new Error(`Remote asset fetch failed: ${imageRes.statusText}`);
    
    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await imageRes.arrayBuffer();

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
      },
    });
  } else if (resolvedUrl.startsWith('/api/assets/view/')) {
    // Local Asset (VPS/Secure Proxy)
    const relativePath = resolvedUrl.replace('/api/assets/view/', '').split('?')[0];
    if (relativePath.includes('..') || relativePath.startsWith('/')) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const STORAGE_PATH = getLocalStorageBasePath();
    const resolvedPath = path.resolve(/*turbopackIgnore: true*/ STORAGE_PATH, relativePath);
    if (!resolvedPath.startsWith(STORAGE_PATH)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    try {
      await fs.promises.access(resolvedPath);
      const fileBuffer = await fs.promises.readFile(/*turbopackIgnore: true*/ resolvedPath);
      const ext = path.extname(resolvedPath).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': cacheControl,
        },
      });
    } catch (err) {
      logger.error({ err, tag: 'SERVE_ASSET_LOCAL_ERROR' }, 'Error reading local asset');
      return new NextResponse('File not found', { status: 404 });
    }
  }

  // Treat as Buffer / Base64 fallback
  const imageBuffer = typeof assetValue === 'string' && !assetValue.startsWith('http') && !assetValue.startsWith('data:')
    ? Buffer.from(assetValue, 'base64')
    : Buffer.from(assetValue);

  return new NextResponse(imageBuffer, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': cacheControl,
    },
  });
}
