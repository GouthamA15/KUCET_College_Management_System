import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StreakService } from '@/services/attendance/StreakService';
import { z } from 'zod';

const selectEmojiSchema = z.object({
  emoji_char: z.string().trim().min(1).max(16),
  emoji_code: z.string().trim().min(1).max(50),
  milestone_id: z.number().int().positive().nullable().optional(),
});

export async function POST(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = selectEmojiSchema.parse(body);

    const result = await StreakService.updateSelectedEmoji({
      studentId: user.student_id,
      emojiChar: validatedData.emoji_char,
      emojiCode: validatedData.emoji_code,
      milestoneId: validatedData.milestone_id || null,
    });

    return apiResponse(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    logger.warn({ err: error.message }, 'Select Emoji Rejection');
    return apiError(error.message || 'Failed to update selected emoji', 400);
  }
}
