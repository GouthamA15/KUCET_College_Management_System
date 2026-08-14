import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { z } from 'zod';
import { configManager } from '@/intelligence/shared/ConfigManager';
import { RULES } from '@/intelligence/rule-engine/RuleRegistry';

export const GET = wrapHandler({ role: 'admin' }, async (_req) => {
  const ruleConfigOverrides = await configManager.getRuleConfig();

  const rules = RULES.map(rule => {
    const override = ruleConfigOverrides[rule.id] || {};
    return {
      id: rule.id,
      name: rule.name,
      category: rule.category,
      enabled: override.enabled !== undefined ? override.enabled : rule.enabled,
      threshold: override.threshold !== undefined ? override.threshold : rule.threshold,
      priority: rule.priority,
      description: rule.description,
    };
  });

  return apiResponse({ rules });
});

const patchSchema = z.object({
  ruleId: z.string(),
  enabled: z.boolean().optional(),
  threshold: z.number().optional()
});

export const PATCH = wrapHandler({ role: 'admin' }, async (req) => {
  const body = await req.json();
  const parsed = patchSchema.parse(body);

  const ruleConfigOverrides = await configManager.getRuleConfig();

  const currentOverride = ruleConfigOverrides[parsed.ruleId] || {};
  if (parsed.enabled !== undefined) currentOverride.enabled = parsed.enabled;
  if (parsed.threshold !== undefined) currentOverride.threshold = parsed.threshold;

  const newValue = {
    ...ruleConfigOverrides,
    [parsed.ruleId]: currentOverride
  };

  await configManager.updateConfig('ruleConfig', newValue);

  return apiResponse({ success: true, message: `Rule ${parsed.ruleId} config updated` });
});
