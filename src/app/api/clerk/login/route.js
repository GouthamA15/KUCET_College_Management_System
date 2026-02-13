import { query } from '@/lib/db';
import bcrypt from 'bcrypt';
import { SignJWT } from 'jose';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { email, password, rememberMe } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email and password are required' }, { status: 400 });
    }

    const results = await query('SELECT * FROM clerks WHERE email = ?', [email]);

    if (results.length === 0) {
      console.error(`[Clerk Login Failed] User not found for email: ${email}`);
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    const clerk = results[0];
    const passwordMatch = await bcrypt.compare(password, clerk.password_hash);

    if (!passwordMatch) {
      console.error(`[Clerk Login Failed] Password mismatch for email: ${email}`);
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    // Block login for deactivated clerks before issuing tokens/sessions
    if (!clerk.is_active) {
      console.log(`[Clerk Login] Attempt to login to deactivated account: ${email}`);
      return NextResponse.json({ success: false, message: 'Your account has been deactivated. Please contact the administrator.' }, { status: 403 });
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const sessionDuration = rememberMe ? '30d' : '1h';
    const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 60 * 60;

    // Include clerk DB id in JWT payload so downstream handlers can audit actions
    const token = await new SignJWT({ id: clerk.id, clerkId: clerk.id, email: clerk.email, role: clerk.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(sessionDuration)
      .sign(secret);

    const response = NextResponse.json({ success: true, message: 'Login successful', role: clerk.role });

    // Clear other auth cookies
    response.cookies.delete('admin_auth');
    response.cookies.delete('student_auth');

    response.cookies.set('clerk_auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: cookieMaxAge,
      path: '/',
    });
    response.cookies.set('clerk_logged_in', 'true', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      maxAge: cookieMaxAge,
      path: '/',
    });
    // Expose the clerk role in a non-httpOnly cookie so client-side code can route appropriately
    response.cookies.set('clerk_role', clerk.role || '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      maxAge: cookieMaxAge,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
