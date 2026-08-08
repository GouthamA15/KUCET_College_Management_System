import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-utils';
import logger from '@/lib/logger';
import { getLocalStorageBasePath } from '@/lib/providers/storage/LocalStorageProvider';
import fs from 'fs';
import path from 'path';

/**
 * Resolves a relative storage key to the absolute filesystem path.
 * Delegates to getLocalStorageBasePath to handle Docker and local dev logic.
 */
export function resolveLocalFilePath(filename) {
  const base = getLocalStorageBasePath();
  const filePath = path.join(base, filename);
  return { base, filePath };
}

/**
 * SECURE ASSET PROXY
 * Serves files from VPS storage folders
 */
export async function GET(request, { params }) {
  const { path: pathSegments } = await params;

  // Join the path segments back into a string
  const filename = pathSegments.join('/');

  const { base, filePath } = resolveLocalFilePath(filename);

  // Security: Prevent Directory Traversal
  if (!filePath.startsWith(base)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Use async fs APIs
    await fs.promises.access(filePath);
    const fileBuffer = await fs.promises.readFile(filePath);
    const extension = path.extname(filename).toLowerCase();
    
    // Determine Content-Type
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4'
    };

    const contentType = mimeTypes[extension] || 'application/octet-stream';

    const headers = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    };

    // Prevent Stored XSS via SVG or malicious PDF by forcing download
    if (['.svg', '.pdf'].includes(extension)) {
      const sanitizedFilename = path.basename(filename).replace(/[\r\n"'\\/]/g, '');
      headers['Content-Disposition'] = `attachment; filename="${sanitizedFilename}"`;
    } else {
      headers['Content-Disposition'] = 'inline';
    }

    return new NextResponse(fileBuffer, { headers });
  } catch (error) {
    logger.error({ err: error, tag: 'STORAGE_PROXY_ERROR', filename }, 'Storage proxy error');
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
