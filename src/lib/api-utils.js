import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from './auth';

/**
 * Standard API response helper
 */
export function apiResponse(data, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Standard API error response helper
 */
export function apiError(message, status = 500, details = null) {
  const response = { error: message };
  if (details) response.details = details;
  return NextResponse.json(response, { status });
}

/**
 * Authentication helper to get user from session cookies
 */
export async function getAuthUser(role = null) {
  try {
    const cookieStore = await cookies();
    let token = null;
    let expectedRole = role;

    if (role === 'admin') {
      token = cookieStore.get('admin_auth')?.value;
    } else if (role === 'clerk') {
      token = cookieStore.get('clerk_auth')?.value;
    } else if (role === 'student') {
      token = cookieStore.get('student_auth')?.value;
    } else {
      // Try to detect role from available cookies if not specified
      token = cookieStore.get('admin_auth')?.value || 
              cookieStore.get('clerk_auth')?.value || 
              cookieStore.get('student_auth')?.value;
    }

    if (!token) return null;

    const payload = await verifyJwt(token, process.env.JWT_SECRET);
    if (!payload) return null;

    // Optional role validation
    if (expectedRole && payload.role !== expectedRole && !(expectedRole === 'student' && payload.roll_no)) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('Auth check failed:', error);
    return null;
  }
}

/**
 * Middleware-like check for API routes
 */
export async function withAuth(role, handler) {
  const user = await getAuthUser(role);
  if (!user) {
    return apiError('Unauthorized', 401);
  }
  return handler(user);
}
