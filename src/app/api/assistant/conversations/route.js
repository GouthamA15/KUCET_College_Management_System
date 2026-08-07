import { wrapHandler, apiResponse, apiError } from '@/lib/api-utils';
import { AssistantService } from '@/services/AssistantService';
import { z } from 'zod';

const createConvSchema = z.object({
  title: z.string().optional()
});

export const GET = wrapHandler({
  auth: ['student', 'clerk', 'admin', 'faculty', 'hod', 'admission', 'scholarship'],
  handler: async (req, { user }) => {
    if (!user) return apiError('Unauthorized', 401);

    const userId = user.id || user.roll_no || user.employee_id || 'GUEST';
    let role = user.role || 'student';
    if (user.is_hod) role = 'hod';

    const conversations = await AssistantService.listConversations(userId, role);
    return apiResponse({ conversations });
  }
});

export const POST = wrapHandler({
  schema: createConvSchema,
  auth: ['student', 'clerk', 'admin', 'faculty', 'hod', 'admission', 'scholarship'],
  handler: async (req, { data, user }) => {
    if (!user) return apiError('Unauthorized', 401);

    const userId = user.id || user.roll_no || user.employee_id || 'GUEST';
    let role = user.role || 'student';
    if (user.is_hod) role = 'hod';

    const conversation = await AssistantService.createConversation(
      userId,
      role,
      data.title || 'New Conversation'
    );
    return apiResponse({ conversation });
  }
});
