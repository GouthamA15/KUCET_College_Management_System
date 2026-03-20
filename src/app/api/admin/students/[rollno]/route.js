import logger from '@/lib/logger';
import { db } from '@/db';
import { students, studentImages, studentPersonalDetails, studentAcademicBackground } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { decrypt } from '@/lib/encryption';

export async function GET(request, { params }) {
  const user = await getAuthUser('admin');

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  const { rollno } = await params;

  if (!rollno) {
    return apiError('Roll number is required', 400);
  }

  try {
    const studentData = await db.select({
      student: students,
      personal: studentPersonalDetails,
      academic: studentAcademicBackground,
      has_pfp: studentImages.pfp
    })
    .from(students)
    .leftJoin(studentImages, eq(students.id, studentImages.student_id))
    .leftJoin(studentPersonalDetails, eq(students.id, studentPersonalDetails.student_id))
    .leftJoin(studentAcademicBackground, eq(students.id, studentAcademicBackground.student_id))
    .where(eq(students.roll_no, rollno))
    .limit(1);

    if (studentData.length === 0) {
      return apiError('Student not found', 404);
    }

    const { student, personal, academic, has_pfp } = studentData[0];

    // Decrypt sensitive fields
    const decryptedStudent = {
      ...student,
      mobile: decrypt(student.mobile),
      personal_details: personal ? {
        ...personal,
        guardian_mobile: decrypt(personal.guardian_mobile),
        aadhaar_no: decrypt(personal.aadhaar_no)
      } : null,
      academic_background: academic || null,
      pfp: has_pfp ? `/api/student/image/${student.roll_no}` : null
    };

    return apiResponse({ student: decryptedStudent });
  } catch (error) {
    logger.error(error, 'Failed to fetch student for admin');
    return apiError('Failed to fetch student', 500);
  }
}
