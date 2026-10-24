import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { IDCardAuthorizationService } from '@/services/identity/IDCardAuthorizationService';
import { IDCardDataService } from '@/services/identity/IDCardDataService';

export const GET = wrapHandler({
  auth: ['staff', 'admin'],
  handler: async (req, { user, context }) => {
    // 1. RBAC Check
    if (!IDCardAuthorizationService.canPreview(user)) {
      return apiError('Forbidden: You do not have permission to preview ID cards', 403);
    }

    const { rollno } = (await context?.params) || {};
    if (!rollno) {
      return apiError('Roll number is required', 400);
    }

    // 2. Fetch Student Card Data
    const student = await IDCardDataService.getStudentRecordByRollNo(rollno);
    if (!student) {
      return apiError(`Student with roll number ${rollno} not found`, 404);
    }

    // 3. Departmental Scoping Check
    if (!IDCardAuthorizationService.isBranchAllowed(user, student.branch)) {
      return apiError(`Forbidden: You do not have permission to view students from branch ${student.branch}`, 403);
    }

    return apiResponse({
      success: true,
      student: {
        ...student,
        signatureVerified: true,
      },
    });
  },
});
