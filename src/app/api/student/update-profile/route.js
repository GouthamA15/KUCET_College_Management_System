import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req) {
  const cookieStore = await cookies();
  const studentAuthCookie = cookieStore.get('student_auth');

  if (!studentAuthCookie || studentAuthCookie.value !== 'true') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { rollno, phone, email } = body; 

    if (!rollno || (!phone && !email)) {
      return NextResponse.json({ error: 'Missing rollno or at least one field to update' }, { status: 400 });
    }

    const db = getDb();
    let query = 'UPDATE students SET ';
    let params = [];
    let updates = [];

    if (phone) {
      updates.push('mobile = ?');
      params.push(phone);
    }
    if (email) {
      updates.push('email = ?');
      params.push(email);
    }
    query += updates.join(', ') + ' WHERE roll_no = ?';
    params.push(rollno);

    const [result] = await db.execute(query, params);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Student not found or data is the same' }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Update profile error:", err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}