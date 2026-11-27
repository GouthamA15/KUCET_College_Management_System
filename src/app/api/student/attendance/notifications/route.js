import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { GoalAndNotificationService } from '@/services/attendance/GoalAndNotificationService';
import { z } from 'zod';

const patchSchema = z.object({
  action: z.enum(['MARK_READ', 'UPDATE_PREFERENCE']),
  notification_ids: z.array(z.number().int().positive()).optional(),
  reminders_enabled: z.boolean().optional(),
});

export async function GET(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread_only') === 'true';
    const rawLimit = parseInt(searchParams.get('limit') || '30', 10) || 30;
    const limit = Math.min(100, Math.max(1, rawLimit));

    const data = await GoalAndNotificationService.getStudentNotifications(user.student_id, {
      unreadOnly,
      limit,
    });

    return apiResponse({ success: true, ...data });
  } catch (error) {
    logger.error('Fetch Streak Notifications Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function PATCH(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const body = await request.json();
    const validated = patchSchema.parse(body);

    if (validated.action === 'MARK_READ') {
      const res = await GoalAndNotificationService.markNotificationsRead(
        user.student_id,
        validated.notification_ids
      );
      return apiResponse(res);
    }

    if (validated.action === 'UPDATE_PREFERENCE') {
      const res = await GoalAndNotificationService.updateNotificationPreference(
        user.student_id,
        Boolean(validated.reminders_enabled)
      );
      return apiResponse(res);
    }

    return apiError('Invalid action', 400);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return apiError('Invalid JSON payload', 400);
    }
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid request payload', 400);
    }
    logger.error('Update Streak Notifications Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
