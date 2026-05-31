import logger from '@/lib/logger';
import { db } from '@/db';
import { clerks, semesters } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  const user = await getAuthUser('clerk');
  logger.info({ user }, '[DEBUG_CLERK_ME_USER]');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const clerkId = user.clerkId || user.id;
    if (!clerkId) {
      logger.error({ user }, '[CLERK_ME_ERROR] No clerkId or id found in token');
      return apiError('Invalid session', 401);
    }

    const rows = await db.select({
      id: clerks.id,
      name: clerks.name,
      email: clerks.email,
      role: clerks.role,
      employee_id: clerks.employee_id,
      is_hod: clerks.is_hod,
      branch: clerks.branch,
      mobile: clerks.mobile,
      pfp: clerks.pfp,
      signature: clerks.signature,
      address: clerks.address,
      is_active: clerks.is_active,
      created_at: clerks.created_at,
      last_login_at: clerks.last_login_at,
      last_login_ip: clerks.last_login_ip,
      password_changed_at: clerks.password_changed_at
    })
    .from(clerks)
    .where(eq(clerks.id, clerkId))
    .limit(1);

    if (rows.length === 0) return apiError('Clerk not found', 404);
    const clerk = rows[0];

    logger.info({ 
      last_login_at: clerk.last_login_at,
      type: typeof clerk.last_login_at,
      isDate: clerk.last_login_at instanceof Date
    }, '[DEBUG_CLERK_ME_TIMESTAMPS]');

    // Decrypt mobile if exists
    try {
      const { decrypt } = await import('@/lib/encryption');
      if (clerk.mobile) clerk.mobile = decrypt(clerk.mobile);
    } catch (encErr) {
      logger.warn({ err: encErr.message, clerkId }, '[CLERK_ME_DECRYPT_FAILED]');
    }

    // Helper to handle both URLs and legacy Buffer data
    const imageHelper = (val) => {
      if (!val) return null;
      if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:'))) return val;
      if (Buffer.isBuffer(val)) return `data:image/png;base64,${val.toString('base64')}`;
      return val;
    };

    clerk.pfp = imageHelper(clerk.pfp);
    clerk.signature = imageHelper(clerk.signature);

    try {
      const semRows = await db.select({ academic_year: semesters.academic_year })
        .from(semesters)
        .orderBy(desc(semesters.id))
        .limit(1);
      
      clerk.academic_year = semRows[0]?.academic_year || '2025-26';
    } catch (semErr) {
      logger.error({ err: semErr.message }, '[CLERK_ME_SEMESTER_FAILED]');
      clerk.academic_year = '2025-26';
    }

    return apiResponse({ data: clerk });
  } catch (error) {
    logger.error({ 
      err: error.message, 
      stack: error.stack,
      userPayload: user 
    }, '[CLERK_ME_ERROR]');
    return apiError('Internal Server Error', 500);
  }
}
