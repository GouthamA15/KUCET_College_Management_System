import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { z } from 'zod';
import { configManager } from '@/intelligence/shared/ConfigManager';

export const GET = wrapHandler({ role: 'admin' }, async (req) => {
  const [
    thresholds,
    scoreWeights,
    ruleConfig,
    dashboardConfig,
    analyticsConfig
  ] = await Promise.all([
    configManager.getThresholds(),
    configManager.getScoreWeights(),
    configManager.getRuleConfig(),
    configManager.getDashboardConfig(),
    configManager.getAnalyticsConfig(),
  ]);

  return apiResponse({
    thresholds,
    scoreWeights,
    ruleConfig,
    dashboardConfig,
    analyticsConfig
  });
});

const updateSchema = z.object({
  section: z.enum(['thresholds', 'scoreWeights', 'ruleConfig', 'dashboardConfig', 'analyticsConfig']),
  value: z.any()
});

export const POST = wrapHandler({ role: 'admin' }, async (req) => {
  const body = await req.json();
  const parsed = updateSchema.parse(body);

  await configManager.updateConfig(parsed.section, parsed.value);

  return apiResponse({ success: true, message: `${parsed.section} config updated successfully` });
});
