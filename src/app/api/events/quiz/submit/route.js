import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { QuizService } from '@/modules/events/services/QuizService';
import { z } from 'zod';

const submitQuizSchema = z.object({
  session_code: z.string().min(1, 'Session code is required'),
  user_id: z.string().min(1, 'User ID is required'),
  submitted_answers: z.record(z.any()).optional().nullable(),
});

export const POST = wrapHandler({
  schema: submitQuizSchema,
  handler: async (req, { data }) => {
    const result = await QuizService.submitQuiz({
      sessionCode: data.session_code,
      userId: data.user_id,
      submittedAnswers: data.submitted_answers,
      eventKey: 'quiz',
    });

    return apiResponse(result);
  },
});
