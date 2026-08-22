import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { AttendanceService } from '@/services/AttendanceService';
import { z } from 'zod';

export async function PATCH(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const json = await request.json();

    // --- ZERO TRUST VALIDATION ---
    const topicSchema = z.object({
      assignment_id: z.preprocess(v => Number(v), z.number().int().positive()),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      session: z.preprocess(v => Number(v), z.number().int().min(1).max(8)),
      topic_covered: z.string().trim().min(2, 'Topic covered is required (minimum 2 characters)').max(500, 'Topic covered cannot exceed 500 characters')
    });

    const validatedData = topicSchema.parse(json);
    const { assignment_id, date, session, topic_covered } = validatedData;

    const result = await AttendanceService.updateLectureTopic({
      assignmentId: assignment_id,
      date,
      sessionNumber: session,
      topicCovered: topic_covered,
      user
    });

    return apiResponse(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues?.[0]?.message || error.errors?.[0]?.message || 'Invalid topic input data', 400);
    }
    if (error.message === 'Unauthorized' || error.message.includes('Unauthorized')) {
      return apiError(error.message, 403);
    }
    if (error.message === 'Assignment not found') {
      return apiError('Assignment not found', 404);
    }

    logger.error('Lecture Topic Update Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
