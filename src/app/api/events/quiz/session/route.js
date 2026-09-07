import { wrapHandler, apiResponse, apiError } from '@/lib/api-utils';
import { QuizService } from '@/modules/events/services/QuizService';
import { EventConfigService } from '@/modules/events/services/EventConfigService';
import { z } from 'zod';

const startSessionSchema = z.object({
  user_id: z.string().min(1, 'User ID / Roll Number is required'),
  display_name: z.string().min(1, 'Name is required'),
  user_type: z.enum(['student', 'staff']).default('student'),
  department: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
});

export const POST = wrapHandler({
  schema: startSessionSchema,
  handler: async (req, { data, user }) => {
    // Check if quiz is enabled
    const config = await EventConfigService.getEventConfig('quiz');
    if (!config.is_enabled) {
      return apiError('Technical Quiz event is currently disabled by administration.', 403);
    }

    const userId = data.user_id || user?.roll_no || user?.id || user?.staffId;
    const displayName = data.display_name || user?.name || user?.email;
    const userType = data.user_type || (user?.roll_no ? 'student' : 'student');
    const department = data.department || user?.branch || user?.department;
    const email = data.email || user?.email;

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null;
    const userAgent = req.headers.get('user-agent') || null;

    const sessionData = await QuizService.startOrResumeSession({
      userId,
      userType,
      displayName,
      department,
      email,
      ipAddress,
      userAgent,
      eventKey: 'quiz',
    });

    return apiResponse(sessionData);
  },
});

export const GET = wrapHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');

  if (!userId) {
    return apiError('User ID is required', 400);
  }

  const result = await QuizService.startOrResumeSession({
    userId,
    displayName: 'Candidate',
    eventKey: 'quiz',
  });

  return apiResponse(result);
});
