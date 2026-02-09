// src/app/api/admin/college-info/route.js
import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { cookies } from 'next/headers';

async function getAdminId() {
  const cookieStore = await cookies(); // Changed this line
  const token = cookieStore.get('admin_auth')?.value;
  if (!token) {
    return null;
  }
  const payload = await verifyJwt(token, process.env.JWT_SECRET);
  return payload?.admin_id || null;
}


export async function GET() {
  try {
    const adminId = await getAdminId();
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await query(
      `SELECT first_sem_start_month, first_sem_start_day, second_sem_start_month, second_sem_start_day
       FROM college_info
       WHERE id = 1`
    );

    if (rows.length === 0) {
      return NextResponse.json({ collegeInfo: {} }, { status: 200 });
    }

    return NextResponse.json({ collegeInfo: rows[0] }, { status: 200 });
  } catch (error) {
    console.error('Error fetching college info:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const adminId = await getAdminId();
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { first_sem_start_month, first_sem_start_day, second_sem_start_month, second_sem_start_day } = await req.json();

    const validateDatePart = (part, name) => {
      if (part !== null && (typeof part !== 'number' || part < 1 || (name.includes('month') ? part > 12 : part > 31))) {
        return `${name} must be a number between 1 and ${name.includes('month') ? 12 : 31}, or null.`;
      }
      return null;
    };

    let error = validateDatePart(first_sem_start_month, 'first_sem_start_month');
    if (error) return NextResponse.json({ error }, { status: 400 });
    error = validateDatePart(first_sem_start_day, 'first_sem_start_day');
    if (error) return NextResponse.json({ error }, { status: 400 });
    error = validateDatePart(second_sem_start_month, 'second_sem_start_month');
    if (error) return NextResponse.json({ error }, { status: 400 });
    error = validateDatePart(second_sem_start_day, 'second_sem_start_day');
    if (error) return NextResponse.json({ error }, { status: 400 });


    const existing = await query(`SELECT id FROM college_info WHERE id = 1`);
    if (existing.length === 0) {
      await query(
        `INSERT INTO college_info (id, first_sem_start_month, first_sem_start_day, second_sem_start_month, second_sem_start_day)
         VALUES (?, ?, ?, ?, ?)`,
        [1, first_sem_start_month, first_sem_start_day, second_sem_start_month, second_sem_start_day]
      );
    } else {
      await query(
        `UPDATE college_info
         SET first_sem_start_month = ?, first_sem_start_day = ?, second_sem_start_month = ?, second_sem_start_day = ?
         WHERE id = 1`,
        [first_sem_start_month, first_sem_start_day, second_sem_start_month, second_sem_start_day]
      );
    }

    return NextResponse.json({ message: 'College information updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating college info:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
