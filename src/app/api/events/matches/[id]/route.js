import { wrapHandler, apiResponse, apiError } from '@/lib/api-utils';
import { MatchService } from '@/modules/events/services/MatchService';
import { ChessEngineService } from '@/modules/events/services/ChessEngineService';
import { z } from 'zod';

const patchMatchSchema = z.object({
  action: z.enum(['publish', 'verify']),
  verification_notes: z.string().optional(),
});

export const GET = wrapHandler(async (req, { context }) => {
  const params = await (context?.params || {});
  const matchId = params.id;
  if (!matchId) return apiError('Match ID is required', 400);

  const gameState = await ChessEngineService.getGameState(matchId);
  return apiResponse(gameState);
});

export const PATCH = wrapHandler({
  auth: 'admin',
  schema: patchMatchSchema,
  handler: async (req, { data, user, context }) => {
    const params = await (context?.params || {});
    const matchId = params.id;
    if (!matchId) return apiError('Match ID is required', 400);

    if (data.action === 'publish') {
      const match = await MatchService.publishMatch(matchId, user?.email || 'ADMIN');
      return apiResponse(match);
    } else if (data.action === 'verify') {
      const match = await MatchService.verifyMatchResult(matchId, {
        verifiedBy: user?.email || 'ADMIN',
        verificationNotes: data.verification_notes
      });
      return apiResponse(match);
    }

    return apiError('Invalid action', 400);
  }
});
