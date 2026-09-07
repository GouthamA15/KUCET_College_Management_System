import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { QuizService } from '@/modules/events/services/QuizService';

export const GET = wrapHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const eventKey = searchParams.get('event_key') || 'quiz';

  const leaderboard = await QuizService.getLeaderboard({
    eventKey,
    limit,
  });

  return apiResponse({ leaderboard, count: leaderboard.length });
});
