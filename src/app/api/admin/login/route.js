import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    // Hardcoded super admin credentials
    if (email === 'admin@test.com' && password === 'password') {
      const token = jwt.sign({ email: 'admin@test.com', role: 'super_admin' }, process.env.JWT_SECRET, {
        expiresIn: '1h',
      });

      const response = NextResponse.json({ success: true, message: 'Super Admin login successful' });
      response.cookies.set('admin_auth', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60, // 1 hour
        path: '/',
      });
      return response;
    } else {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }
  } catch (error) {
    console.error('Super Admin Login error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}