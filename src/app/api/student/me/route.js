import { db } from '@/db';
import { students, studentPersonalDetails } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, wrapHandler } from '@/lib/api-utils';
import { decrypt } from '@/lib/encryption';
import { calculateYearAndSemesterAsync } from '@/lib/academic-utils';

export const GET = wrapHandler({
  auth: 'student',
  handler: async (req, { user }) => {
    // Run profile query and academic session calculation concurrently for better performance
    const profilePromise = db.select({
      student: students,
      personal: studentPersonalDetails
    })
    .from(students)
    .leftJoin(studentPersonalDetails, eq(students.id, studentPersonalDetails.student_id))
    .where(eq(students.roll_no, user.roll_no))
    .limit(1);

    // The JWT payload includes academic_offset_years
    const academicSessionPromise = calculateYearAndSemesterAsync(user.roll_no, user.academic_offset_years || 0);

    const [profile, academic_session] = await Promise.all([profilePromise, academicSessionPromise]);

    if (profile.length === 0) {
      return apiError('Profile not found', 404);
    }

    const { student, personal } = profile[0];

    // Decrypt fields
    return {
      ...student,
      academic_session,
      mobile: decrypt(student.mobile),
      personal_details: personal ? {
        ...personal,
        guardian_mobile: decrypt(personal.guardian_mobile),
        aadhaar_no: decrypt(personal.aadhaar_no)
      } : null
    };
  }
});
