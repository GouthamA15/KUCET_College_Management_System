import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_auth')?.value;

    if (!token) {
      return NextResponse.json({ message: 'No token provided' }, { status: 401 });
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    // Check if the role is admin
    if (payload.role !== 'admin') {
      return NextResponse.json({ message: 'Invalid token role' }, { status: 403 });
    }

    return NextResponse.json({ valid: true, admin: payload });

  } catch (error) {
    console.error('Admin token verification error:', error);
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }
}