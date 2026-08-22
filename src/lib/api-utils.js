import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { verifyJwt } from './auth';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import logger from './logger';
import { z } from 'zod';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

/**
 * Standard API response helper with anti-caching headers
 */
export function apiResponse(data, status = 200, headers = {}) {
  return NextResponse.json(data, {
    status,
    headers: {
      ...NO_CACHE_HEADERS,
      ...headers
    }
  });
}

/**
 * Standard API error response helper with anti-caching headers
 */
export function apiError(message, status = 500, details = null, headers = {}) {
  const response = { error: message };
  if (details) response.details = details;
  return NextResponse.json(response, {
    status,
    headers: {
      ...NO_CACHE_HEADERS,
      ...headers
    }
  });
}

/**
 * Standardized Pagination Helper
 * @param {URLSearchParams|Object} params - Query params or options object containing page and limit
 * @param {number} defaultLimit - Default limit (default 20)
 * @param {number} maxLimit - Maximum allowed limit (default 100)
 * @returns {{ page: number, limit: number, offset: number }}
 */
export function getPaginationParams(params, defaultLimit = 20, maxLimit = 100) {
  let rawPage, rawLimit;
  if (params instanceof URLSearchParams) {
    rawPage = params.get('page');
    rawLimit = params.get('limit');
  } else if (params && typeof params === 'object') {
    rawPage = params.page;
    rawLimit = params.limit;
  }

  const page = Math.max(1, parseInt(rawPage, 10) || 1);
  const limitNum = parseInt(rawLimit, 10) || defaultLimit;
  const limit = Math.min(Math.max(1, limitNum), maxLimit);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
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
 * @param {string|string[]} [options.auth] - Optional role(s) required (e.g., 'student', ['admin', 'staff'])
 * @param {Object} [options.audit] - Optional audit logging configuration
 */
export function wrapHandler({ handler, schema, auth, audit }) {
  return async (req, context) => {
    const start = Date.now();
    const traceId = crypto.randomUUID();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const method = req.method;
    const url = req.nextUrl?.pathname || (req.url ? new URL(req.url, 'http://localhost').pathname : '');

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

        // 5. Inject Trace ID & Anti-Caching headers into response
        response.headers.set('x-trace-id', traceId);
        response.headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');

        // 6. Audit Logging (If successful and configured)
        if (audit && response.status >= 200 && response.status < 300) {
          // Normalize role for enum compliance (STUDENT, STAFF, ADMIN, SYSTEM)
          const rawRole = user?.role || 'student';
          let normalizedType = 'STUDENT';
          if (rawRole === 'admin') normalizedType = 'ADMIN';
          else if (['faculty', 'hod', 'admission', 'scholarship', 'staff'].some(r => rawRole.toLowerCase().includes(r))) normalizedType = 'STAFF';

          // Run audit in background to not block response
          logAudit(req, {
            userId: user?.id || user?.student_id || user?.staffId ,
            userType: normalizedType,
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
        // Sanitize error message for the frontend to prevent leaking raw SQL queries
        let displayError = error.message;
        if (displayError && displayError.toLowerCase().includes('failed query:')) {
          displayError = 'A database operation failed. Please try again.';
        } else if (displayError && displayError.toLowerCase().includes('connect econnrefused')) {
          displayError = 'Failed to connect to the database.';
        }

        logger.error({ method, url, duration, ip, err: error.message, stack: error.stack }, '[API_CRASH]');
        return apiError(displayError || 'An internal server error occurred', 500);
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
    } else if (['staff', 'admission', 'scholarship', 'faculty', 'hod'].includes(role)) {
      token = reqHeaders.get('x-staff-auth') || reqHeaders.get('x-admin-auth') ||
              cookieStore.get('staff_auth')?.value || cookieStore.get('admin_auth')?.value;
    } else if (role === 'student') {
      token = reqHeaders.get('x-student-auth') || cookieStore.get('student_auth')?.value;
    } else {
      // Try to detect role from available sources
      token = reqHeaders.get('x-admin-auth') || reqHeaders.get('x-staff-auth') || reqHeaders.get('x-student-auth') ||
              cookieStore.get('admin_auth')?.value || cookieStore.get('staff_auth')?.value || cookieStore.get('student_auth')?.value;
    }

    if (!token) return null;

    const jwtSecret = process.env.JWT_SECRET || 'temporary_secret_at_least_32_chars_long';
    const payload = await verifyJwt(token, jwtSecret);
    
    // NOTE: Redundant silent refresh logic removed. 
    // The middleware (proxy.js) now authoritatively handles silent refresh 
    // and injects the new token into the request headers.

    if (!payload) return null;

    // Normalize ID aliases for consistency
    if (payload.id && !payload.staffId) payload.staffId = payload.id;

    // Optional role validation
    if (expectedRole) {
      const actualRole = payload.role;
      const isStudent = actualRole === 'student' || !!payload.roll_no;
      const isStaff = ['admission', 'scholarship', 'faculty', 'staff'].includes(actualRole);

      if (expectedRole === 'student') {
        if (!isStudent) return null;
      } else if (expectedRole === 'staff') {
        if (!isStaff && actualRole !== 'admin') return null;
      } else if (expectedRole === 'admission') {
        if (actualRole !== 'admission' && actualRole !== 'admin') return null;
      } else if (expectedRole === 'scholarship') {
        if (actualRole !== 'scholarship' && actualRole !== 'admin') return null;
      } else if (expectedRole === 'faculty') {
        if (actualRole !== 'faculty' && actualRole !== 'admin') return null;
      } else if (expectedRole === 'hod') {
        if (!((actualRole === 'faculty' && payload.is_hod) || actualRole === 'admin')) return null;
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
