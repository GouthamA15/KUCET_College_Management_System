import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { QuizService } from '@/modules/events/services/QuizService';
import { z } from 'zod';

const resetSessionSchema = z.object({
  session_id: z.number().int(),
});

export const GET = wrapHandler({
  auth: 'admin',
  handler: async (req) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || null;
    const search = searchParams.get('search') || '';
    const eventKey = searchParams.get('event_key') || 'quiz';

    const sessions = await QuizService.getAdminSessions({
      eventKey,
      status,
      search,
    });

    return apiResponse({ sessions, count: sessions.length });
  },
});

export const POST = wrapHandler({
  auth: 'admin',
  schema: resetSessionSchema,
  handler: async (req, { data, user }) => {
    const result = await QuizService.resetSession(
      data.session_id,
      user?.email || user?.id || 'ADMIN',
      'quiz'
    );
    return apiResponse(result);
  },
});
