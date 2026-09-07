import { wrapHandler, apiResponse, apiError } from '@/lib/api-utils';
import { ParticipantService } from '@/modules/events/services/ParticipantService';
import { EventConfigService } from '@/modules/events/services/EventConfigService';
import { z } from 'zod';

const registerSchema = z.object({
  event_key: z.string().default('chess'),
  display_name: z.string().min(1, 'Display name is required'),
  email: z.string().email().optional(),
  department: z.string().optional(),
  notes: z.string().optional(),
  user_id: z.string().optional(),
  user_type: z.enum(['student', 'staff']).optional(),
});

export const GET = wrapHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const eventKey = searchParams.get('event_key') || 'chess';
  const userId = searchParams.get('user_id');

  // Direct single-user registration status lookup
  if (userId) {
    const participant = await ParticipantService.getParticipantByUser(eventKey, userId);
    return apiResponse({ participant, isRegistered: Boolean(participant) });
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

    const userId = data.user_id || user.roll_no || user.id || user.staffId;
    const userType = data.user_type || (user.roll_no ? 'student' : user.role === 'admin' ? 'staff' : 'staff');
    const displayName = data.display_name || user.name || user.email;
    const email = data.email || user.email;
    const department = data.department || user.branch || user.department;

    const participant = await ParticipantService.registerParticipant(eventKey, {
      userId: String(userId),
      userType,
      displayName,
      email,
      department,
      notes: data.notes
    });

    return apiResponse(participant, 201);
  }
});
