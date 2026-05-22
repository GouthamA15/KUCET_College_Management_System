import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-utils';
import fs from 'fs';
import path from 'path';

/**
 * SECURE ASSET PROXY
 * Serves files from the private VPS storage folder (/var/www/kucet-storage)
 * Only accessible to authenticated students and staff.
 */
export async function GET(request, { params }) {
  const { path: pathSegments } = await params;
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Join the path segments back into a string
  const filename = pathSegments.join('/');

  // Define the base storage path (Defaults to VPS path, but can be overridden for local development)
  const STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || '/var/www/kucet-storage/uploads';
  const filePath = path.join(STORAGE_PATH, filename);

  // Security: Prevent Directory Traversal
  if (!filePath.startsWith(STORAGE_PATH)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const extension = path.extname(filename).toLowerCase();
    
    // Determine Content-Type
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4'
    };

    const contentType = mimeTypes[extension] || 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[STORAGE_PROXY_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
