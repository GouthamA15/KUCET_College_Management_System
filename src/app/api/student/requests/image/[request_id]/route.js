import logger from '@/lib/logger';
import { db } from '@/db';
import { studentRequests, studentRequestImages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-utils';
import { getAssetUrl } from '@/lib/assets';
import fs from 'fs';
import path from 'path';

export async function GET(req, context) {
  try {
    const params = await context.params;
    const { request_id } = params;
    const requestIdNum = parseInt(request_id);

    if (!request_id) {
      return new NextResponse('Request ID required', { status: 400 });
    }

    const user = await getAuthUser();
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    let isAuthorized = false;
    if (['admin', 'admission', 'scholarship', 'faculty'].includes(user.role)) {
      isAuthorized = true;
    }

    if (!isAuthorized && user.student_id) {
      const request = await db.query.studentRequests.findFirst({
        columns: { student_id: true },
        where: eq(studentRequests.request_id, requestIdNum)
      });
      if (request && request.student_id === user.student_id) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const imageRow = await db.query.studentRequestImages.findFirst({
      where: eq(studentRequestImages.request_id, requestIdNum)
    });

    if (!imageRow || !imageRow.payment_screenshot) {
      return new NextResponse('Image not found', { status: 404 });
    }

    const assetValue = imageRow.payment_screenshot;
    const resolvedUrl = getAssetUrl(assetValue);

    if (resolvedUrl.startsWith('http')) {
      // Remote Asset (Cloudinary)
      const imageRes = await fetch(resolvedUrl);
      if (!imageRes.ok) throw new Error(`Cloudinary fetch failed: ${imageRes.statusText}`);
      
      const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
      const buffer = await imageRes.arrayBuffer();

      return new NextResponse(Buffer.from(buffer), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400, must-revalidate',
        },
      });
    } else if (resolvedUrl.startsWith('/api/assets/view/')) {
      // Local Asset (VPS/Secure Proxy)
      const relativePath = resolvedUrl.replace('/api/assets/view/', '').split('?')[0];
      // Prevent directory traversal: reject '..' sequences and leading slashes
      if (relativePath.includes('..') || relativePath.startsWith('/')) {
        return new NextResponse('Forbidden', { status: 403 });
      }
      const STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || '/var/www/kucet-storage/uploads';
      const resolvedPath = path.resolve(STORAGE_PATH, relativePath);
      // Verify resolved path is within storage directory
      if (!resolvedPath.startsWith(STORAGE_PATH)) {
        return new NextResponse('Forbidden', { status: 403 });
      }

      try {
        await fs.promises.access(resolvedPath);
        const fileBuffer = await fs.promises.readFile(resolvedPath);
        const ext = path.extname(resolvedPath).toLowerCase();
        const contentType = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');
        
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch (err) {
        logger.error({ err, tag: 'REQUEST_IMAGE_LOCAL_ERROR' }, 'Error reading local asset');
        return new NextResponse('File not found', { status: 404 });
      }
    }

    // Treat as Buffer (old BLOB data) or fallback
    return new NextResponse(assetValue, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });

  } catch (error) {
    logger.error('Error serving request image:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
