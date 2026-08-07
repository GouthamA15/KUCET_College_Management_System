import { getAuthUser, apiResponse, apiError } from '@/lib/api-utils';
import { ArchiveRestoreService } from '@/services/archive/ArchiveRestoreService';
import logger from '@/lib/logger';

export async function POST(req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized: Admin access required', 401);

    const body = await req.json().catch(() => ({}));
    const { action = 'RESTORE_STUDENT', archive_student_id, roll_no, branch, semester, academic_year, reason } = body;
    const restored_by = user.email || user.name || 'ADMIN';

    if (action === 'PREVIEW') {
      const preview = await ArchiveRestoreService.previewRestore({
        type: body.type || (archive_student_id ? 'STUDENT' : 'SEMESTER'),
        archive_student_id,
        roll_no,
        branch,
        semester,
        academic_year,
      });
      return apiResponse(preview);
    }

    if (action === 'RESTORE_STUDENT') {
      if (!archive_student_id) {
        return apiError('Missing required parameter: archive_student_id', 400);
      }
      const result = await ArchiveRestoreService.restoreStudent({
        archive_student_id: Number(archive_student_id),
        restored_by,
        reason: reason || 'Manual admin restoration',
      });
      return apiResponse(result);
    }

    if (action === 'RESTORE_SEMESTER') {
      if (!branch || !semester || !academic_year) {
        return apiError('Missing required parameters: branch, semester, academic_year', 400);
      }
      const result = await ArchiveRestoreService.restoreAcademicRecords({
        branch,
        semester: Number(semester),
        academic_year,
        restored_by,
        reason: reason || 'Manual semester restoration',
      });
      return apiResponse(result);
    }

    return apiError('Invalid restore action specified.', 400);
  } catch (error) {
    logger.error({ err: error.message }, '[API_ADMIN_ARCHIVE_RESTORE_ERROR]');
    return apiError(error.message || 'Archive restoration failed', 500);
  }
}
