import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

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

export async function POST(req) {
  const cookieStore = await cookies();
  const studentAuthCookie = cookieStore.get('student_auth');
  const token = studentAuthCookie ? studentAuthCookie.value : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded) {
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

    // Get student ID first
    const [rows] = await db.execute('SELECT id FROM students WHERE roll_no = ?', [roll_no]);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }
    const studentId = rows[0].id;

    if (pfpValue) {
      // Insert or Update image
      await db.execute(
        'INSERT INTO student_images (student_id, pfp) VALUES (?, ?) ON DUPLICATE KEY UPDATE pfp = VALUES(pfp)',
        [studentId, pfpValue]
      );
    } else {
      // Delete image if pfp is null (removed)
      await db.execute('DELETE FROM student_images WHERE student_id = ?', [studentId]);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Photo upload error:", err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
