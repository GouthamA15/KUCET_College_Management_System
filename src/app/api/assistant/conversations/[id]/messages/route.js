import { wrapHandler, apiResponse, apiError } from '@/lib/api-utils';
import { AssistantService } from '@/services/AssistantService';

export const GET = wrapHandler({
  auth: ['student', 'clerk', 'admin', 'faculty', 'hod', 'admission', 'scholarship'],
  handler: async (req, { user, context }) => {
    if (!user) return apiError('Unauthorized', 401);
    const { id } = context.params;
    const userId = user.id || user.roll_no || user.employee_id || 'GUEST';

    const messages = await AssistantService.getMessages(id, userId);
    return apiResponse({ messages });
  }
});
