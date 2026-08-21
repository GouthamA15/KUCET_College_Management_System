import logger from '@/lib/logger';
import { db } from '@/db';
import { studentAdmissionDrafts } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  const user = await getAuthUser('admission');
  if (!user || (user.role !== 'admission' && user.role !== 'admin')) {
    return apiError('Forbidden: Only admission staff can view drafts.', 403);
  }

  try {
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get('branch');
    const entranceExam = searchParams.get('entrance_exam');
    const status = searchParams.get('status') || 'DRAFT';

    const conditions = [eq(studentAdmissionDrafts.status, status)];
    if (branch) conditions.push(eq(studentAdmissionDrafts.branch, branch));
    if (entranceExam) conditions.push(eq(studentAdmissionDrafts.entrance_exam, entranceExam));

    const drafts = await db.select({
      id: studentAdmissionDrafts.id,
      name: studentAdmissionDrafts.name,
      father_name: studentAdmissionDrafts.father_name,
      exam_rank: studentAdmissionDrafts.exam_rank,
      admission_year: studentAdmissionDrafts.admission_year,
      entrance_exam: studentAdmissionDrafts.entrance_exam,
      branch: studentAdmissionDrafts.branch,
      created_at: studentAdmissionDrafts.created_at
    })
    .from(studentAdmissionDrafts)
    .where(and(...conditions))
    .orderBy(asc(studentAdmissionDrafts.name));
    
    return apiResponse({ data: drafts });

  } catch (error) {
    logger.error('Error fetching admission drafts:', error);
    return apiError('Failed to fetch admission drafts.', 500);
  }
}
