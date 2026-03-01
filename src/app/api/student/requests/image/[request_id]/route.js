import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-utils';

export async function GET(req, context) {
  const params = await context.params;
  const { request_id } = params;

  if (!request_id) {
    return new NextResponse('Request ID required', { status: 400 });
  }

  // AUTHENTICATION
  const user = await getAuthUser(); // Try to get any authenticated user

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  let isAuthorized = false;

  // 1. Admin/Clerk check
  if (user.role === 'admin' || user.role === 'admission' || user.role === 'scholarship' || user.role === 'faculty') {
    isAuthorized = true;
  }

  // 2. Student ownership check
  if (!isAuthorized && user.student_id) {
    const rows = await query('SELECT student_id FROM student_requests WHERE request_id = ?', [request_id]);
    if (rows.length > 0 && rows[0].student_id === user.student_id) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const rows = await query(
      `SELECT payment_screenshot 
       FROM student_request_images 
       WHERE request_id = ?`,
      [request_id]
    );

    if (rows.length === 0 || !rows[0].payment_screenshot) {
      return new NextResponse('Image not found', { status: 404 });
    }

    const imageBufferOrUrl = rows[0].payment_screenshot;

    // If it's a Cloudinary URL (string), redirect to it
    if (typeof imageBufferOrUrl === 'string' && imageBufferOrUrl.startsWith('http')) {
      return NextResponse.redirect(imageBufferOrUrl);
    }

    // Otherwise, treat as Buffer (old BLOB data)
    return new NextResponse(imageBufferOrUrl, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('Error serving request image:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
