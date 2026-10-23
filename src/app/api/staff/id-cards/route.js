import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { IDCardAuthorizationService } from '@/services/identity/IDCardAuthorizationService';
import { IDCardDataService } from '@/services/identity/IDCardDataService';

export const GET = wrapHandler({
  auth: ['staff', 'admin'],
  handler: async (req, { user }) => {
    // 1. RBAC Check
    if (!IDCardAuthorizationService.canView(user)) {
      return apiError('Forbidden: You do not have permission to view ID card records', 403);
    }

    // 2. Departmental / Branch Scoping
    const allowedBranches = IDCardAuthorizationService.getAllowedBranches(user);

    // 3. Extract Query Parameters
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get('branch') || 'ALL';
    const batch = searchParams.get('batch') || 'ALL';
    const search = searchParams.get('search') || '';
    const photoStatus = searchParams.get('photoStatus') || 'ALL';
    const page = searchParams.get('page') || 1;
    const limit = searchParams.get('limit') || 20;

    // 4. Branch permission enforcement
    if (branch !== 'ALL' && !IDCardAuthorizationService.isBranchAllowed(user, branch)) {
      return apiError(`Forbidden: You do not have permission to access branch ${branch}`, 403);
    }

    // 5. Query Authoritative Dataset
    const result = await IDCardDataService.getStudentRecords({
      branch,
      batch,
      search,
      photoStatus,
      page,
      limit,
      allowedBranches,
    });

    return apiResponse({
      success: true,
      ...result,
      userPermissions: {
        canView: true,
        canPreview: IDCardAuthorizationService.canPreview(user),
        canGenerate: IDCardAuthorizationService.canGenerate(user),
        canBulkGenerate: IDCardAuthorizationService.canBulkGenerate(user),
        canManagePhotos: IDCardAuthorizationService.canManagePhotos(user),
      },
    });
  },
});
