import logger from '@/lib/logger';
import { db } from '@/db';
import { admissionStatusHistory, staffAccounts } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { apiError, apiResponse, wrapHandler } from '@/lib/api-utils';

export const GET = wrapHandler({
  auth: 'admission',
  handler: async (req, { user, context }) => {
    if (user.role !== 'admission' && user.role !== 'admin') return apiError('Forbidden', 403);

    const params = await context.params;
    const id = parseInt(params.id);
    if (isNaN(id)) return apiError('Invalid draft ID', 400);

    try {
      const history = await db.select({
        id: admissionStatusHistory.id,
        draft_id: admissionStatusHistory.draft_id,
        old_status: admissionStatusHistory.old_status,
        new_status: admissionStatusHistory.new_status,
        reason: admissionStatusHistory.reason,
        changed_by_user_id: admissionStatusHistory.changed_by_user_id,
        changed_by_user_type: admissionStatusHistory.changed_by_user_type,
        staff_name: staffAccounts.name,
        metadata: admissionStatusHistory.metadata,
        created_at: admissionStatusHistory.created_at
      })
      .from(admissionStatusHistory)
      .leftJoin(staffAccounts, eq(admissionStatusHistory.changed_by_user_id, staffAccounts.id))
      .where(eq(admissionStatusHistory.draft_id, id))
      .orderBy(desc(admissionStatusHistory.created_at));

      return apiResponse({ data: history });
    } catch (error) {
      logger.error(error, 'Error fetching admission status history');
      return apiError('Failed to fetch status history', 500);
    }
  }
});
