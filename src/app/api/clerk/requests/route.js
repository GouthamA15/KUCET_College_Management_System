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
    // Map clerk roles to certificate types (keeps logic consistent with frontend)
    const clerkToTypes = {
      admission: [
        'Bonafide Certificate',
        'Course Completion Certificate',
        'Transfer Certificate (TC)',
        'Migration Certificate',
        'Study Conduct Certificate',
      ],
      scholarship: [
        'Income Tax (IT) Certificate',
        'Custodian Certificate',
      ],
    };

    const certTypes = clerkToTypes[clerkType];
    if (!certTypes || certTypes.length === 0) {
      return NextResponse.json({ error: 'No certificate types configured for this clerk' }, { status: 400 });
    }

    // Build placeholders for IN clause
    const placeholders = certTypes.map(() => '?').join(',');
    const sql = `SELECT
        sr.request_id,
        s.roll_no as roll_number,
        s.name as student_name,
        sr.certificate_type,
        sr.status,
        sr.payment_amount,
        sr.transaction_id,
        sr.payment_screenshot,
        sr.academic_year,
        sr.created_at
      FROM student_requests sr
      JOIN students s ON sr.student_id = s.id
      WHERE sr.certificate_type IN (${placeholders}) AND sr.status = 'PENDING'
      ORDER BY sr.created_at ASC`;

    const rows = await query(sql, certTypes);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching clerk requests:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}
