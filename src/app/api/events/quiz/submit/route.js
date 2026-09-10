import { wrapHandler, apiResponse, apiError } from '@/lib/api-utils';
import { QuizService } from '@/modules/events/services/QuizService';
import { ParticipantService } from '@/modules/events/services/ParticipantService';
import { z } from 'zod';

const submitQuizSchema = z.object({
  session_code: z.string().min(1, 'Session code is required'),
  user_id: z.string().min(1, 'User ID is required'),
  submitted_answers: z.record(z.any()).optional().nullable(),
});

export const POST = wrapHandler({
  auth: ['student', 'staff', 'admin'],
  schema: submitQuizSchema,
  handler: async (req, { data, user }) => {
    const authoritativeUser = await ParticipantService.resolveAuthoritativeUser(user);
    let effectiveUserId = authoritativeUser.userId;

    if (data.user_id && data.user_id !== effectiveUserId) {
      if (user.role === 'admin' || user.role === 'superadmin') {
        effectiveUserId = data.user_id;
      } else {
        return apiError('Forbidden: Cannot submit assessment for another candidate', 403);
      }
    }

    const result = await QuizService.submitQuiz({
      sessionCode: data.session_code,
      userId: effectiveUserId,
      submittedAnswers: data.submitted_answers,
      eventKey: 'quiz',
    });

    return apiResponse(result);
  },
});

