import { wrapHandler, apiResponse, apiError } from '@/lib/api-utils';
import { MatchService } from '@/modules/events/services/MatchService';
import { z } from 'zod';

const createMatchSchema = z.object({
  event_key: z.string().default('chess'),
  action: z.enum(['create', 'generate_fixtures', 'start_tournament']).optional(),
  round_name: z.string().optional(),
  player_white_id: z.number().int().positive('White player ID must be positive').optional(),
  player_black_id: z.number().int().positive('Black player ID must be positive').optional(),
  scheduled_at: z.string().optional(),
  custom_match_code: z.string().optional(),
});

export const GET = wrapHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const eventKey = searchParams.get('event_key') || 'chess';
  const status = searchParams.get('status') || 'ALL';
  const roundName = searchParams.get('round_name') || null;
  const userId = searchParams.get('user_id') || null;
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const result = await MatchService.getMatches(eventKey, {
    status,
    roundName,
    userId,
    limit,
    offset
  });

  return apiResponse(result);
});

export const POST = wrapHandler({
  auth: 'admin',
  schema: createMatchSchema,
  handler: async (req, { data, user }) => {
    const eventKey = data.event_key || 'chess';
    const actor = user?.email || user?.id || 'ADMIN';

    // Automated fixture generation / Start tournament
    if (data.action === 'generate_fixtures' || data.action === 'start_tournament' || (!data.player_white_id && !data.player_black_id)) {
      try {
        const result = await MatchService.generateTournamentFixtures(
          eventKey,
          {
            roundName: data.round_name,
            scheduledAt: data.scheduled_at
          },
          actor
        );
        return apiResponse(result, 201);
      } catch (err) {
        if (err.status) return apiError(err.message, err.status);
        throw err;
      }
    }

    if (!data.player_white_id || !data.player_black_id) {
      return apiError('Both White and Black player IDs are required for manual match creation.', 400);
    }

    try {
      const match = await MatchService.createMatch(
        eventKey,
        {
          roundName: data.round_name || 'Round 1',
          playerWhiteId: data.player_white_id,
          playerBlackId: data.player_black_id,
          scheduledAt: data.scheduled_at,
          customMatchCode: data.custom_match_code
        },
        actor
      );

      return apiResponse(match, 201);
    } catch (err) {
      if (err.status) return apiError(err.message, err.status);
      throw err;
    }
  }
});
