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

export async function DELETE(req, ctx) {
  const cookieStore = await cookies();
  const clerkAuthCookie = cookieStore.get('clerk_auth');
  const token = clerkAuthCookie ? clerkAuthCookie.value : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const params = ctx?.params ? (typeof ctx.params.then === 'function' ? await ctx.params : ctx.params) : {};
    const idRaw = params?.id;
    const id = Number(idRaw);
    if (!id || !Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const delSql = 'DELETE FROM student_fee_payments WHERE id = ?';
    const result = await query(delSql, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() { return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 }); }
export async function POST() { return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 }); }
export async function PUT() { return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 }); }