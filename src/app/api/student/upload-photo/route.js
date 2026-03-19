import { db } from '@/db';
import { students, studentImages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function POST(req) {
  const user = await getAuthUser('student');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const { roll_no, pfp } = body;

    if (!roll_no) return apiError('Missing roll_no', 400);

    const student = await db.query.students.findFirst({
      columns: { id: true },
      where: eq(students.roll_no, roll_no)
    });

    if (!student) return apiError('Student not found', 404);
    const studentId = student.id;

    if (pfp) {
      // NOTE: Original code converted to Buffer. If the column is TEXT, 
      // it might be better to store as data URL or Cloudinary URL.
      // Maintaining original logic:
      const pfpValue = Buffer.from(pfp.split(',')[1], 'base64');
      
      await db.insert(studentImages)
        .values({
          student_id: studentId,
          pfp: pfpValue.toString('base64') // Storing as base64 string for TEXT column
        })
        .onDuplicateKeyUpdate({ set: { pfp: pfpValue.toString('base64') } });
    } else {
      await db.delete(studentImages).where(eq(studentImages.student_id, studentId));
    }

    return apiResponse({ success: true });
  } catch (err) {
    console.error("Photo upload error:", err);
    return apiError('Server error', 500, err.message);
  }
}
