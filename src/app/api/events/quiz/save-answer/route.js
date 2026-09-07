import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { QuizService } from '@/modules/events/services/QuizService';
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
  schema: saveAnswerSchema,
  handler: async (req, { data }) => {
    const result = await QuizService.saveAnswer({
      sessionCode: data.session_code,
      userId: data.user_id,
      questionId: data.question_id,
      selectedOptionIndex: data.selected_option_index,
      isMarkedForReview: data.is_marked_for_review,
      timeSpentSeconds: data.time_spent_seconds,
      eventKey: 'quiz',
    });

    return apiResponse(result);
  },
});
