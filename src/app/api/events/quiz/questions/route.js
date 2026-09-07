import { wrapHandler, apiResponse, getAuthUser } from '@/lib/api-utils';
import { QuizService } from '@/modules/events/services/QuizService';
import { z } from 'zod';

const createQuestionSchema = z.object({
  question_text: z.string().min(3, 'Question text must be at least 3 characters'),
  options: z.array(z.string().min(1)).min(2, 'At least 2 options are required'),
  correct_option_index: z.number().int().min(0),
  explanation: z.string().optional().nullable(),
  marks: z.number().min(0.5).default(2.0),
  negative_marks: z.number().min(0).default(0.5),
  category: z.string().default('Computer Science'),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
  question_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

export const GET = wrapHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const eventKey = searchParams.get('event_key') || 'quiz';
  const activeOnly = searchParams.get('active_only') !== 'false';

  // Check if admin is calling
  const adminUser = await getAuthUser('admin');
  const isAdmin = Boolean(adminUser);

  const questions = await QuizService.getQuestions({
    isAdmin,
    eventKey,
    activeOnly: isAdmin ? false : activeOnly,
  });

  return apiResponse({ questions, count: questions.length });
});

export const POST = wrapHandler({
  auth: 'admin',
  schema: createQuestionSchema,
  handler: async (req, { data, user }) => {
    const result = await QuizService.createQuestion(
      data,
      user?.email || user?.id || 'ADMIN',
      'quiz'
    );
    return apiResponse(result, 201);
  },
});
