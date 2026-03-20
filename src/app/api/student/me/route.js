import { db } from '@/db';
import { students, studentPersonalDetails } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { decrypt } from '@/lib/encryption';
import logger from '@/lib/logger';

export async function GET(req) {
  try {
    const user = await getAuthUser('student');

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Fetch full profile to decrypt sensitive fields
    const profile = await db.select({
      student: students,
      personal: studentPersonalDetails
    })
    .from(students)
    .leftJoin(studentPersonalDetails, eq(students.id, studentPersonalDetails.student_id))
    .where(eq(students.roll_no, user.roll_no))
    .limit(1);

    if (profile.length === 0) {
      return apiError('Profile not found', 404);
    }

    const { student, personal } = profile[0];

    // Decrypt fields
    const decryptedData = {
      ...student,
      mobile: decrypt(student.mobile),
      personal_details: personal ? {
        ...personal,
        guardian_mobile: decrypt(personal.guardian_mobile),
        aadhaar_no: decrypt(personal.aadhaar_no)
      } : null
    };

    return apiResponse(decryptedData);
  } catch (error) {
    logger.error(error, 'API /student/me error');
    return apiError('Internal Server Error', 500);
  }
}
