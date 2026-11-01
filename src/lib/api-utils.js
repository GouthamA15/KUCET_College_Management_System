import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { verifyJwt } from './auth';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { and, eq, lte, gte, isNull, or } from 'drizzle-orm';
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
  if (details) {
    if (typeof details === 'object' && !Array.isArray(details) && details.code) {
      response.code = details.code;
    }
    response.details = details;
  }
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
  const normalizedUserType = String(userType || 'system').toLowerCase();
  const supportedUserTypes = new Set(['admin', 'staff', 'student', 'system']);
  if (!supportedUserTypes.has(normalizedUserType)) {
    const error = new Error(`Unsupported audit actor type: ${normalizedUserType}`);
    logger.error({ userType: normalizedUserType }, '[AUDIT_LOG_INVALID_ACTOR]');
    throw error;
  }

  const ip = (req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || '127.0.0.1').trim().slice(0, 45);
  const userAgent = (req.headers.get('user-agent') || 'Unknown Device').slice(0, 500);

  try {
    await db.insert(auditLogs).values({
      user_id: userId || null,
      user_type: normalizedUserType,
      action,
      target_id: targetId ? String(targetId) : null,
      target_type: targetType || null,
      payload_before: before || null,
      payload_after: after || null,
      ip_address: ip,
      user_agent: userAgent,
    });
  } catch (cause) {
    // Persistence is part of a successful audited operation. Propagate failure
    // so callers cannot report success while the mandatory record is missing.
    logger.error({ err: cause, action, userType: normalizedUserType }, '[AUDIT_LOG_ERROR]');
    const error = new Error('Audit record could not be persisted');
    error.cause = cause;
    throw error;
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
export function wrapHandler(optionsOrHandler, maybeHandler) {
  let options = {};
  let handler = null;

  if (typeof optionsOrHandler === 'function') {
    handler = optionsOrHandler;
  } else if (typeof maybeHandler === 'function') {
    options = optionsOrHandler || {};
    handler = maybeHandler;
  } else if (optionsOrHandler && typeof optionsOrHandler.handler === 'function') {
    options = optionsOrHandler;
    handler = optionsOrHandler.handler;
  } else if (optionsOrHandler && typeof optionsOrHandler === 'object') {
    options = optionsOrHandler;
    handler = optionsOrHandler.handler;
  }

  const { schema, auth = options.role, audit } = options;

  return async (req, context) => {
    if (typeof handler !== 'function') {
      logger.error({ options }, '[API_WRAPPER_ERROR] wrapHandler handler is not a function');
      return apiError('Internal Server Error: Handler configuration failed', 500);
    }
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
          // Normalize to the lowercase values in audit_logs.user_type.
          const rawRole = user?.role || 'student';
          let normalizedType = 'student';
          if (rawRole === 'admin') normalizedType = 'admin';
          else if (['faculty', 'hod', 'admission', 'scholarship', 'staff'].some(r => rawRole.toLowerCase().includes(r))) normalizedType = 'staff';

          await logAudit(req, {
            userId: user?.id || user?.student_id || user?.staffId ,
            userType: normalizedType,
            action: audit.action,
            targetId: audit.getTargetId ? audit.getTargetId(validatedData, result) : null,
            before: audit.getBefore ? await audit.getBefore(validatedData) : null,
            after: audit.getAfter ? await audit.getAfter(validatedData, result) : null
          });
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
        if (error.code === 'WARN_DATA_TRUNCATED' || error.code === 'ER_DATA_TOO_LONG' || error.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
          logger.warn({ method, url, code: error.code, ip }, '[API_DATA_VALIDATION_DB_ERROR]');
          return apiError('Invalid data provided: field value violates database format or length constraint', 400);
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_ROW_IS_REFERENCED_2') {
          logger.warn({ method, url, code: error.code, ip }, '[API_FOREIGN_KEY_DB_ERROR]');
          return apiError('Referenced record does not exist or has active dependencies', 400);
        }

        // Final fallback
        // Sanitize error message for the frontend to prevent leaking raw SQL queries or DB internals
        let displayError = error.message;
        if (displayError && displayError.toLowerCase().includes('failed query:')) {
          displayError = 'A database operation failed. Please try again.';
        } else if (
          displayError &&
          (displayError.toLowerCase().includes('econnrefused') ||
            displayError.toLowerCase().includes('econnreset') ||
            displayError.toLowerCase().includes('etimedout') ||
            displayError.toLowerCase().includes('drizzlequeryerror'))
        ) {
          displayError = 'Failed to connect to the database.';
        }

        logger.error({ 
          method, 
          url, 
          duration, 
          ip, 
          err: error.message, 
          cause: error.cause ? (error.cause.message || error.cause) : undefined,
          stack: error.stack 
        }, '[API_CRASH]');
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

    let jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      if (process.env.NODE_ENV === 'production') throw new Error('FATAL: JWT_SECRET must be set in production');
      jwtSecret = 'temporary_secret_at_least_32_chars_long';
    }
    
    // NOTE: Redundant silent refresh logic removed. 
    // The middleware (proxy.js) now authoritatively handles silent refresh 
    // and injects the new token into the request headers.

    const payload = await verifyJwt(token, jwtSecret);

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
        if (actualRole === 'admin') {
          // Admin always has HOD bypass
          payload.hod_department_code = payload.branch || 'CSE';
          payload.is_hod = true;
          payload.branch = payload.branch || 'CSE';
          payload.authorized_branches = ['CSE', 'IT', 'CSD', 'ECE', 'CIVIL', 'MECH', 'EEE'];
        } else if (actualRole === 'faculty' || actualRole === 'hod') {
          let hasPrincipal = !!payload.is_principal;
          let hasHodRole = !!payload.is_hod;
          let hodBranches = Array.isArray(payload.hod_branches) ? [...payload.hod_branches] : [];
          if (payload.branch && payload.is_hod && hodBranches.length === 0) {
            hodBranches = [payload.branch];
          }

          try {
            const { staffAccountRoles, staffRoles, facultyHodAssignments } = await import('@/db/schema');
            if (db?.select) {
              const roles = await db.select({ role_code: staffRoles.role_code })
                .from(staffAccountRoles)
                .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
                .where(eq(staffAccountRoles.staff_account_id, payload.id));
                
              if (roles && roles.length > 0) {
                const roleCodes = roles.map(r => r.role_code);
                hasPrincipal = roleCodes.includes('PRINCIPAL') || hasPrincipal;
                hasHodRole = roleCodes.includes('HOD') || hasHodRole;
              }
            }

            if (db?.query?.facultyHodAssignments) {
              const now = new Date();
              const nowStr = now.toISOString().split('T')[0];
              const queryFn = db.query.facultyHodAssignments.findMany
                ? db.query.facultyHodAssignments.findMany.bind(db.query.facultyHodAssignments)
                : db.query.facultyHodAssignments.findFirst?.bind(db.query.facultyHodAssignments);

              if (queryFn) {
                const activeResult = await queryFn({
                  where: and(
                    eq(facultyHodAssignments.staff_account_id, payload.id),
                    eq(facultyHodAssignments.is_active, true),
                    lte(facultyHodAssignments.start_date, nowStr),
                    or(
                      isNull(facultyHodAssignments.end_date),
                      gte(facultyHodAssignments.end_date, nowStr)
                    )
                  )
                });
                const assignmentsList = Array.isArray(activeResult) 
                  ? activeResult 
                  : (activeResult ? [activeResult] : []);
                if (assignmentsList.length > 0) {
                  hodBranches = Array.from(new Set([...hodBranches, ...assignmentsList.map(a => a.department_code)]));
                  hasHodRole = true;
                }
              }
            }
          } catch (_e) {
            // DB query error or test mock fallback
          }

          let isDesignatedSupervisor = false;
          if (hasPrincipal) {
            try {
              const { isVerifiedDesignatedSupervisor } = await import('@/lib/academic-authorization');
              isDesignatedSupervisor = await isVerifiedDesignatedSupervisor(payload.id, payload.email);
            } catch (err) {
              logger.error({ err: err?.message, staffId: payload.id }, '[SUPERVISOR_VERIFY_ERR] Failed to verify supervisor; failing closed.');
              isDesignatedSupervisor = false;
            }
          }

          if ((!hasHodRole || hodBranches.length === 0) && !isDesignatedSupervisor) {
            return null;
          }

          payload.is_hod = hasHodRole && hodBranches.length > 0;
          payload.is_principal = hasPrincipal;
          payload.is_designated_supervisor = isDesignatedSupervisor;
          payload.hod_branches = hodBranches;
          if (hasPrincipal && isDesignatedSupervisor) {
            payload.authorized_branches = ['CSE', 'IT', 'CSD', 'ECE', 'EEE', 'CIVIL', 'MECH'];
          } else {
            payload.authorized_branches = hodBranches;
          }
          payload.hod_department_code = hodBranches[0] || (hasPrincipal && isDesignatedSupervisor ? 'CSE' : payload.branch);
          payload.branch = payload.branch || payload.hod_department_code;
        } else {
          return null;
        }
      } else if (expectedRole === 'first_year_coordinator') {
        if (actualRole === 'admin') {
          payload.is_first_year_coordinator = true;
        } else if (actualRole === 'faculty') {
          try {
            const { CoordinatorAssignmentService } = await import('@/services/identity/CoordinatorAssignmentService');
            const activeCoord = await CoordinatorAssignmentService.getActiveCoordinatorForStaff(payload.id);
            if (activeCoord) {
              payload.is_first_year_coordinator = true;
              payload.first_year_coordinator_assignment = activeCoord;
            } else {
              return null;
            }
          } catch (_e) {
            if (!payload.is_first_year_coordinator) return null;
          }
        } else {
          return null;
        }
      } else {
        if (actualRole !== expectedRole) return null;
      }
    }

    // Attach HOD / Principal context to staff payload if available
    if (payload.role === 'faculty' && !payload.authorized_branches) {
      try {
        const { staffAccountRoles, staffRoles, facultyHodAssignments } = await import('@/db/schema');
        let hasPrincipal = !!payload.is_principal;
        let hasHodRole = !!payload.is_hod;
        let hodBranches = Array.isArray(payload.hod_branches) ? [...payload.hod_branches] : [];

        if (db?.select) {
          const roles = await db.select({ role_code: staffRoles.role_code })
            .from(staffAccountRoles)
            .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
            .where(eq(staffAccountRoles.staff_account_id, payload.id));
          if (roles && roles.length > 0) {
            const roleCodes = roles.map(r => r.role_code);
            hasPrincipal = roleCodes.includes('PRINCIPAL') || hasPrincipal;
            hasHodRole = roleCodes.includes('HOD') || hasHodRole;
          }
        }

        if (hasPrincipal || hasHodRole) {
          if (db?.query?.facultyHodAssignments) {
            const nowStr = new Date().toISOString().split('T')[0];
            const queryFn = db.query.facultyHodAssignments.findMany
              ? db.query.facultyHodAssignments.findMany.bind(db.query.facultyHodAssignments)
              : db.query.facultyHodAssignments.findFirst?.bind(db.query.facultyHodAssignments);

            if (queryFn) {
              const activeResult = await queryFn({
                where: and(
                  eq(facultyHodAssignments.staff_account_id, payload.id),
                  eq(facultyHodAssignments.is_active, true),
                  lte(facultyHodAssignments.start_date, nowStr),
                  or(
                    isNull(facultyHodAssignments.end_date),
                    gte(facultyHodAssignments.end_date, nowStr)
                  )
                )
              });
              const assignmentsList = Array.isArray(activeResult) 
                ? activeResult 
                : (activeResult ? [activeResult] : []);
              if (assignmentsList.length > 0) {
                hodBranches = Array.from(new Set([...hodBranches, ...assignmentsList.map(a => a.department_code)]));
              }
            }
          }

          if (hodBranches.length === 0 && payload.branch && payload.is_hod) {
            hodBranches = [payload.branch];
          }

          if (hasPrincipal || hodBranches.length > 0) {
            let isDesignatedSupervisor = false;
            if (hasPrincipal) {
              try {
                const { isVerifiedDesignatedSupervisor } = await import('@/lib/academic-authorization');
                isDesignatedSupervisor = await isVerifiedDesignatedSupervisor(payload.id, payload.email);
              } catch (err) {
                logger.error({ err: err?.message, staffId: payload.id }, '[SUPERVISOR_VERIFY_ERR] Failed to verify supervisor; failing closed.');
                isDesignatedSupervisor = false;
              }
            }

            payload.is_hod = hasHodRole && hodBranches.length > 0;
            payload.is_principal = hasPrincipal;
            payload.is_designated_supervisor = isDesignatedSupervisor;
            payload.hod_branches = hodBranches;
            if (hasPrincipal && isDesignatedSupervisor) {
              payload.authorized_branches = ['CSE', 'IT', 'CSD', 'ECE', 'EEE', 'CIVIL', 'MECH'];
            } else {
              payload.authorized_branches = hodBranches;
            }
            payload.hod_department_code = hodBranches[0] || (hasPrincipal && isDesignatedSupervisor ? 'CSE' : payload.branch);
          }
        }
      } catch (_e) {
        // Non-fatal
      }
    }

    // Attach First Year Coordinator context to staff payload if available
    if (payload.role === 'faculty') {
      try {
        const { CoordinatorAssignmentService } = await import('@/services/identity/CoordinatorAssignmentService');
        const activeCoord = await CoordinatorAssignmentService.getActiveCoordinatorForStaff(payload.id);
        if (activeCoord) {
          payload.is_first_year_coordinator = true;
          payload.first_year_coordinator_assignment = activeCoord;
        } else {
          payload.is_first_year_coordinator = false;
        }
      } catch (_e) {
        // Non-fatal
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
