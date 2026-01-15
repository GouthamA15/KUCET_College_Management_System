import { query } from '@/lib/db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email and password are required' }, { status: 400 });
    }

    const results = await query('SELECT * FROM clerk WHERE email = ?', [email]);

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

    const token = jwt.sign({ id: clerk.id, email: clerk.email }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    const response = NextResponse.json({ success: true, message: 'Login successful' });
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

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
