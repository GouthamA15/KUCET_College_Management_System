// src/app/api/public/college-info/route.js
import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const rows = await query(
      `SELECT first_sem_start_month, first_sem_start_day, second_sem_start_month, second_sem_start_day
       FROM college_info
       WHERE id = 1`
    );

    if (rows.length === 0) {
      // If no record exists, return default/empty values
      return NextResponse.json({ collegeInfo: {} }, { status: 200 });
    }

    return NextResponse.json({ collegeInfo: rows[0] }, { status: 200 });
  } catch (error) {
    console.error('Error fetching public college info:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
