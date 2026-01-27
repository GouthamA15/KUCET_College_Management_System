import { query } from '@/lib/db';
import bcrypt from 'bcrypt';
import { SignJWT } from 'jose';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email and password are required' }, { status: 400 });
    }

    const results = await query('SELECT * FROM clerks WHERE email = ?', [email]);

    if (results.length === 0) {
      console.log(`[Clerk Login] User not found for email: ${email}`);
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    const clerk = results[0];
    const passwordMatch = await bcrypt.compare(password, clerk.password_hash);

    if (!passwordMatch) {
      console.log(`[Clerk Login] Password mismatch for email: ${email}`);
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const token = await new SignJWT({ id: clerk.id, email: clerk.email, role: clerk.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secret);

    const response = NextResponse.json({ success: true, message: 'Login successful', role: clerk.role });
    response.cookies.set('clerk_auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });
    response.cookies.set('clerk_logged_in', 'true', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });
    // Expose the clerk role in a non-httpOnly cookie so client-side code can route appropriately
    response.cookies.set('clerk_role', clerk.role || '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
