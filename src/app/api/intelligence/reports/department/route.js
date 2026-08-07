import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { ExplainableDecision } from '../../../../../../intelligence/reports/ExplainableDecision';

export const GET = wrapHandler({ role: ['admin', 'hod'] }, async (req, ctx) => {
  const url = new URL(req.url);
  const queryBranch = url.searchParams.get('branch');
  const academicYear = url.searchParams.get('academicYear') || '2025-26';

  const branch = queryBranch || ctx.user?.branch || 'CSE';

  if (ctx.user?.role === 'hod' && ctx.user?.branch !== branch) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const report = await ExplainableDecision.generateDepartmentReport(branch, academicYear);

  return apiResponse(report);
});
