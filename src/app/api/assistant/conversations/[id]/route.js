import { wrapHandler, apiResponse, apiError } from '@/lib/api-utils';
import { AssistantService } from '@/services/AssistantService';
import { z } from 'zod';

const updateSchema = z.object({
  title: z.string().min(1, 'Title required')
});

export const PATCH = wrapHandler({
  schema: updateSchema,
  auth: ['student', 'clerk', 'admin', 'faculty', 'hod', 'admission', 'scholarship'],
  handler: async (req, { data, user, context }) => {
    if (!user) return apiError('Unauthorized', 401);
    const { id } = context.params;
    const userId = user.id || user.roll_no || user.employee_id || 'GUEST';

    const updated = await AssistantService.renameConversation(id, userId, data.title);
    return apiResponse(updated);
  }
});

export const DELETE = wrapHandler({
  auth: ['student', 'clerk', 'admin', 'faculty', 'hod', 'admission', 'scholarship'],
  handler: async (req, { user, context }) => {
    if (!user) return apiError('Unauthorized', 401);
    const { id } = context.params;
    const userId = user.id || user.roll_no || user.employee_id || 'GUEST';

    const result = await AssistantService.deleteConversation(id, userId);
    return apiResponse(result);
  }
});
