import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { query } from '@/lib/db';

async function verifyJwt(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    return payload;
  } catch (e) {
    console.error('JWT Verification failed:', e);
    return null;
  }
}

const toNull = (v) => (v === undefined || v === '' ? null : v);
const formatDateForSQL = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date && !isNaN(value)) return value.toISOString().slice(0, 10);
  const s = String(value);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return null;
};

export async function POST(req) {
  const cookieStore = await cookies();
  const clerkAuthCookie = cookieStore.get('clerk_auth');
  const token = clerkAuthCookie ? clerkAuthCookie.value : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const roll_no = String(body.roll_no || '').trim();
    const academic_year = String(body.academic_year || '').trim();
    const transaction_ref = String(body.transaction_ref || '').trim();
    const amount = Number(body.amount || 0);
    const transaction_date = formatDateForSQL(body.transaction_date);

    if (!roll_no) return NextResponse.json({ error: 'Missing roll_no' }, { status: 400 });
    if (!academic_year || !academic_year.match(/^\d{4}-\d{2}$/)) return NextResponse.json({ error: 'Invalid academic_year' }, { status: 400 });
    if (!transaction_ref) return NextResponse.json({ error: 'Missing transaction_ref' }, { status: 400 });
    if (!(amount > 0)) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    if (!transaction_date) return NextResponse.json({ error: 'Invalid transaction_date' }, { status: 400 });

    const [student] = await query('SELECT id FROM students WHERE roll_no = ?', [roll_no]);
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const insertSql = 'INSERT INTO student_fee_payments (student_id, academic_year, transaction_ref_no, amount, transaction_date) VALUES (?, ?, ?, ?, ?)';
    const result = await query(insertSql, [student.id, academic_year, transaction_ref, amount, transaction_date]);
    const insertedId = result?.insertId || result?.[0]?.insertId || null;

    return NextResponse.json({
      id: insertedId,
      student_id: student.id,
      academic_year,
      transaction_ref,
      amount,
      transaction_date,
    }, { status: 201 });
  } catch (error) {
    console.error('Error inserting payment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() { return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 }); }
export async function PUT() { return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 }); }