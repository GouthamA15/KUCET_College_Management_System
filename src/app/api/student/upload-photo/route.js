import logger from '@/lib/logger';
import { db } from '@/db';
import { students, studentImages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { storage } from '@/lib/providers';

export async function POST(req) {
  const user = await getAuthUser('student');
  if (!user) {
    return apiError('Please login again.', 401);
  }

  try {
    const body = await req.json();
    const { roll_no, pfp } = body;

    if (!roll_no) {
      return apiError('Missing roll_no parameter.', 400);
    }

    // Security check: Student can only update their own photo
    if (user.roll_no !== roll_no) {
      return apiError('Forbidden: Access denied.', 403);
    }

    const student = await db.query.students.findFirst({
      columns: { id: true },
      where: eq(students.roll_no, roll_no)
    });

    if (!student) {
      return apiError('Student record not found.', 404);
    }
    const studentId = student.id;

    if (pfp) {
      // 1. Validate Base64 image type (JPEG, PNG, WEBP)
      if (!pfp.startsWith('data:image/jpeg') && !pfp.startsWith('data:image/png') && !pfp.startsWith('data:image/webp')) {
        return apiError('Unsupported image type. Only JPG, PNG and WEBP are supported.', 400);
      }

      // 2. Validate size (Base64 length * 0.75 <= 1MB)
      const imageBytes = pfp.length * 0.75;
      if (imageBytes > 1024 * 1024) {
        return apiError('Image exceeds maximum size of 1MB.', 400);
      }

      // 3. Delete old photo first (prevent orphan files)
      const existing = await db.query.studentImages.findFirst({
        where: eq(studentImages.student_id, studentId)
      });
      if (existing?.pfp) {
        await storage.delete(existing.pfp).catch(err => {
          logger.warn('Old photo deletion warning (non-fatal):', err.message);
        });
      }

      // 4. Upload using Storage Provider
      let pfpStorageKey;
      try {
        pfpStorageKey = await storage.upload(pfp, 'students/pfp', roll_no);
      } catch (uploadError) {
        logger.error("Storage upload failed:", uploadError);
        return apiError(`Upload failed: ${uploadError.message}`, 500);
      }

      if (!pfpStorageKey || typeof pfpStorageKey !== 'string') {
        return apiError('Upload failed: Invalid storage key returned.', 500);
      }

      // 5. Update Database with storage key (NOT a URL)
      try {
        await db.insert(studentImages)
          .values({
            student_id: studentId,
            pfp: pfpStorageKey
          })
          .onDuplicateKeyUpdate({ set: { pfp: pfpStorageKey } });
      } catch (dbError) {
        logger.error("Database update failed for student pfp:", dbError);
        // Rollback: delete the newly uploaded file
        await storage.delete(pfpStorageKey).catch(() => {});
        return apiError('Database update failed.', 500);
      }

      // 6. Real-time broadcast for React refresh
      try {
        const { broadcastUpdate } = await import('@/lib/sse');
        broadcastUpdate('PROFILE_PHOTO_UPDATED', { roll_no, student_id: studentId });
      } catch (e) {
        logger.warn('SSE broadcast failed (non-fatal):', e.message);
      }

    } else {
      // Remove picture action
      try {
        const existing = await db.query.studentImages.findFirst({
          where: eq(studentImages.student_id, studentId)
        });

        if (existing?.pfp) {
          await storage.delete(existing.pfp).catch(err => {
            logger.error("Storage deletion warning:", err);
          });
        }

        await db.delete(studentImages).where(eq(studentImages.student_id, studentId));

        // 6. Real-time broadcast for React refresh
        try {
          const { broadcastUpdate } = await import('@/lib/sse');
          broadcastUpdate('PROFILE_PHOTO_REMOVED', { roll_no, student_id: studentId });
        } catch (e) {
          logger.warn('SSE broadcast failed (non-fatal):', e.message);
        }
      } catch (dbError) {
        logger.error("Database deletion failed for student pfp:", dbError);
        return apiError('Database update failed.', 500);
      }
    }

    return apiResponse({ success: true });
  } catch (err) {
    logger.error("Unexpected photo upload route error:", err);
    return apiError('Unexpected server error.', 500);
  }
}
