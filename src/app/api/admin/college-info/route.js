import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

// Helper function to verify JWT (Edge compatible)
async function verifyJwt(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    console.error('JWT Verification failed:', error);
    return null;
  }
}

export async function PUT(req) {
  const cookieStore = await cookies();
  const adminAuthCookie = cookieStore.get('admin_auth');
  const token = adminAuthCookie ? adminAuthCookie.value : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded || decoded.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { first_sem_start_date, second_sem_start_date } = await req.json();

    // Basic validation for date formats (can be expanded)
    const validateDate = (date) => {
        if (date === null) return true; // NULL is allowed
        return /^\d{4}-\d{2}-\d{2}$/.test(date);
    };

    if (
        (first_sem_start_date !== undefined && !validateDate(first_sem_start_date)) ||
        (second_sem_start_date !== undefined && !validateDate(second_sem_start_date))
    ) {
        return NextResponse.json({ error: 'Invalid date format. Dates should be in YYYY-MM-DD format or null.' }, { status: 400 });
    }

    const mysqlDate1 = first_sem_start_date === undefined ? null : first_sem_start_date;
    const mysqlDate2 = second_sem_start_date === undefined ? null : second_sem_start_date;
    
    // Using INSERT ... ON DUPLICATE KEY UPDATE for the single row with ID 1
    // This handles both initial creation and updates seamlessly.
    await query(
      `INSERT INTO college_info (id, first_sem_start_date, second_sem_start_date)
       VALUES (1, ?, ?)
       ON DUPLICATE KEY UPDATE
       first_sem_start_date = VALUES(first_sem_start_date),
       second_sem_start_date = VALUES(second_sem_start_date),
       updated_at = CURRENT_TIMESTAMP`,
      [mysqlDate1, mysqlDate2]
    );

    return NextResponse.json({ success: true, message: 'College info updated successfully.' }, { status: 200 });

  } catch (error) {
    console.error('Error updating college info:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}