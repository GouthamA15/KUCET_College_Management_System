import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const url = req.nextUrl;
    const name = url.searchParams.get('name');
    const admission_no = url.searchParams.get('admission_no');
    const roll_no = url.searchParams.get('roll_no');

    if (!name && !admission_no && !roll_no) {
      return NextResponse.json({ message: 'Provide name or admission_no or roll_no' }, { status: 400 });
    }

    let sql = 'SELECT * FROM students WHERE ';
    const params = [];

    if (roll_no) {
      sql += 'roll_no = ?';
      params.push(roll_no);
    } else if (admission_no) {
      sql += 'admission_no = ?';
      params.push(admission_no);
    } else {
      // name search (case-insensitive)
      sql += 'name LIKE ?';
      params.push(`%${name}%`);
    }

    sql += ' LIMIT 100';

    const rows = await query(sql, params);
    return NextResponse.json({ students: rows });
  } catch (err) {
    console.error('Search students error:', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
