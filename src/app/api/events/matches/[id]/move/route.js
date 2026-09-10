import { wrapHandler, apiResponse, apiError } from '@/lib/api-utils';
import { ChessEngineService } from '@/modules/events/services/ChessEngineService';
import { z } from 'zod';

const moveSchema = z.object({
  from: z.string().min(2).max(4),
  to: z.string().min(2).max(4),
  promotion: z.string().optional(),
});

export const POST = wrapHandler({
  auth: ['student', 'staff', 'admin'],
  schema: moveSchema,
  handler: async (req, { data, user, context }) => {
    const params = await (context?.params || {});
    const matchId = params.id;
    if (!matchId) return apiError('Match ID is required', 400);

    const userId = user.roll_no || user.id || user.staffId;

    const result = await ChessEngineService.makeMove(matchId, {
      userId: String(userId),
      from: data.from,
      to: data.to,
      promotion: data.promotion || 'q'
    });

    return apiResponse(result);
  }
});
