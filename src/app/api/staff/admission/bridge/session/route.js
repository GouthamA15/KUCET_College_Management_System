import { getAuthUser, apiResponse, apiError } from '@/lib/api-utils';
import { clearAllAuthCookies, handleLogoutRevocation } from '@/lib/auth-utils';
import logger from '@/lib/logger';

/**
 * GET /api/staff/admission/bridge/session
 * 
 * Verifies active staff authentication and admission-role authorization
 * for the KUCET Admission Bridge Chrome Extension.
 * 
 * RBAC Rules:
 * - Allowed roles: 'admission', 'admission_clerk', 'admin', 'super_admin'
 * - Unauthorized roles (faculty, scholarship, student) receive 403 Forbidden.
 * - Unauthenticated requests receive 401 Unauthorized.
 */
export async function GET() {
  try {
    const user = await getAuthUser('staff');

    if (!user) {
      return apiError('Unauthorized: Active staff authentication required', 401);
    }

    const role = (user.role || '').toLowerCase();
    const allowedRoles = ['admission', 'admission_clerk', 'admin', 'super_admin'];

    if (!allowedRoles.includes(role)) {
      logger.warn({ role, userId: user.id || user.staffId }, '[BRIDGE_SESSION_FORBIDDEN] Non-admission staff attempted access');
      return apiError('Forbidden: Only admission staff and administrators may use the Admission Bridge', 403);
    }

    const displayName = user.name || (user.email ? user.email.split('@')[0] : 'Staff Member');

    return apiResponse({
      authenticated: true,
      authorized: true,
      user: {
        id: user.id || user.staffId || null,
        email: user.email || null,
        role: user.role,
        name: displayName,
      }
    });
  } catch (error) {
    logger.error({ err: error.message }, '[BRIDGE_SESSION_ERROR] Error checking bridge session');
    return apiError('Internal server error checking bridge session', 500);
  }
}

/**
 * DELETE /api/staff/admission/bridge/session
 * 
 * Terminates active bridge session, revokes refresh tokens, and clears auth cookies.
 */
export async function DELETE(req) {
  try {
    if (req) {
      await handleLogoutRevocation(req, 'staff').catch(() => {});
      await handleLogoutRevocation(req, 'admin').catch(() => {});
    }

    const response = apiResponse({
      success: true,
      message: 'Admission Bridge session terminated successfully'
    }, 200);

    clearAllAuthCookies(response);
    return response;
  } catch (error) {
    logger.error({ err: error.message }, '[BRIDGE_LOGOUT_ERROR] Error terminating bridge session');
    return apiError('Error logging out from Admission Bridge', 500);
  }
}
