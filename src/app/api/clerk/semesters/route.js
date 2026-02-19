import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const academic_year = searchParams.get('academic_year');
    const semester = searchParams.get('semester');

    const db = await getDb();
    let query = 'SELECT id, academic_year, semester, start_date, end_date, weekend_pattern FROM semesters';
    const queryParams = [];

    if (academic_year && semester) {
      query += ' WHERE academic_year = ? AND semester = ?';
      queryParams.push(academic_year, semester);
    }
    
    query += ' ORDER BY academic_year DESC, semester DESC';

    const [rows] = await db.execute(query, queryParams);
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error('API_GET_SEMESTERS_ERROR:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
