import logger from '@/lib/logger';
import { db } from '@/db';
import { studentAchievements } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { storage } from '@/lib/providers';
import { STORAGE_FOLDERS } from '@/lib/storage-config';

export async function GET() {
  const user = await getAuthUser('student');
  if (!user || !user.student_id) return apiError('Unauthorized', 401);

  try {
    const achievements = await db.query.studentAchievements.findMany({
      where: eq(studentAchievements.student_id, user.student_id),
      orderBy: [desc(studentAchievements.created_at)]
    });
    return apiResponse(achievements);
  } catch (error) {
    logger.error('Error fetching achievements:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(req) {
  const user = await getAuthUser('student');
  if (!user || !user.student_id) return apiError('Unauthorized', 401);

  try {
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

    if (!achievement_type || !title || !academic_year || !certificate_base64) {
      return apiError('Missing required fields', 400);
    }

    // Upload certificate
    let certificate_file_path = null;
    let certificate_mime_type = null;
    try {
      const mimeMatch = certificate_base64.match(/^data:(image\/\w+);base64,/);
      if (mimeMatch) {
        certificate_mime_type = mimeMatch[1];
      }
      const uploadRes = await storage.upload(certificate_base64, STORAGE_FOLDERS.STUDENTS_ACHIEVEMENTS);
      certificate_file_path = uploadRes?.path || uploadRes;
    } catch (uploadError) {
      logger.error('Failed to upload certificate:', uploadError);
      return apiError(`Upload failed: ${uploadError.message}`, 500);
    }

    const newRecord = {
      student_id: user.student_id,
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
      additional_data: additional_data ? additional_data : null
    };

    const [insertRes] = await db.insert(studentAchievements).values(newRecord);
    const insertId = insertRes.insertId;

    const inserted = await db.query.studentAchievements.findFirst({
      where: eq(studentAchievements.id, insertId)
    });

    return apiResponse(inserted);
  } catch (error) {
    logger.error('Error creating achievement:', error);
    return apiError('Internal Server Error', 500);
  }
}

