import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { cacheAside } from '@/lib/cache';
import { FacultyAnalytics } from '@/intelligence/analytics/FacultyAnalytics';
import { ScoringEngine } from '@/intelligence/scoring/ScoringEngine';
import { RecommendationEngine } from '@/intelligence/recommendation/RecommendationEngine';

export const GET = wrapHandler({ role: ['faculty', 'clerk'] }, async (req, ctx) => {
  const facultyId = ctx.user?.id || 'TEST_FACULTY';
  const academicYear = '2025-26';

  const cacheKey = `dashboard:faculty:${facultyId}:${academicYear}`;

  const data = await cacheAside(cacheKey, async () => {
    const summary = await FacultyAnalytics.getFacultySummary?.(facultyId, academicYear).catch(() => ({}));
    await ScoringEngine.computeFacultyScore?.(facultyId, academicYear).catch(() => ({}));
    const recommendations = await RecommendationEngine.generateForFaculty?.(facultyId).catch(() => []);

    return {
      kpiCards: summary?.kpiCards || {},
      subjectPerformance: summary?.subjectPerformance || [],
      studentRiskOverview: summary?.studentRiskOverview || {},
      recommendations: recommendations,
      workloadSummary: summary?.workloadSummary || {}
    };
  }, { ttl: 300, tags: ['intelligence', `faculty:${facultyId}`] });

  return apiResponse({
    ...data,
    reason: 'Faculty dashboard aggregated data',
    rulesApplied: ['FacultyAnalytics', 'ScoringEngine', 'RecommendationEngine'],
    dataUsed: { facultyId, academicYear }
  });
});
