import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const rows = await query(
      `SELECT first_sem_start_date, second_sem_start_date FROM college_info WHERE id = 1`
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { first_sem_start_date: null, second_sem_start_date: null, message: 'College info not set.' },
        { status: 200 }
      );
    }

    const { first_sem_start_date, second_sem_start_date } = rows[0];
    return NextResponse.json({ first_sem_start_date, second_sem_start_date }, { status: 200 });

  } catch (error) {
    console.error('Error fetching college info:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}