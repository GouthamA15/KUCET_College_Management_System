import { db } from '@/db';
import { students, studentImages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

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
    const studentWithImage = await db.select({
      student: students,
      has_pfp: studentImages.pfp
    })
    .from(students)
    .leftJoin(studentImages, eq(students.id, studentImages.student_id))
    .where(eq(students.roll_no, rollno))
    .limit(1);

    if (studentWithImage.length === 0) {
      return apiError('Student not found', 404);
    }

    const { student, has_pfp } = studentWithImage[0];

    if (has_pfp) {
        student.pfp = `/api/student/image/${student.roll_no}`;
    } else {
        student.pfp = null;
    }

    return apiResponse({ student });
  } catch (error) {
    console.error('Failed to fetch student:', error);
    return apiError('Failed to fetch student', 500);
  }
}
