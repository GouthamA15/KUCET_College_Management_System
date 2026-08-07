import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { cacheAside } from '@/lib/cache';
import { InstitutionAnalytics } from '../../../../../../intelligence/analytics/InstitutionAnalytics';
import { RecommendationEngine } from '../../../../../../intelligence/engine/RecommendationEngine';

export const GET = wrapHandler({ role: 'admin' }, async (req, ctx) => {
  const academicYear = '2025-26';
  const cacheKey = `dashboard:admin:${academicYear}`;

  const data = await cacheAside(cacheKey, async () => {
    const summary = await InstitutionAnalytics.getInstitutionSummary?.(academicYear).catch(() => ({}));
    const recommendations = await RecommendationEngine.generateForAdmin?.().catch(() => []);

    return {
      institutionKPIs: summary?.institutionKPIs || {},
      departmentComparison: summary?.departmentComparison || [],
      riskSummary: summary?.riskSummary || {},
      recommendations: recommendations,
      archiveStats: summary?.archiveStats || {},
      systemHealth: summary?.systemHealth || {}
    };
  }, { ttl: 300, tags: ['intelligence', 'admin'] });

  return apiResponse({
    ...data,
    reason: 'Admin dashboard aggregated data',
    rulesApplied: ['InstitutionAnalytics', 'RecommendationEngine'],
    dataUsed: { academicYear }
  });
});
