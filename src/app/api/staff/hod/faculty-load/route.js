import { FacultyService } from '@/services/FacultyService';
import { apiError, wrapHandler } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export const GET = wrapHandler({
  auth: 'clerk',
  handler: async (req, { user }) => {
    if (user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    if (!user.branch) {
      return apiError('Branch not assigned to your profile. Please contact Admin.', 400);
    }

    // Use FacultyService to resolve academic year and load
    const systemYear = await FacultyService.getCurrentAcademicYear();
    const facultyLoad = await FacultyService.getFacultyLoad(systemYear);

    return { 
      data: facultyLoad,
      meta: { systemYear }
    };
  }
});
