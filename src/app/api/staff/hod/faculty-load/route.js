import { FacultyService } from '@/services/FacultyService';
import { apiError, wrapHandler } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export const GET = wrapHandler({
  auth: 'hod',
  handler: async (req, { user }) => {
    if (!user || (!((user.role === 'faculty' && user.is_hod) || user.role === 'admin'))) {
      return apiError('Unauthorized', 401);
    }

    const requestedBranch = req.nextUrl?.searchParams?.get('branch');
    const targetBranch = requestedBranch || user.branch || user.hod_department_code;

    const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
    if (user.role !== 'admin' && requestedBranch && authorizedBranches.length > 0 && !authorizedBranches.includes(requestedBranch)) {
      return apiError(`Forbidden - Not authorized for ${requestedBranch} branch.`, 403);
    }

    if (!targetBranch && user.role !== 'admin') {
      return apiError('Branch not assigned to your profile. Please contact Admin.', 400);
    }

    // Use FacultyService to resolve academic year and load
    const systemYear = await FacultyService.getCurrentAcademicYear();
    const branchFilter = user.role === 'admin' ? (requestedBranch || null) : targetBranch;
    const facultyLoad = await FacultyService.getFacultyLoad(systemYear, branchFilter);

    return { 
      data: facultyLoad,
      meta: { systemYear, branch: branchFilter }
    };
  }
});
