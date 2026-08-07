import { getAuthUser, apiResponse, apiError } from '@/lib/api-utils';
import { ArchiveService } from '@/services/archive/ArchiveService';
import logger from '@/lib/logger';

export async function POST(req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized: Admin access required', 401);

    const body = await req.json().catch(() => ({}));
    const { type = 'SEMESTER', branch, semester, academic_year, graduation_year, student_ids = [], reason } = body;

    const archived_by = user.email || user.name || 'ADMIN';

    if (type === 'SEMESTER') {
      if (!branch || !semester || !academic_year) {
        return apiError('Missing required parameters: branch, semester, and academic_year are required.', 400);
      }
      const result = await ArchiveService.runSemesterArchive({
        branch,
        semester: Number(semester),
        academic_year,
        archived_by,
        reason: reason || 'Semester closed by admin',
      });
      return apiResponse(result);
    }

    if (type === 'ALUMNI') {
      const result = await ArchiveService.runAlumniArchive({
        graduation_year,
        branch,
        student_ids,
        archived_by,
        reason: reason || 'Alumni graduation archival',
      });
      return apiResponse(result);
    }

    return apiError('Invalid archive job type. Must be SEMESTER or ALUMNI.', 400);
  } catch (error) {
    logger.error({ err: error.message }, '[API_ADMIN_ARCHIVE_RUN_ERROR]');
    return apiError(error.message || 'Archive job execution failed', 500);
  }
}
