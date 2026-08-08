import { NextResponse } from 'next/server';
import { getAssetUrl } from '@/lib/assets';
import { resolveLocalFilePath } from '@/app/api/assets/view/[...path]/route';
import logger from '@/lib/logger';
import fs from 'fs';
import path from 'path';

// Memory cache for server asset responses (< 2MB)
const serverAssetCache = new Map();
const MAX_CACHE_ENTRIES = 100;
const MAX_CACHE_SIZE = 2 * 1024 * 1024;

/**
 * Server-Side Asset Response Helper.
 * Serves assets (remote Cloudinary/S3, local VPS disk storage, or BLOB/Buffer fallbacks) cleanly.
 * Keeps server-only dependencies (fs, path, logger) isolated from client bundles.
 */
export async function serveAssetResponse(assetValue, options = {}) {
  const { 
    cacheControl = 'public, max-age=86400, must-revalidate',
    req = null
  } = options;

  if (!assetValue) {
    return new NextResponse('Image not found', { status: 404 });
  }

  const resolvedUrl = getAssetUrl(assetValue);

  // 1. Remote Asset (Cloudinary / S3)
  if (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')) {
    try {
      const cacheKey = `remote:${resolvedUrl}`;
      let cached = serverAssetCache.get(cacheKey);
      
      if (!cached) {
        const imageRes = await fetch(resolvedUrl);
        if (!imageRes.ok) throw new Error(`Remote asset fetch failed: ${imageRes.statusText}`);
        
        const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await imageRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        cached = { contentType, buffer };
        if (buffer.length <= MAX_CACHE_SIZE) {
          if (serverAssetCache.size >= MAX_CACHE_ENTRIES) {
            const first = serverAssetCache.keys().next().value;
            serverAssetCache.delete(first);
          }
          serverAssetCache.set(cacheKey, cached);
        }
      }

      return new NextResponse(cached.buffer, {
        headers: {
          'Content-Type': cached.contentType,
          'Cache-Control': cacheControl,
        },
      });
    } catch (err) {
      logger.error({ err: err.message, assetValue, resolvedUrl }, '[SERVE_REMOTE_ASSET_ERROR]');
      
      // Fallback: check if local disk has the asset (e.g. static/branding/signature fallback)
      const cleanPath = (typeof assetValue === 'string' ? assetValue : '')
        .replace(/^v\d+\//, '')
        .replace(/^\/+/, '');
      const { filePath, stat } = resolveLocalFilePath(cleanPath);
      if (stat && stat.isFile()) {
        try {
          const fileBuffer = await fs.promises.readFile(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes = {
            '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
            '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf'
          };
          return new NextResponse(fileBuffer, {
            headers: {
              'Content-Type': mimeTypes[ext] || 'image/jpeg',
              'Cache-Control': cacheControl,
            },
          });
        } catch (_fErr) {
          // ignore fallback error
        }
      }

      return new NextResponse('Error fetching remote asset', { status: 502 });
    }
  } 
  
  // 2. Local Asset Proxy or Static Path (/api/assets/view/ or /assets/)
  if (resolvedUrl.startsWith('/api/assets/view/') || resolvedUrl.startsWith('/assets/')) {
    const relativePath = resolvedUrl
      .replace('/api/assets/view/', '')
      .replace(/^\/assets\//, 'assets/')
      .split('?')[0];

    if (relativePath.includes('..') || relativePath.startsWith('/')) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const { filePath } = resolveLocalFilePath(relativePath);

    try {
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) {
        return new NextResponse('File not found', { status: 404 });
      }

      const etag = `W/"${stat.size}-${stat.mtimeMs.toString(36)}"`;
      if (req) {
        const clientEtag = req.headers?.get?.('if-none-match');
        if (clientEtag && clientEtag === etag) {
          return new NextResponse(null, { 
            status: 304, 
            headers: {
              'Cache-Control': cacheControl,
              'ETag': etag,
              'Last-Modified': stat.mtime.toUTCString(),
            } 
          });
        }
      }

      const cacheKey = `local:${filePath}:${stat.mtimeMs}`;
      let fileBuffer = serverAssetCache.get(cacheKey)?.buffer;

      if (!fileBuffer) {
        fileBuffer = await fs.promises.readFile(filePath);
        if (stat.size <= MAX_CACHE_SIZE) {
          if (serverAssetCache.size >= MAX_CACHE_ENTRIES) {
            const first = serverAssetCache.keys().next().value;
            serverAssetCache.delete(first);
          }
          serverAssetCache.set(cacheKey, { buffer: fileBuffer });
        }
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf'
      };
      const contentType = mimeTypes[ext] || 'image/jpeg';

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': cacheControl,
          'ETag': etag,
          'Last-Modified': stat.mtime.toUTCString(),
        },
      });
    } catch (err) {
      logger.error({ err: err.message, tag: 'SERVE_ASSET_LOCAL_ERROR', relativePath }, 'Error reading local asset');
      return new NextResponse('File not found', { status: 404 });
    }
  }

  // 3. Treat as Buffer / Base64 fallback
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
