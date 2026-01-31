import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;

async function getClerkFromToken(request) {
  const token = request.cookies.get('clerk_auth')?.value;
  if (!token) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    return payload;
  } catch (error) {
    return null;
  }
}

export async function GET(request) {
  const clerk = await getClerkFromToken(request);
  if (!clerk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clerkType = searchParams.get('clerkType');

  if (!clerkType || clerk.role !== clerkType) {
    // This check ensures a clerk can only access requests for their own role.
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const rows = await query(
      `SELECT 
         sr.request_id, 
         sr.roll_number, 
         s.name as student_name,
         sr.certificate_type, 
         sr.status,
         sr.payment_amount,
         sr.transaction_id,
         sr.payment_screenshot,
         sr.created_at 
       FROM student_requests sr
       JOIN students s ON sr.roll_number = s.roll_no
       WHERE sr.clerk_type = ? AND sr.status = 'pending' 
       ORDER BY sr.created_at ASC`,
      [clerkType]
    );
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}
