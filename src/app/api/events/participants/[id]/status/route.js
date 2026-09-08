import { wrapHandler, apiResponse, apiError } from '@/lib/api-utils';
import { ParticipantService } from '@/modules/events/services/ParticipantService';
import { z } from 'zod';

const updateStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED', 'REGISTERED', 'WITHDRAWN']),
  notes: z.string().optional(),
  seed_number: z.number().optional(),
});

export const PATCH = wrapHandler({
  auth: 'admin',
  schema: updateStatusSchema,
  handler: async (req, { data, user, context }) => {
    const params = await (context?.params || {});
    const participantId = params.id;
    if (!participantId) return apiError('Participant ID is required', 400);

    const updated = await ParticipantService.updateParticipantStatus(
      participantId,
      data.status,
      user?.email || 'ADMIN',
      data.notes,
      data.seed_number
    );

    return apiResponse(updated);
  }
});
