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
      // SECURITY: Validate pfp is a valid data URI image
      const dataUriRegex = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/;
      if (typeof pfp !== 'string' || !dataUriRegex.test(pfp)) {
        return apiError('Invalid image format. Only PNG, JPEG, JPG, GIF and WebP data URIs are allowed.', 400);
      }

      // 1. Fetch old pfp to delete
      const existing = await db.query.studentImages.findFirst({
        where: eq(studentImages.student_id, studentId)
      });

      // 2. Upload new to storage
      const uploadedPath = await storage.upload(pfp, 'students/pfp', roll_no);
      
      if (typeof uploadedPath !== 'string' || uploadedPath.length === 0) {
        logger.error({ roll_no, studentId }, 'Storage upload failed or returned invalid path');
        return apiError('Failed to upload image', 500);
      }

      // 3. Cleanup old file
      if (existing?.pfp) {
        await storage.delete(existing.pfp);
      }

      // 4. Store the PATH in the database
      await db.insert(studentImages)
        .values({
          student_id: studentId,
          pfp: uploadedPath
        })
        .onDuplicateKeyUpdate({ set: { pfp: uploadedPath } });
    } else {
      // Handle deletion in a transaction to prevent races
      await db.transaction(async (tx) => {
        const existing = await tx.query.studentImages.findFirst({
          where: eq(studentImages.student_id, studentId)
        });
        
        if (existing?.pfp) {
          await storage.delete(existing.pfp);
        }
        
        await tx.delete(studentImages).where(eq(studentImages.student_id, studentId));
      });
    }

    return apiResponse({ success: true });
  } catch (err) {
    logger.error("Photo upload error:", err);
    return apiError('Server error', 500, err.message);
  }
}
