import { wrapHandler, apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { QuizService } from '@/modules/events/services/QuizService';
import { EventConfigService } from '@/modules/events/services/EventConfigService';
import { ParticipantService } from '@/modules/events/services/ParticipantService';
import { z } from 'zod';

const startSessionSchema = z.object({
  event_key: z.string().default('quiz'),
  session_code: z.string().optional(),
});

export const POST = wrapHandler({
  auth: ['student', 'staff', 'admin'],
  schema: startSessionSchema,
  handler: async (req, { data, user }) => {
    // Check if quiz is enabled
    const config = await EventConfigService.getEventConfig('quiz');
    if (!config.is_enabled) {
      return apiError('Technical Quiz event is currently disabled by administration.', 403);
    }

    try {
      // 1. Authoritatively resolve user details from primary college database
      const authoritativeUser = await ParticipantService.resolveAuthoritativeUser(user);

      // 2. Ensure participant is registered in experiment_college_db
      await ParticipantService.registerParticipant('quiz', authoritativeUser);

      const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null;
      const userAgent = req.headers.get('user-agent') || null;

      // 3. Start or resume candidate sitting
      const sessionData = await QuizService.startOrResumeSession({
        userId: authoritativeUser.userId,
        userType: authoritativeUser.userType,
        displayName: authoritativeUser.displayName,
        department: authoritativeUser.department,
        email: authoritativeUser.email,
        ipAddress,
        userAgent,
        eventKey: 'quiz',
        sessionCode: data?.session_code
      });

      return apiResponse(sessionData);
    } catch (err) {
      if (err.status) {
        return apiError(err.message, err.status);
      }
      return apiError(err.message || 'Failed to start assessment session.', 500);
    }
  },
});

export const GET = wrapHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  let userId = searchParams.get('user_id');
  const sessionCode = searchParams.get('session_code');

  if (!userId) {
    try {
      const authUser = await getAuthUser();
      if (authUser) {
        userId = authUser.roll_no || authUser.id || authUser.staffId;
      }
    } catch (_e) {
      // unauthenticated
    }
  }

  if (!userId && !sessionCode) {
    return apiError('Authenticated student session or session code is required', 400);
  }

  const result = await QuizService.startOrResumeSession({
    userId: userId || 'Candidate',
    displayName: 'Candidate',
    eventKey: 'quiz',
    sessionCode
  });

  return apiResponse(result);
});

