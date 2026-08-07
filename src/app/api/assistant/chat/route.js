import { wrapHandler, apiResponse, apiError } from '@/lib/api-utils';
import { AssistantService } from '@/services/AssistantService';
import { z } from 'zod';

const chatSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
  conversation_id: z.string().optional()
});

export const POST = wrapHandler({
  schema: chatSchema,
  auth: ['student', 'clerk', 'admin', 'faculty', 'hod', 'admission', 'scholarship'],
  handler: async (req, { data, user }) => {
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { message, conversation_id } = data;
    const result = await AssistantService.processChatMessage({
      user,
      message,
      conversationId: conversation_id
    });

    return apiResponse(result);
  }
});
