import { db } from '@/db';
import { students as studentsTable, studentPersonalDetails } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { apiError, wrapHandler } from '@/lib/api-utils';

/**
 * GET /api/staff/admission/apaar-stats
 * Returns APAAR ID compliance statistics for admission staff
 */
export const GET = wrapHandler({
  auth: 'admission',
  handler: async (req, { user }) => {
    if (user.role !== 'admission' && user.role !== 'admin') {
      return apiError('Forbidden', 403);
    }

    const [stats] = await db.select({
      total_active: sql`COUNT(DISTINCT ${studentsTable.id})`,
      missing_count: sql`COUNT(DISTINCT CASE WHEN ${studentPersonalDetails.apaar_id} IS NULL OR ${studentPersonalDetails.apaar_id} = '' THEN ${studentsTable.id} END)`,
      submitted_count: sql`COUNT(DISTINCT CASE WHEN ${studentPersonalDetails.apaar_id} IS NOT NULL AND ${studentPersonalDetails.apaar_id} != '' THEN ${studentsTable.id} END)`
    })
    .from(studentsTable)
    .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
    .where(eq(studentsTable.student_status, 'ACTIVE'));

    return {
      total_active: Number(stats?.total_active || 0),
      missing_count: Number(stats?.missing_count || 0),
      submitted_count: Number(stats?.submitted_count || 0)
    };
  }
});
