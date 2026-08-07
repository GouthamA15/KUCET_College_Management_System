import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { RecommendationEngine } from '../../../../../intelligence/engine/RecommendationEngine';

export const GET = wrapHandler({ role: ['admin', 'hod', 'faculty', 'clerk', 'student'] }, async (req, ctx) => {
  const url = new URL(req.url);
  const queryRole = url.searchParams.get('role');
  
  const role = queryRole || ctx.user?.role || 'student';
  const userId = ctx.user?.id || 'TEST_USER';
  const branch = ctx.user?.branch || 'CSE';

  let recommendations = [];
  let appliedRules = [];

  try {
    if (role === 'student') {
      recommendations = await RecommendationEngine.generateForStudent?.(userId) || [];
      appliedRules.push('RecommendationEngine.generateForStudent');
    } else if (role === 'faculty' || role === 'clerk') {
      recommendations = await RecommendationEngine.generateForFaculty?.(userId) || [];
      appliedRules.push('RecommendationEngine.generateForFaculty');
    } else if (role === 'hod') {
      recommendations = await RecommendationEngine.generateForHOD?.(branch) || [];
      appliedRules.push('RecommendationEngine.generateForHOD');
    } else if (role === 'admin') {
      recommendations = await RecommendationEngine.generateForAdmin?.() || [];
      appliedRules.push('RecommendationEngine.generateForAdmin');
    }
  } catch (error) {
    recommendations = [];
  }

  return apiResponse({
    recommendations,
    reason: 'Recommendations generated based on user role',
    rulesApplied: appliedRules,
    dataUsed: { role, userId, branch }
  });
});
