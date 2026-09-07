import { wrapHandler, apiResponse, apiError } from '@/lib/api-utils';
import { MatchService } from '@/modules/events/services/MatchService';
import { EventConfigService } from '@/modules/events/services/EventConfigService';
import { z } from 'zod';

const createMatchSchema = z.object({
  event_key: z.string().default('chess'),
  round_name: z.string().min(1, 'Round name is required'),
  player_white_id: z.number().int().positive('White player ID is required'),
  player_black_id: z.number().int().positive('Black player ID is required'),
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

    const match = await MatchService.createMatch(
      eventKey,
      {
        roundName: data.round_name,
        playerWhiteId: data.player_white_id,
        playerBlackId: data.player_black_id,
        scheduledAt: data.scheduled_at,
        customMatchCode: data.custom_match_code
      },
      user?.email || 'ADMIN'
    );

    return apiResponse(match, 201);
  }
});
