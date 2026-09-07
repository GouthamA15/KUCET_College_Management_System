import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { QuizService } from '@/modules/events/services/QuizService';
import { z } from 'zod';

const updateQuestionSchema = z.object({
  question_text: z.string().min(3).optional(),
  options: z.array(z.string().min(1)).min(2).optional(),
  correct_option_index: z.number().int().min(0).optional(),
  explanation: z.string().optional().nullable(),
  marks: z.number().min(0.5).optional(),
  negative_marks: z.number().min(0).optional(),
  category: z.string().optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  question_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

export const PUT = wrapHandler({
  auth: 'admin',
  schema: updateQuestionSchema,
  handler: async (req, { data, user, params }) => {
    const { id } = await params;
    const result = await QuizService.updateQuestion(
      id,
      data,
      user?.email || user?.id || 'ADMIN',
      'quiz'
    );
    return apiResponse(result);
  },
});

export const DELETE = wrapHandler({
  auth: 'admin',
  handler: async (req, { user, params }) => {
    const { id } = await params;
    const result = await QuizService.deleteQuestion(
      id,
      user?.email || user?.id || 'ADMIN',
      'quiz'
    );
    return apiResponse(result);
  },
});
