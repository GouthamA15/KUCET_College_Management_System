import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { verifyJwt } from './auth';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import logger from './logger';
import { z } from 'zod';
import { getNow } from './clock';

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
    logger.error(error, '[AUDIT_LOG_ERROR]');
  }
}

/**
 * Unified API Handler Wrapper
 * Handles: Auth, Validation, Errors, and Telemetry
 * @param {Object} options 
 * @param {Function} options.handler - The core business logic (req, { data, user }) => Promise
 * @param {z.ZodSchema} [options.schema] - Optional Zod schema for request body validation
 * @param {string|string[]} [options.auth] - Optional role(s) required (e.g., 'student', ['admin', 'clerk'])
 * @param {Object} [options.audit] - Optional audit logging configuration
 */
export function wrapHandler({ handler, schema, auth, audit }) {
  return async (req, context) => {
    const start = Date.now();
    const traceId = crypto.randomUUID();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const method = req.method;
    const url = req.nextUrl.pathname;

    return logger.runWithContext({ traceId }, async () => {
      try {
        let user = null;
        let validatedData = {};

        // 1. Authentication Check
        if (auth) {
          const roles = Array.isArray(auth) ? auth : [auth];
          // Try each allowed role until one succeeds
          for (const role of roles) {
            user = await getAuthUser(role);
            if (user) break;
          }
          
          if (!user) {
            return apiError('Unauthorized', 401);
          }
        }

        // 2. Input Validation (Body only for now, can extend to query params)
        if (schema && ['POST', 'PUT', 'PATCH'].includes(method)) {
          try {
            const body = await req.json();
            validatedData = schema.parse(body);
          } catch (err) {
            if (err instanceof z.ZodError) {
              return apiError(err.errors?.[0]?.message || 'Invalid input data', 400);
            }
            if (err instanceof SyntaxError) {
              return apiError('Malformed JSON body', 400);
            }
            throw err;
          }
        }

        // 3. Execute Handler
        const result = await handler(req, { data: validatedData, user, context, ip, userAgent });

        // 4. Handle Response
        const response = result instanceof NextResponse ? result : apiResponse(result);

        // 5. Audit Logging (If successful and configured)
        if (audit && response.status >= 200 && response.status < 300) {
          // Run audit in background to not block response
          logAudit(req, {
            userId: user?.id || user?.student_id || user?.clerkId,
            userType: user?.role || 'student',
            action: audit.action,
            targetId: audit.getTargetId ? audit.getTargetId(validatedData, result) : null,
            before: audit.getBefore ? await audit.getBefore(validatedData) : null,
            after: audit.getAfter ? await audit.getAfter(validatedData, result) : null
          }).catch(err => logger.error(err, '[AUDIT_FAILED]'));
        }

        // 6. Success Telemetry & Performance Profiling
        const duration = Date.now() - start;
        const logData = { method, url, status: response.status, duration, ip };
        
        if (duration > 500) {
          logger.warn(logData, '[API_SLOW_PERFORMANCE]');
        } else {
          logger.info(logData, '[API_SUCCESS]');
        }

        return response;

      } catch (error) {
        const duration = Date.now() - start;
        
        // Handle known service errors
        if (error.status && error.message) {
          logger.warn({ method, url, status: error.status, duration, ip, msg: error.message }, '[API_EXPECTED_ERROR]');
          return apiError(error.message, error.status);
        }

        // Handle Database errors (Drizzle/MySQL)
        if (error.code === 'ER_DUP_ENTRY') {
          return apiError('Duplicate entry detected', 409);
        }

        // Final fallback
        logger.error({ method, url, duration, ip, err: error.message, stack: error.stack }, '[API_CRASH]');
        return apiError('An internal server error occurred', 500, process.env.NODE_ENV === 'development' ? error.message : null);
      }
    });
  };
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
