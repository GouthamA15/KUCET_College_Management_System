import { wrapHandler, apiResponse, apiError } from '@/lib/api-utils';
import { QuizService } from '@/modules/events/services/QuizService';
import { ParticipantService } from '@/modules/events/services/ParticipantService';
import { z } from 'zod';

const saveAnswerSchema = z.object({
  session_code: z.string().min(1),
  user_id: z.string().min(1),
  question_id: z.number().int(),
  selected_option_index: z.number().int().nullable().optional(),
  is_marked_for_review: z.boolean().optional().default(false),
  time_spent_seconds: z.number().int().optional().default(0),
});

export const POST = wrapHandler({
  auth: ['student', 'staff', 'admin'],
  schema: saveAnswerSchema,
  handler: async (req, { data, user }) => {
    const authoritativeUser = await ParticipantService.resolveAuthoritativeUser(user);
    let effectiveUserId = authoritativeUser.userId;

    if (data.user_id && data.user_id !== effectiveUserId) {
      if (user.role === 'admin' || user.role === 'superadmin') {
        effectiveUserId = data.user_id;
      } else {
        return apiError('Forbidden: Cannot modify answers for another candidate', 403);
      }
    }

    const result = await QuizService.saveAnswer({
      sessionCode: data.session_code,
      userId: effectiveUserId,
      questionId: data.question_id,
      selectedOptionIndex: data.selected_option_index,
      isMarkedForReview: data.is_marked_for_review,
      timeSpentSeconds: data.time_spent_seconds,
      eventKey: 'quiz',
    });

    return apiResponse(result);
  },
});

