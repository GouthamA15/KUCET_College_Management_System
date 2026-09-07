import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { QuizService } from '@/modules/events/services/QuizService';
import { z } from 'zod';

const updateQuizConfigSchema = z.object({
  event_name: z.string().optional(),
  description: z.string().optional(),
  is_enabled: z.boolean().optional(),
  registration_open: z.boolean().optional(),
  rules_json: z.object({
    duration_minutes: z.number().min(1).max(180).optional(),
    total_questions: z.number().optional(),
    passing_percentage: z.number().min(0).max(100).optional(),
    marks_per_question: z.number().min(0.5).max(10).optional(),
    negative_marking: z.number().min(0).max(5).optional(),
    shuffle_questions: z.boolean().optional(),
    allow_review: z.boolean().optional(),
    show_instant_result: z.boolean().optional(),
    max_attempts_per_user: z.number().min(1).max(10).optional(),
    category: z.string().optional(),
  }).optional(),
});

export const GET = wrapHandler(async () => {
  const config = await QuizService.getQuizConfig('quiz');
  return apiResponse(config);
});

export const PUT = wrapHandler({
  auth: 'admin',
  schema: updateQuizConfigSchema,
  handler: async (req, { data, user }) => {
    const updated = await QuizService.updateQuizConfig(
      data,
      user?.email || user?.id || 'ADMIN',
      'quiz'
    );
    return apiResponse(updated);
  },
});
