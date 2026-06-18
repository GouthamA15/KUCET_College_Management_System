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
    const { rollno } = params;
    if (!rollno) return new NextResponse('Roll number required', { status: 400 });

    const rows = await db.select({ pfp: studentImages.pfp })
      .from(studentImages)
      .innerJoin(students, eq(studentImages.student_id, students.id))
      .where(eq(students.roll_no, rollno))
      .limit(1);

    if (rows.length === 0 || !rows[0].pfp) {
      return new NextResponse('Image not found', { status: 404 });
    }

    const assetValue = rows[0].pfp;
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
      const resolvedPath = path.resolve(/*turbopackIgnore: true*/ STORAGE_PATH, relativePath);
      // Verify resolved path is within storage directory
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
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch (err) {
        logger.error({ err, tag: 'STUDENT_IMAGE_LOCAL_ERROR' }, 'Error reading local asset');
        return new NextResponse('File not found', { status: 404 });
      }
    }

    // Treat as Buffer (old BLOB data)
    return new NextResponse(assetValue, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, must-revalidate', 
      },
    });

  } catch (error) {
    logger.error('Error serving student image:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
