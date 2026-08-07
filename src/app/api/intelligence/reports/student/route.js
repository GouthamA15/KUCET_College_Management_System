import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { ReportGenerator } from '@/intelligence/reports/ReportGenerator';

export const GET = wrapHandler({ role: ['admin', 'hod', 'student'] }, async (req, ctx) => {
  const url = new URL(req.url);
  const queryStudentId = url.searchParams.get('studentId');
  const academicYear = url.searchParams.get('academicYear') || '2025-26';

  const studentId = queryStudentId || ctx.user?.id;

  // Role check
  if (ctx.user?.role === 'student' && ctx.user?.id !== studentId) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const report = await ReportGenerator.generateStudentReport(studentId, academicYear);

  return apiResponse(report);
});
