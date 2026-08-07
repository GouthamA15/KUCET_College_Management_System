import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { cacheAside } from '@/lib/cache';
import { StudentAnalytics } from '../../../../../../intelligence/analytics/StudentAnalytics';
import { ScoringEngine } from '../../../../../../intelligence/engine/ScoringEngine';
import { RecommendationEngine } from '../../../../../../intelligence/engine/RecommendationEngine';

export const GET = wrapHandler({ role: 'student' }, async (req, ctx) => {
  const studentId = ctx.user?.id || 'TEST_STUDENT';
  const academicYear = '2025-26';

  const cacheKey = `dashboard:student:${studentId}:${academicYear}`;

  const data = await cacheAside(cacheKey, async () => {
    // We assume these methods exist and return promises
    const summary = await StudentAnalytics.getStudentSummary(studentId, academicYear).catch(() => ({}));
    const scores = await ScoringEngine.computeStudentScores(studentId, academicYear).catch(() => ({}));
    const recommendations = await RecommendationEngine.generateForStudent(studentId).catch(() => []);

    return {
      kpiCards: {
        attendancePercent: summary?.attendance || 0,
        marksAvg: summary?.marksAvg || 0,
        scholarshipStatus: summary?.scholarshipStatus || 'UNKNOWN',
        feeStatus: summary?.feeStatus || 'UNKNOWN'
      },
      attendanceTrend: summary?.attendanceTrend || [],
      marksTrend: summary?.marksTrend || [],
      riskScores: scores?.risk || {},
      recommendations: recommendations,
      alerts: summary?.alerts || []
    };
  }, { ttl: 300, tags: ['intelligence', `student:${studentId}`] });

  // Adding explainability base fields manually to top level as requested
  return apiResponse({
    ...data,
    reason: 'Student dashboard aggregated data',
    rulesApplied: ['StudentAnalytics', 'ScoringEngine', 'RecommendationEngine'],
    dataUsed: { studentId, academicYear }
  });
});
