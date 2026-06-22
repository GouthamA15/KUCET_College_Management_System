import { db } from '@/db';
import { auditLogs, clerks, principal } from '@/db/schema';
import { eq, and, desc, like, sql, or } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import logger from '@/lib/logger';

export async function GET(req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const userType = searchParams.get('userType');
    const targetId = searchParams.get('targetId');
    const limitParam = parseInt(searchParams.get('limit') || '50');
    const limit = Math.min(limitParam, 100);
    const lastSeenId = searchParams.get('last_seen_id') ? parseInt(searchParams.get('last_seen_id')) : null;

    // Build filters
    const filters = [];
    if (action) filters.push(eq(auditLogs.action, action));
    if (userType) filters.push(eq(auditLogs.user_type, userType));
    if (targetId) filters.push(eq(auditLogs.target_id, targetId));
    if (lastSeenId) filters.push(sql`${auditLogs.id} < ${lastSeenId}`);

    // Fetch logs with basic user info join
    // Note: Since user_id can refer to different tables based on user_type, 
    // we'll fetch raw logs first and then decorate if needed, or just return raw for now.
    const logs = await db.select()
      .from(auditLogs)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(auditLogs.id))
      .limit(limit);

    // Get total count for pagination
    const [countResult] = await db.select({ count: sql`count(*)` })
      .from(auditLogs)
      .where(filters.length > 0 ? and(...filters) : undefined);

    return apiResponse({ 
      logs, 
      total: parseInt(countResult.count),
      limit,
      last_seen_id: logs.length > 0 ? logs[logs.length - 1].id : null
    });

  } catch (error) {
    logger.error(error, 'Failed to fetch audit logs');
    return apiError('Internal Server Error', 500);
  }
}
