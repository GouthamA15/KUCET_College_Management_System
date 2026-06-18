import logger from '@/lib/logger';
import { db } from '@/db';
import { studentImages, students } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthUser, apiError } from '@/lib/api-utils';
import { getAssetUrl } from '@/lib/assets';
import fs from 'fs';
import path from 'path';

export async function GET(req, context) {
  try {
    const user = await getAuthUser();
    if (!user) return apiError('Unauthorized', 401);
    
    const params = await context.params;
    let { rollno } = params;
    if (!rollno) return new NextResponse('Roll number required', { status: 400 });
    rollno = rollno.trim().toUpperCase();

    const rows = await db.select({ pfp: studentImages.pfp })
      .from(studentImages)
      .innerJoin(students, eq(studentImages.student_id, students.id))
      .where(eq(students.roll_no, rollno))
      .limit(1);

    if (rows.length === 0 || !rows[0].pfp) {
      logger.warn({ rollno, tag: 'STUDENT_IMAGE_NOT_FOUND' }, 'Student image not found in database');
      return new NextResponse('Image not found', { status: 404 });
    }

    const assetValue = rows[0].pfp;
    const resolvedUrl = getAssetUrl(assetValue);

    logger.debug({ rollno, assetValue, resolvedUrl, tag: 'STUDENT_IMAGE_RESOLVING' }, 'Resolving student image');

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
        logger.error({ relativePath, tag: 'STUDENT_IMAGE_SECURITY_VIOLATION' }, 'Security violation: directory traversal attempt');
        return new NextResponse('Forbidden', { status: 403 });
      }

      const STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || '/app/public/uploads';
      const resolvedPath = path.resolve(STORAGE_PATH, relativePath);
      
      // Verify resolved path is within storage directory
      if (!resolvedPath.startsWith(path.resolve(STORAGE_PATH))) {
        logger.error({ resolvedPath, STORAGE_PATH, tag: 'STUDENT_IMAGE_SECURITY_VIOLATION' }, 'Security violation: path out of bounds');
        return new NextResponse('Forbidden', { status: 403 });
      }

      try {
        await fs.promises.access(resolvedPath);
        const fileBuffer = await fs.promises.readFile(resolvedPath);
        
        // Detect Mime Type from Magic Bytes if possible, otherwise extension
        let mimeType = 'image/jpeg';
        if (fileBuffer.length >= 4) {
            const hex = fileBuffer.toString('hex', 0, 4).toUpperCase();
            if (hex.startsWith('89504E47')) mimeType = 'image/png';
            else if (fileBuffer.toString('ascii', 0, 3) === 'GIF') mimeType = 'image/gif';
            else if (fileBuffer.toString('ascii', 0, 4) === 'RIFF' && fileBuffer.length >= 12 && fileBuffer.toString('ascii', 8, 12) === 'WEBP') mimeType = 'image/webp';
            else if (hex.startsWith('FFD8FF')) mimeType = 'image/jpeg';
        } else {
            const ext = path.extname(resolvedPath).toLowerCase();
            if (ext === '.png') mimeType = 'image/png';
            else if (ext === '.webp') mimeType = 'image/webp';
        }
        
        logger.info({ rollno, resolvedPath, mimeType, tag: 'STUDENT_IMAGE_SERVED' }, 'Serving student image from local storage');

        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch (err) {
        logger.error({ err: err.message, rollno, resolvedPath, tag: 'STUDENT_IMAGE_LOCAL_ERROR' }, 'Error reading local asset file');
        return new NextResponse('File not found', { status: 404 });
      }
    }

    // Treat as Buffer (old BLOB data)
    try {
        let buffer = assetValue;
        if (typeof assetValue === 'string' && assetValue.length > 100 && !assetValue.includes('/')) {
            // Likely a base64 string
            buffer = Buffer.from(assetValue, 'base64');
        }
        
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'public, max-age=86400, must-revalidate', 
            },
        });
    } catch (e) {
        logger.error({ err: e.message, rollno, tag: 'STUDENT_IMAGE_BUFFER_ERROR' }, 'Error serving image as buffer');
        return new NextResponse('Internal error', { status: 500 });
    }

  } catch (error) {
    logger.error('Error serving student image:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
