import { wrapHandler, apiResponse, apiError } from '@/lib/api-utils';
import { ChessEngineService } from '@/modules/events/services/ChessEngineService';
import { z } from 'zod';

const actionSchema = z.object({
  action: z.string().min(1, 'Action is required'),
});

export const POST = wrapHandler({
  auth: ['student', 'staff', 'admin'],
  schema: actionSchema,
  handler: async (req, { data, user, context }) => {
    const params = await (context?.params || {});
    const matchId = params.id;
    if (!matchId) return apiError('Match ID is required', 400);

    const userId = user.roll_no || user.id || user.staffId;
    const normalizedAction = String(data.action || '').trim().toLowerCase().replace(/-/g, '_');

    if (normalizedAction === 'resign') {
      const result = await ChessEngineService.resign(matchId, String(userId));
      return apiResponse(result);
    } else if (normalizedAction === 'offer_draw') {
      const result = await ChessEngineService.offerDraw(matchId, String(userId));
      return apiResponse(result);
    } else if (normalizedAction === 'accept_draw') {
      const result = await ChessEngineService.respondToDraw(matchId, String(userId), true);
      return apiResponse(result);
    } else if (normalizedAction === 'decline_draw') {
      const result = await ChessEngineService.respondToDraw(matchId, String(userId), false);
      return apiResponse(result);
    }

    return apiError(`Unsupported action: ${data.action}`, 400);
  }
});
