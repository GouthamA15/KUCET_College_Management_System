import logger from '@/lib/logger';
import { db } from '@/db';
import { studentAchievements } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { storage } from '@/lib/providers';
import { STORAGE_FOLDERS } from '@/lib/storage-config';

export async function PUT(req, { params }) {
  const { id } = await params;
  const user = await getAuthUser('student');
  if (!user || !user.student_id) return apiError('Unauthorized', 401);

  if (!id) return apiError('Achievement ID is required', 400);

  try {
    // 1. Verify ownership
    const existing = await db.query.studentAchievements.findFirst({
      where: and(
        eq(studentAchievements.id, id),
        eq(studentAchievements.student_id, user.student_id)
      )
    });

    if (!existing) {
      return apiError('Achievement not found or unauthorized', 404);
    }

    const body = await req.json();
    const {
      achievement_type,
      title,
      program_name,
      issuing_organization,
      academic_year,
      achievement_date,
      start_date,
      end_date,
      achievement_level,
      recognition,
      description,
      certificate_base64,
      additional_data
    } = body;

    if (!achievement_type || !title || !academic_year) {
      return apiError('Missing required fields', 400);
    }

    let certificate_file_path = existing.certificate_file_path;
    let certificate_mime_type = existing.certificate_mime_type;
    let old_certificate_path = null;

    // 2. Upload new certificate if provided
    if (certificate_base64) {
      try {
        const mimeMatch = certificate_base64.match(/^data:(image\/\w+);base64,/);
        if (mimeMatch) {
          certificate_mime_type = mimeMatch[1];
        }
        const uploadRes = await storage.upload(certificate_base64, STORAGE_FOLDERS.STUDENTS_ACHIEVEMENTS);
        certificate_file_path = uploadRes?.path || uploadRes;
        
        // Mark old certificate for cleanup if the existing one is different
        if (existing.certificate_file_path && existing.certificate_file_path !== certificate_file_path) {
          old_certificate_path = existing.certificate_file_path;
        }
      } catch (uploadError) {
        logger.error('Failed to upload replacement certificate:', uploadError);
        return apiError(`Upload failed: ${uploadError.message}`, 500);
      }
    }

    const updateRecord = {
      achievement_type,
      title,
      program_name: program_name || null,
      issuing_organization: issuing_organization || null,
      academic_year,
      achievement_date: achievement_date || null,
      start_date: start_date || null,
      end_date: end_date || null,
      achievement_level: achievement_level || null,
      recognition: recognition || null,
      description: description || null,
      certificate_file_path,
      certificate_mime_type,
      additional_data: additional_data ? additional_data : null,
      updated_at: new Date()
    };

    // 3. Update database
    await db.update(studentAchievements)
      .set(updateRecord)
      .where(and(
        eq(studentAchievements.id, id),
        eq(studentAchievements.student_id, user.student_id)
      ));

    // 4. Cleanup old image if upload & db update succeeded
    if (old_certificate_path) {
      try {
        await storage.delete(old_certificate_path);
      } catch (cleanupError) {
        // Log but don't fail the request if cleanup fails
        logger.warn(`Failed to cleanup old certificate ${old_certificate_path}:`, cleanupError);
      }
    }

    // 5. Return updated record
    const updated = await db.query.studentAchievements.findFirst({
      where: eq(studentAchievements.id, id)
    });

    return apiResponse(updated);
  } catch (error) {
    logger.error('Error updating achievement:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const user = await getAuthUser('student');
  if (!user || !user.student_id) return apiError('Unauthorized', 401);

  if (!id) return apiError('Achievement ID is required', 400);

  try {
    // 1. Verify ownership & get the record
    const existing = await db.query.studentAchievements.findFirst({
      where: and(
        eq(studentAchievements.id, id),
        eq(studentAchievements.student_id, user.student_id)
      )
    });

    if (!existing) {
      return apiError('Achievement not found or unauthorized', 404);
    }

    const certificate_file_path = existing.certificate_file_path;

    // 2. Delete database record safely
    await db.delete(studentAchievements)
      .where(and(
        eq(studentAchievements.id, id),
        eq(studentAchievements.student_id, user.student_id)
      ));

    // 3. Storage cleanup
    if (certificate_file_path) {
      try {
        await storage.delete(certificate_file_path);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup deleted achievement certificate ${certificate_file_path}:`, cleanupError);
      }
    }

    return apiResponse({ success: true, message: 'Achievement deleted' });
  } catch (error) {
    logger.error('Error deleting achievement:', error);
    return apiError('Internal Server Error', 500);
  }
}
