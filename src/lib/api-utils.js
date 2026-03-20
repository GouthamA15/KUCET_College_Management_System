import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from './auth';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { refreshAccessToken } from './auth-utils';

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
 * Authentication helper to get user from session cookies
 */
export async function getAuthUser(role = null) {
  try {
    const cookieStore = await cookies();
    let token = null;
    let expectedRole = role;
    let type = null;

    if (role === 'admin') {
      token = cookieStore.get('admin_auth')?.value;
      type = 'admin';
    } else if (role === 'clerk') {
      token = cookieStore.get('clerk_auth')?.value;
      type = 'clerk';
    } else if (role === 'student') {
      token = cookieStore.get('student_auth')?.value;
      type = 'student';
    } else {
      // Try to detect role from available cookies if not specified
      const adminToken = cookieStore.get('admin_auth')?.value;
      const clerkToken = cookieStore.get('clerk_auth')?.value;
      const studentToken = cookieStore.get('student_auth')?.value;
      
      token = adminToken || clerkToken || studentToken;
      if (adminToken) type = 'admin';
      else if (clerkToken) type = 'clerk';
      else if (studentToken) type = 'student';
    }

    if (!token) return null;

    let payload = await verifyJwt(token, process.env.JWT_SECRET);
    
    // Silent Refresh if token is expired but refresh token exists
    if (!payload && type) {
        console.log(`[getAuthUser] Token expired for ${type}, attempting silent refresh...`);
        // We create a dummy response object to hold the new cookies
        const dummyRes = NextResponse.next();
        const refreshedUser = await refreshAccessToken(dummyRes, type, cookieStore);
        if (refreshedUser) {
            // Note: Since we are in an API route (Server Component context), 
            // we can't easily set cookies back to the client here without returning the dummyRes.
            // However, subsequent calls in this request will have the updated payload.
            // Most Next.js API routes will return their own response.
            // For true silent rotation in APIs, we rely on the Middleware (proxy.js) 
            // which already handles this for all incoming requests.
            
            // Re-verify the newly set cookie from dummyRes if needed, 
            // or just fetch user again. For simplicity, we just return the payload
            // if we successfully refreshed.
            token = dummyRes.cookies.get(`${type}_auth`)?.value;
            if (token) {
                payload = await verifyJwt(token, process.env.JWT_SECRET);
            }
        }
    }

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
