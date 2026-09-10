import { wrapHandler, apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { ParticipantService } from '@/modules/events/services/ParticipantService';
import { EventConfigService } from '@/modules/events/services/EventConfigService';
import { z } from 'zod';

const registerSchema = z.object({
  event_key: z.string().default('chess'),
  notes: z.string().optional(),
});

export const GET = wrapHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const eventKey = searchParams.get('event_key') || 'chess';
  let userId = searchParams.get('user_id');

  // If user_id is explicitly requested (or 'me'), perform single participant status lookup
  if (userId) {
    if (userId === 'me' || userId === 'current') {
      try {
        const authUser = await getAuthUser();
        userId = authUser?.roll_no || authUser?.id || authUser?.staffId || null;
      } catch (_e) {
        userId = null;
      }
    }

    if (userId) {
      const participant = await ParticipantService.getParticipantByUser(eventKey, userId);
      return apiResponse({
        participant,
        isRegistered: Boolean(participant && (participant.status === 'ACCEPTED' || participant.status === 'REGISTERED')),
        status: participant?.status || 'NOT_REGISTERED'
      });
    }

    return apiResponse({
      participant: null,
      isRegistered: false,
      status: 'NOT_REGISTERED'
    });
  }

  const status = searchParams.get('status') || 'ALL';
  const search = searchParams.get('search') || '';
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const result = await ParticipantService.getParticipants(eventKey, {
    status,
    search,
    limit,
    offset
  });

  return apiResponse(result);
});

export const POST = wrapHandler({
  auth: ['student', 'staff', 'admin'],
  schema: registerSchema,
  handler: async (req, { data, user }) => {
    const eventKey = data.event_key || 'chess';

    // Verify event is enabled and registration is open
    const config = await EventConfigService.getEventConfig(eventKey);
    if (!config.is_enabled) {
      return apiError('Tournament event is currently disabled by administration.', 403);
    }
    if (!config.registration_open && user.role !== 'admin') {
      return apiError('Registration for this event is currently closed.', 400);
    }

    try {
      const participant = await ParticipantService.registerParticipant(eventKey, user, {
        notes: data.notes
      });

      return apiResponse(participant, 201);
    } catch (err) {
      if (err.status) {
        return apiError(err.message, err.status);
      }
      return apiError(err.message || 'Failed to complete tournament registration.', 500);
    }
  }
});

