import { db } from '@/db';
import { studentRequests, studentRequestImages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-utils';

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

    const imageBufferOrUrl = imageRow.payment_screenshot;

    if (typeof imageBufferOrUrl === 'string' && imageBufferOrUrl.startsWith('http')) {
      const imageRes = await fetch(imageBufferOrUrl);
      if (!imageRes.ok) throw new Error('Cloudinary fetch failed');
      
      const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
      const buffer = await imageRes.arrayBuffer();

      return new NextResponse(Buffer.from(buffer), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400, must-revalidate',
        },
      });
    }

    // Treat as Buffer (old BLOB data)
    return new NextResponse(imageBufferOrUrl, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });

  } catch (error) {
    console.error('Error serving request image:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
