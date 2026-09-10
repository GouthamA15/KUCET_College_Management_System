import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { EventConfigService } from '@/modules/events/services/EventConfigService';
import { z } from 'zod';

const updateConfigSchema = z.object({
  event_key: z.string().default('chess'),
  event_name: z.string().optional(),
  description: z.string().optional(),
  is_enabled: z.boolean().optional(),
  registration_open: z.boolean().optional(),
  rules_json: z.object({
    time_control_minutes: z.number().optional(),
    increment_seconds: z.number().optional(),
    max_participants: z.number().optional(),
    allow_staff: z.boolean().optional(),
    allow_students: z.boolean().optional(),
    elimination_type: z.string().optional(),
  }).optional(),
});

export const GET = wrapHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const eventKey = searchParams.get('event_key');

  if (eventKey) {
    const config = await EventConfigService.getEventConfig(eventKey);
    return apiResponse(config);
  }

  const allConfigs = await EventConfigService.getAllEventConfigs();
  const hasActiveEvents = allConfigs.some(c => Boolean(c.is_enabled));
  const activeCount = allConfigs.filter(c => Boolean(c.is_enabled)).length;

  return apiResponse({
    hasActiveEvents,
    activeCount,
    configs: allConfigs,
  });
});

export const PUT = wrapHandler({
  auth: 'admin',
  schema: updateConfigSchema,
  handler: async (req, { data, user }) => {
    const eventKey = data.event_key || 'chess';
    const updated = await EventConfigService.updateEventConfig(
      eventKey,
      data,
      user?.email || user?.id || 'ADMIN'
    );
    return apiResponse(updated);
  }
});
