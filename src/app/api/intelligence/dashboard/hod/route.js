import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { cacheAside } from '@/lib/cache';
import { DepartmentAnalytics } from '@/intelligence/analytics/DepartmentAnalytics';
import { ScoringEngine } from '@/intelligence/scoring/ScoringEngine';
import { RecommendationEngine } from '@/intelligence/recommendation/RecommendationEngine';

export const GET = wrapHandler({ role: 'hod' }, async (req, ctx) => {
  const branch = ctx.user?.branch || 'CSE';
  const academicYear = '2025-26';

  const cacheKey = `dashboard:hod:${branch}:${academicYear}`;

  const data = await cacheAside(cacheKey, async () => {
    const summary = await DepartmentAnalytics.getDepartmentSummary?.(branch, academicYear).catch(() => ({}));
    const score = await ScoringEngine.computeDepartmentScore?.(branch, academicYear).catch(() => ({}));
    const recommendations = await RecommendationEngine.generateForHOD?.(branch).catch(() => []);

    return {
      kpiCards: summary?.kpiCards || {},
      departmentTrends: summary?.departmentTrends || [],
      attendanceDistribution: summary?.attendanceDistribution || {},
      subjectComparison: summary?.subjectComparison || [],
      facultyWorkload: summary?.facultyWorkload || [],
      recommendations: recommendations
    };
  }, { ttl: 300, tags: ['intelligence', `department:${branch}`] });

  return apiResponse({
    ...data,
    reason: 'HOD dashboard aggregated data',
    rulesApplied: ['DepartmentAnalytics', 'ScoringEngine', 'RecommendationEngine'],
    dataUsed: { branch, academicYear }
  });
});
