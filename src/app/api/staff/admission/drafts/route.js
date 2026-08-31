import logger from '@/lib/logger';
import { db } from '@/db';
import { studentAdmissionDrafts } from '@/db/schema';
import { and, asc } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { normalizeAdmissionWorkspace, buildAdmissionWorkspaceConditions } from '@/lib/admission-workspace';

export async function GET(req) {
  const user = await getAuthUser('admission');
  if (!user || (user.role !== 'admission' && user.role !== 'admin')) {
    return apiError('Forbidden: Only admission staff can view drafts.', 403);
  }

  try {
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get('branch');
    const entranceExam = searchParams.get('entrance_exam') || searchParams.get('entranceExam') || searchParams.get('intakeExam') || searchParams.get('exam');
    const entryYear = searchParams.get('entry_year') || searchParams.get('entryYear') || searchParams.get('joiningYear') || searchParams.get('admission_year') || searchParams.get('year');
    const status = searchParams.get('status') || 'DRAFT';

    if (!['DRAFT', 'PROCESSED', 'FINALIZED'].includes(status)) {
      return apiError('Invalid status parameter', 400);
    }

    // Try workspace normalization if workspace parameters provided
    const workspace = (branch || entranceExam || entryYear)
      ? normalizeAdmissionWorkspace({
          intakeExam: entranceExam,
          targetBranch: branch,
          entryYear: entryYear
        })
      : null;

    // If client supplied workspace query parameters but they were invalid, return error or empty
    if ((branch || entranceExam || entryYear) && !workspace) {
      return apiError('Invalid workspace parameters provided (intake exam, branch, or entry year).', 400);
    }

    // Build conditions using canonical helper
    const conditions = buildAdmissionWorkspaceConditions(
      studentAdmissionDrafts,
      workspace,
      status
    );

    const drafts = await db.select({
      id: studentAdmissionDrafts.id,
      name: studentAdmissionDrafts.name,
      father_name: studentAdmissionDrafts.father_name,
      exam_rank: studentAdmissionDrafts.exam_rank,
      admission_year: studentAdmissionDrafts.admission_year,
      entrance_exam: studentAdmissionDrafts.entrance_exam,
      branch: studentAdmissionDrafts.branch,
      status: studentAdmissionDrafts.status,
      roll_no: studentAdmissionDrafts.roll_no,
      email: studentAdmissionDrafts.email,
      created_at: studentAdmissionDrafts.created_at
    })
    .from(studentAdmissionDrafts)
    .where(and(...conditions))
    .orderBy(asc(studentAdmissionDrafts.name));
    
    return apiResponse({ data: drafts, workspace: workspace || null });

  } catch (error) {
    logger.error('Error fetching admission drafts:', error);
    return apiError('Failed to fetch admission drafts.', 500);
  }
}
