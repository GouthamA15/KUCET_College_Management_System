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
      logger.warn({ requestId: requestIdNum, tag: 'REQUEST_IMAGE_NOT_FOUND' }, 'Payment screenshot not found in database');
      return new NextResponse('Image not found', { status: 404 });
    }

    const assetValue = imageRow.payment_screenshot;
    const resolvedUrl = getAssetUrl(assetValue);

    logger.debug({ requestId: requestIdNum, assetValue, resolvedUrl, tag: 'REQUEST_IMAGE_RESOLVING' }, 'Resolving request image');

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
    } else if (resolvedUrl.startsWith('/api/assets/view/') || resolvedUrl.startsWith('/uploads/')) {
      // Local Asset (VPS/Secure Proxy)
      const prefix = resolvedUrl.startsWith('/uploads/') ? '/uploads/' : '/api/assets/view/';
      const relativePath = resolvedUrl.replace(prefix, '').split('?')[0];
      
      // Prevent directory traversal: reject '..' sequences and leading slashes
      if (relativePath.includes('..') || relativePath.startsWith('/')) {
        logger.error({ relativePath, tag: 'REQUEST_IMAGE_SECURITY_VIOLATION' }, 'Security violation: directory traversal attempt');
        return new NextResponse('Forbidden', { status: 403 });
      }

      const STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || '/app/public/uploads';
      const resolvedPath = path.resolve(STORAGE_PATH, relativePath);
      
      // Verify resolved path is within storage directory
      if (!resolvedPath.startsWith(path.resolve(STORAGE_PATH))) {
        logger.error({ resolvedPath, STORAGE_PATH, tag: 'REQUEST_IMAGE_SECURITY_VIOLATION' }, 'Security violation: path out of bounds');
        return new NextResponse('Forbidden', { status: 403 });
      }

      try {
        await fs.promises.access(resolvedPath);
        const fileBuffer = await fs.promises.readFile(resolvedPath);
        
        // Detect Mime Type
        let mimeType = 'image/jpeg';
        if (fileBuffer.length >= 4) {
            if (fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50) mimeType = 'image/png';
            else if (fileBuffer[0] === 0x52 && fileBuffer[1] === 0x49) mimeType = 'image/webp';
            else if (fileBuffer[0] === 0x47 && fileBuffer[1] === 0x49) mimeType = 'image/gif';
        } else {
            const ext = path.extname(resolvedPath).toLowerCase();
            if (ext === '.png') mimeType = 'image/png';
            else if (ext === '.webp') mimeType = 'image/webp';
        }

        logger.info({ requestId: requestIdNum, resolvedPath, mimeType, tag: 'REQUEST_IMAGE_SERVED' }, 'Serving request image from local storage');

        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch (err) {
        logger.error({ err: err.message, requestId: requestIdNum, resolvedPath, tag: 'REQUEST_IMAGE_LOCAL_ERROR' }, 'Error reading local request asset file');
        return new NextResponse('File not found', { status: 404 });
      }
    }

    // Treat as Buffer (old BLOB data)
    try {
        let buffer = assetValue;
        if (typeof assetValue === 'string' && assetValue.length > 100 && !assetValue.includes('/')) {
            buffer = Buffer.from(assetValue, 'base64');
        }
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            },
        });
    } catch (e) {
        logger.error({ err: e.message, requestId: requestIdNum, tag: 'REQUEST_IMAGE_BUFFER_ERROR' }, 'Error serving request image as buffer');
        return new NextResponse('Internal error', { status: 500 });
    }

  } catch (error) {
    logger.error('Error serving request image:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
