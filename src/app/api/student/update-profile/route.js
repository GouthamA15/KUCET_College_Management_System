import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    // The client sends 'phone', not 'phone_no'. Let's match the client.
    const { rollno, phone } = body; 

    // The backend validation should also check for 'phone'.
    if (!rollno || !phone) {
      return NextResponse.json({ error: 'Missing rollno or phone number' }, { status: 400 });
    }

    const db = getDb();
    // The table name should be 'cse_2023_students' to be consistent with the rest of the app.
    const [result] = await db.execute(
      'UPDATE students SET phone_no = ? WHERE rollno = ?',
      [phone, rollno]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Student not found or data is the same' }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Update profile error:", err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
