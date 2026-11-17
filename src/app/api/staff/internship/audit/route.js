import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { db } from '@/db';
import { internshipAuditLogs, studentInternships } from '@/db/schema';
import { desc, count, and, eq } from 'drizzle-orm';
import logger from '@/lib/logger';

export async function GET(req) {
  try {
    const user = await getAuthUser('internship_coordinator');
    if (!user) {
      return apiError('Forbidden: Access restricted to the designated Internship Coordinator or Administrator', 403);
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const action = searchParams.get('action') || null;

    const conditions = [];
    if (action && action !== 'ALL') {
      conditions.push(eq(internshipAuditLogs.action, action));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRes] = await db
      .select({ total: count() })
      .from(internshipAuditLogs)
      .where(whereClause);

    const total = totalRes?.total || 0;

    const logs = await db
      .select({
        id: internshipAuditLogs.id,
        internship_id: internshipAuditLogs.internship_id,
        opportunity_id: internshipAuditLogs.opportunity_id,
        company_id: internshipAuditLogs.company_id,
        actor_type: internshipAuditLogs.actor_type,
        actor_id: internshipAuditLogs.actor_id,
        action: internshipAuditLogs.action,
        details: internshipAuditLogs.details,
        ip_address: internshipAuditLogs.ip_address,
        created_at: internshipAuditLogs.created_at,
        company_name: studentInternships.company_name,
        role_title: studentInternships.role_title,
      })
      .from(internshipAuditLogs)
      .leftJoin(studentInternships, eq(internshipAuditLogs.internship_id, studentInternships.id))
      .where(whereClause)
      .orderBy(desc(internshipAuditLogs.created_at))
      .limit(limit)
      .offset(offset);

    return apiResponse({
      success: true,
      data: {
        items: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (err) {
    logger.error({ err: err.message }, '[GET_INTERNSHIP_AUDIT_LOGS_ERROR]');
    return apiError(err.message, 500);
  }
}
