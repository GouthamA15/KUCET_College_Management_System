import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  students as studentsTable
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, wrapHandler } from '@/lib/api-utils';
import { StudentService } from '@/services/StudentService';
import { studentUpdateSchema } from '@/lib/validations/student';
import { encrypt, hashForIndex } from '@/lib/encryption';

/**
 * GET /api/clerk/students/[rollno]
 * Fetch full student profile for clerk view
 */
export const GET = wrapHandler({
  auth: 'clerk',
  handler: async (req, { context }) => {
    const { rollno } = await context.params;
    const profile = await StudentService.getStudentProfile(rollno);

    if (!profile) {
      return apiError('Student not found', 404);
    }

    return profile;
  }
});

/**
 * PUT /api/clerk/students/[rollno]
 * Update student core details
 */
export const PUT = wrapHandler({
  auth: 'clerk',
  schema: studentUpdateSchema,
  handler: async (req, { data, context }) => {
    const { rollno } = await context.params;
    const roll = StudentService.normalizeRollNo(rollno);

    const { name, gender, mobile, email, date_of_birth } = data;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (gender !== undefined) updateData.gender = gender;
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth ? new Date(date_of_birth) : null;

    if (mobile !== undefined) {
      const normMobile = mobile ? StudentService.normalizeMobile(mobile) : '';
      updateData.mobile = normMobile ? encrypt(normMobile) : null;
      updateData.mobile_hash = normMobile ? hashForIndex(normMobile) : null;
    }

    const [result] = await db.update(studentsTable)
      .set(updateData)
      .where(eq(studentsTable.roll_no, roll));

    if (result.affectedRows === 0) {
      return apiError('Student not found or no changes made', 404);
    }

    return { success: true, message: 'Student details updated successfully' };
  }
});
