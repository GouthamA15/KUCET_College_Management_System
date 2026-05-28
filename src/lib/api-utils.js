import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { verifyJwt } from './auth';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';

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
 * Audit log helper
 * @param {Request} req The incoming request object
 * @param {Object} data Audit data (userId, userType, action, targetId, targetType, before, after)
 */
export async function logAudit(req, { userId, userType, action, targetId, targetType, before, after }) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown Device';

    await db.insert(auditLogs).values({
      user_id: userId || null,
      user_type: userType || 'system',
      action: action,
      target_id: targetId ? String(targetId) : null,
      target_type: targetType || null,
      payload_before: before || null,
      payload_after: after || null,
      ip_address: ip,
      user_agent: userAgent,
    });
  } catch (error) {
    // We log the error but don't fail the main request if audit fails
    console.error('[AUDIT_LOG_ERROR]', error);
  }
}

/**
 * Authentication helper to get user from session cookies or middleware-injected headers
 */
export async function getAuthUser(role = null) {
  try {
    const cookieStore = await cookies();
    const reqHeaders = await headers();
    let token = null;
    let expectedRole = role;

    // Prioritize middleware-injected headers for silent refresh compatibility
    if (role === 'admin') {
      token = reqHeaders.get('x-admin-auth') || cookieStore.get('admin_auth')?.value;
    } else if (role === 'clerk') {
      token = reqHeaders.get('x-clerk-auth') || cookieStore.get('clerk_auth')?.value;
    } else if (role === 'student') {
      token = reqHeaders.get('x-student-auth') || cookieStore.get('student_auth')?.value;
    } else {
      // Try to detect role from available sources
      token = reqHeaders.get('x-admin-auth') || reqHeaders.get('x-clerk-auth') || reqHeaders.get('x-student-auth') ||
              cookieStore.get('admin_auth')?.value || cookieStore.get('clerk_auth')?.value || cookieStore.get('student_auth')?.value;
    }

    if (!token) return null;

    const payload = await verifyJwt(token, process.env.JWT_SECRET);
    
    // NOTE: Redundant silent refresh logic removed. 
    // The middleware (proxy.js) now authoritatively handles silent refresh 
    // and injects the new token into the request headers.

    if (!payload) return null;

    // Optional role validation
    if (expectedRole) {
      const actualRole = payload.role;
      const isStudent = actualRole === 'student' || !!payload.roll_no;
      const isClerk = ['admission', 'scholarship', 'faculty', 'clerk'].includes(actualRole);

      if (expectedRole === 'student') {
        if (!isStudent) return null;
      } else if (expectedRole === 'clerk') {
        if (!isClerk) return null;
      } else {
        if (actualRole !== expectedRole) return null;
      }
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
