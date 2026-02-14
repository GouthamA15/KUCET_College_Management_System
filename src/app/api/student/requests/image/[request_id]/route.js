import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

async function verifyJwt(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    return null;
  }
}

export async function GET(req, context) {
  const params = await context.params;
  const { request_id } = params;

  if (!request_id) {
    return new NextResponse('Request ID required', { status: 400 });
  }

  // AUTHENTICATION
  const cookieStore = await cookies();
  const studentAuth = cookieStore.get('student_auth');
  const clerkAuth = cookieStore.get('clerk_auth');
  const adminAuth = cookieStore.get('admin_auth');

  let isAuthorized = false;

  // 1. Check Admin
  if (adminAuth) {
    const payload = await verifyJwt(adminAuth.value, process.env.JWT_SECRET);
    if (payload && payload.role === 'admin') isAuthorized = true;
  }

  // 2. Check Clerk
  if (!isAuthorized && clerkAuth) {
    const payload = await verifyJwt(clerkAuth.value, process.env.JWT_SECRET);
    if (payload && (payload.role === 'admission' || payload.role === 'scholarship' || payload.role === 'faculty')) {
        isAuthorized = true;
    }
  }

  // 3. Check Student (ownership check needed)
  if (!isAuthorized && studentAuth) {
    const payload = await verifyJwt(studentAuth.value, process.env.JWT_SECRET);
    if (payload && payload.student_id) {
        // Verify ownership
        const rows = await query('SELECT student_id FROM student_requests WHERE request_id = ?', [request_id]);
        if (rows.length > 0 && rows[0].student_id === payload.student_id) {
            isAuthorized = true;
        }
    }
  }

  if (!isAuthorized) {
    return new NextResponse('Unauthorized', { status: 403 });
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

    const imageBuffer = rows[0].payment_screenshot;

    return new NextResponse(imageBuffer, {
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
