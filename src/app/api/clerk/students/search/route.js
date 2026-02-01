import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

// Helper function to verify JWT using jose (Edge compatible)
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

export async function GET(req) {
  const cookieStore = await cookies();
  const clerkAuthCookie = cookieStore.get('clerk_auth');
  const token = clerkAuthCookie ? clerkAuthCookie.value : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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