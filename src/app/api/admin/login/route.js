import { SignJWT } from 'jose';
import bcrypt from 'bcrypt';
import { query } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/api-utils';

export async function POST(request) {
  try {
    const { email, password, rememberMe } = await request.json();

    if (!email || !password) {
      return apiError('Email and password are required', 400);
    }

    const rows = await query(
      'SELECT email, password_hash FROM principal WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return apiError('Invalid credentials', 401);
    }

    const principal = rows[0];
    const isValidPassword = await bcrypt.compare(password, principal.password_hash);

    if (!isValidPassword) {
      return apiError('Invalid credentials', 401);
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const sessionDuration = rememberMe ? '30d' : '1h';
    const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 60 * 60;

    const token = await new SignJWT({ email: principal.email, role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(sessionDuration)
      .sign(secret);

    const response = apiResponse({ success: true, message: 'Admin login successful' });

    // Clear other auth cookies
    response.cookies.delete('clerk_auth');
    response.cookies.delete('student_auth');

    response.cookies.set('admin_auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: cookieMaxAge,
      path: '/',
    });
    return response;

  } catch (error) {
    console.error('Admin Login error:', error);
    return apiError('An internal server error occurred.', 500);
  }
}