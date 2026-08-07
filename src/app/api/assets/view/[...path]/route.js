import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-utils';
import logger from '@/lib/logger';
import fs from 'fs';
import path from 'path';

/**
 * SECURE ASSET PROXY
 * Serves files from the private VPS storage folder (/var/www/kucet-storage)
 * Only accessible to authenticated students and staff.
 */
export function resolveLocalFilePath(filename) {
  const candidateBases = [
    process.env.LOCAL_STORAGE_PATH,
    '/var/www/kucet-storage/public',
    path.join(process.cwd(), 'public')
  ].filter(Boolean);

  for (const base of candidateBases) {
    const candidatePath = path.join(base, filename);
    if (candidatePath.startsWith(base) && fs.existsSync(candidatePath)) {
      return { base, filePath: candidatePath };
    }
  }

  const defaultBase = process.env.LOCAL_STORAGE_PATH || '/var/www/kucet-storage/public';
  return { base: defaultBase, filePath: path.join(defaultBase, filename) };
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
