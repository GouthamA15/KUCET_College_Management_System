import logger from '@/lib/logger';
import { db } from '@/db';
import { students as studentsTable, studentPersonalDetails } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, wrapHandler } from '@/lib/api-utils';
import { z } from 'zod';

const apaarSchema = z.object({
  apaar_id: z.string()
    .transform(v => (v || '').replace(/\s+/g, ''))
    .refine(v => /^\d{12}$/.test(v), {
      message: 'APAAR ID must be exactly 12 numeric digits'
    })
});

/**
 * GET /api/student/apaar
 * Returns the current student's APAAR ID status
 */
export const GET = wrapHandler({
  auth: 'student',
  handler: async (req, { user }) => {
    const rollNo = user.roll_no;
    if (!rollNo) return apiError('Student identity missing from session', 400);

    const [studentRecord] = await db.select({
      id: studentsTable.id,
      apaar_id: studentPersonalDetails.apaar_id
    })
    .from(studentsTable)
    .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
    .where(eq(studentsTable.roll_no, rollNo))
    .limit(1);

    if (!studentRecord) return apiError('Student record not found', 404);

    const apaarId = studentRecord.apaar_id || null;
    return {
      apaar_id: apaarId,
      is_submitted: !!apaarId
    };
  }
});

/**
 * POST /api/student/apaar
 * Submit APAAR ID once. Once submitted, it is strictly read-only on the student side.
 */
export const POST = wrapHandler({
  auth: 'student',
  schema: apaarSchema,
  handler: async (req, { data, user }) => {
    const rollNo = user.roll_no;
    if (!rollNo) return apiError('Student identity missing from session', 400);

    const [studentRecord] = await db.select({
      id: studentsTable.id,
      apaar_id: studentPersonalDetails.apaar_id,
      personalDetailsId: studentPersonalDetails.id
    })
    .from(studentsTable)
    .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
    .where(eq(studentsTable.roll_no, rollNo))
    .limit(1);

    if (!studentRecord) return apiError('Student record not found', 404);

    // INVARIANT: Read-only once submitted. Do not allow overwrite from student-side.
    if (studentRecord.apaar_id && studentRecord.apaar_id.trim() !== '') {
      return apiError('APAAR ID has already been submitted and is locked. Please contact the admission office for corrections.', 400);
    }

    const cleanApaar = data.apaar_id;

    if (studentRecord.personalDetailsId) {
      await db.update(studentPersonalDetails)
        .set({ apaar_id: cleanApaar })
        .where(eq(studentPersonalDetails.id, studentRecord.personalDetailsId));
    } else {
      await db.insert(studentPersonalDetails)
        .values({
          student_id: studentRecord.id,
          apaar_id: cleanApaar
        });
    }

    logger.info({ rollNo, apaar_id: cleanApaar }, '[APAAR_SUBMITTED] Student successfully submitted APAAR ID');

    return {
      success: true,
      message: 'APAAR ID submitted successfully',
      apaar_id: cleanApaar
    };
  }
});
