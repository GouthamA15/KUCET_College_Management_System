import logger from '@/lib/logger';
import { db } from '@/db';
import { students, studentImages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { getStorageProvider } from '@/lib/providers/storage/factory';

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

    const storage = getStorageProvider();

    if (pfp) {
      // 1. Upload to storage (Cloudinary or Local VPS)
      // This returns a relative path (e.g., 'kucet/students/pfp/rollno.jpg')
      const uploadedPath = await storage.upload(pfp, 'students/pfp', roll_no);
      
      // 2. Store the PATH in the database (efficient)
      await db.insert(studentImages)
        .values({
          student_id: studentId,
          pfp: uploadedPath
        })
        .onDuplicateKeyUpdate({ set: { pfp: uploadedPath } });
    } else {
      // Handle deletion
      const existing = await db.query.studentImages.findFirst({
        where: eq(studentImages.student_id, studentId)
      });
      if (existing?.pfp) {
        await storage.delete(existing.pfp);
      }
      await db.delete(studentImages).where(eq(studentImages.student_id, studentId));
    }

    return apiResponse({ success: true });
  } catch (err) {
    logger.error("Photo upload error:", err);
    return apiError('Server error', 500, err.message);
  }
}
