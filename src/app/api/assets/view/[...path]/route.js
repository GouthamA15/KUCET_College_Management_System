import { apiError } from '@/lib/api-utils';
import logger from '@/lib/logger';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req, { params }) {
  try {
    const { path: pathSegments } = await params;
    const relativePath = pathSegments.join('/');
    
    // Security: Prevent directory traversal
    if (relativePath.includes('..')) {
      return apiError('Invalid path', 400);
    }

    const storagePath = process.env.LOCAL_STORAGE_PATH || '/app/public/uploads';
    const absolutePath = path.join(storagePath, relativePath);

    try {
      const fileBuffer = await fs.readFile(absolutePath);

      // Determine content type
      const ext = path.extname(absolutePath).toLowerCase();
      let contentType = 'application/octet-stream';

      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.mp4': 'video/mp4',
        '.mp3': 'audio/mpeg'
      };

      if (mimeTypes[ext]) {
        contentType = mimeTypes[ext];
      }

      const headers = {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      };

      // SECURITY: Force download for SVGs to prevent inline script execution
      if (ext === '.svg') {
        const fileName = path.basename(absolutePath);
        headers['Content-Disposition'] = `attachment; filename="${fileName}"`;
      }

      return new Response(fileBuffer, { headers });
    } catch (e) {
      if (e.code === 'ENOENT') {
        return apiError('File not found', 404);
      }
      throw e;
    }
  } catch (error) {
    logger.error({ err: error }, 'Asset Proxy Error');
    return apiError('Internal server error', 500);
  }
}
