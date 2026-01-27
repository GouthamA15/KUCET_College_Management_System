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
    const { roll_no, pfp } = body;

    if (!roll_no) {
      return NextResponse.json({ error: 'Missing roll_no' }, { status: 400 });
    }

    // Optional: Validate file size and type if needed (though frontend already does)
    // For now, assuming frontend validation is sufficient

    const db = getDb();
    let pfpValue = null;
    if (pfp) {
      pfpValue = Buffer.from(pfp.split(',')[1], 'base64'); // Remove data URL prefix if present
    }
    // If pfp is null or empty, pfpValue remains null

    const [result] = await db.execute(
      'UPDATE students SET pfp = ? WHERE roll_no = ?',
      [pfpValue, roll_no]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Student not found or data is the same' }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Photo upload error:", err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
