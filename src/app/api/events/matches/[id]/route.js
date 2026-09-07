import { wrapHandler, apiResponse, apiError } from '@/lib/api-utils';
import { MatchService } from '@/modules/events/services/MatchService';
import { ChessEngineService } from '@/modules/events/services/ChessEngineService';
import { z } from 'zod';

const patchMatchSchema = z.object({
  action: z.enum(['publish', 'start', 'verify', 'cancel', 'record_result']),
  winner_id: z.number().int().positive().nullable().optional(),
  winner_side: z.enum(['white', 'black', 'draw']).optional(),
  result_reason: z.string().optional(),
  verification_notes: z.string().optional(),
  cancellation_reason: z.string().optional(),
});

export const GET = wrapHandler(async (req, { context }) => {
  const params = await (context?.params || {});
  const matchId = params.id;
  if (!matchId) return apiError('Match ID is required', 400);

  const gameState = await ChessEngineService.getGameState(matchId);
  return apiResponse(gameState);
});

export const PATCH = wrapHandler({
  auth: ['admin', 'student', 'staff'],
  schema: patchMatchSchema,
  handler: async (req, { data, user, context }) => {
    const params = await (context?.params || {});
    const matchId = params.id;
    if (!matchId) return apiError('Match ID is required', 400);

    const actor = user?.email || user?.roll_no || user?.id || 'ADMIN';
    const isAdmin = user?.role === 'admin' || user?.user_type === 'admin';

    if (data.action === 'publish' || data.action === 'start') {
      if (!isAdmin) return apiError('Forbidden: Only administrators can start matches', 403);
      const match = await MatchService.startMatch(matchId, actor);
      return apiResponse(match);
    } else if (data.action === 'verify') {
      if (!isAdmin) return apiError('Forbidden: Only administrators can verify results', 403);
      const match = await MatchService.verifyMatchResult(matchId, {
        verifiedBy: actor,
        verificationNotes: data.verification_notes
      });
      return apiResponse(match);
    } else if (data.action === 'cancel') {
      if (!isAdmin) return apiError('Forbidden: Only administrators can cancel matches', 403);
      const match = await MatchService.cancelMatch(matchId, {
        cancelledBy: actor,
        reason: data.cancellation_reason
      });
      return apiResponse(match);
    } else if (data.action === 'record_result') {
      const existingMatch = await MatchService.getMatchById(matchId);
      if (!existingMatch) return apiError('Match not found', 404);

      if (existingMatch.status === 'COMPLETED' && existingMatch.is_verified) {
        return apiError('Match result has already been verified and sealed. Cannot overwrite.', 400);
      }

      if (!isAdmin) {
        const currentUserId = String(user?.roll_no || user?.id || user?.staffId || '');
        const isWhite = String(existingMatch.player_white_user_id) === currentUserId;
        const isBlack = String(existingMatch.player_black_user_id) === currentUserId;
        if (!isWhite && !isBlack) {
          return apiError('Forbidden: Only match participants or administrators can submit match results', 403);
        }
      }

      const match = await MatchService.recordMatchResult(matchId, {
        winnerId: data.winner_id,
        winnerSide: data.winner_side,
        resultReason: data.result_reason || 'normal',
      }, actor);

      return apiResponse(match);
    }

    return apiError('Invalid action', 400);
  }
});
