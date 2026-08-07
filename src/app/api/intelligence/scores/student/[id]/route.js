import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { ScoringEngine } from '@/intelligence/scoring/ScoringEngine';

export const GET = wrapHandler({ role: ['admin', 'hod', 'student'] }, async (req, ctx) => {
  const { id } = ctx.params;
  const academicYear = '2025-26';

  // Role check: if student, must be their own id
  if (ctx.user?.role === 'student' && ctx.user?.id !== id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const scores = await ScoringEngine.computeStudentScores?.(id, academicYear).catch(() => ({}));

  return apiResponse({
    ...scores,
    reason: 'Student scores calculated',
    rulesApplied: ['ScoringEngine'],
    dataUsed: { studentId: id, academicYear }
  });
});
