import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { IDCardAuthorizationService } from '@/services/identity/IDCardAuthorizationService';
import { IDCardDataService } from '@/services/identity/IDCardDataService';
import logger from '@/lib/logger';

export const POST = wrapHandler({
  auth: ['staff', 'admin'],
  handler: async (req, { user, ip, userAgent }) => {
    // 1. RBAC Check
    if (!IDCardAuthorizationService.canManagePhotos(user)) {
      return apiError('Forbidden: You do not have permission to manage or upload ID card photos', 403);
    }

    let rollNo = null;
    let fileBuffer = null;
    let mimeType = 'image/webp';
    let extension = 'webp';

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      rollNo = formData.get('rollNo');
      const file = formData.get('file');

      if (!file || typeof file === 'string') {
        return apiError('Valid image file is required', 400);
      }

      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      mimeType = file.type || 'image/jpeg';
      const nameParts = (file.name || '').split('.');
      if (nameParts.length > 1) {
        extension = nameParts.pop().toLowerCase();
      }
    } else {
      const body = await req.json();
      rollNo = body.rollNo;
      const base64Data = body.imageBase64;

      if (!base64Data) {
        return apiError('imageBase64 string is required', 400);
      }

      // Strip potential Data URI header
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        fileBuffer = Buffer.from(matches[2], 'base64');
        extension = mimeType.split('/')[1] || 'webp';
      } else {
        fileBuffer = Buffer.from(base64Data, 'base64');
      }
    }

    if (!rollNo || !fileBuffer || fileBuffer.length === 0) {
      return apiError('Roll number and valid image data are required', 400);
    }

    // 2. Locate Student and Enforce Branch Scope
    const student = await IDCardDataService.getStudentRecordByRollNo(rollNo);
    if (!student) {
      return apiError(`Student with roll number ${rollNo} not found`, 404);
    }

    if (!IDCardAuthorizationService.isBranchAllowed(user, student.branch)) {
      return apiError(`Forbidden: You do not have permission for branch ${student.branch}`, 403);
    }

    try {
      const result = await IDCardDataService.updateStudentPhoto({
        rollNo,
        fileBuffer,
        mimeType,
        extension,
        updatedByStaffId: user.id || user.staffId,
        ip,
        userAgent,
      });

      return apiResponse({
        success: true,
        message: 'Student photo updated successfully',
        ...result,
      });
    } catch (err) {
      logger.error({ rollNo, err: err.message }, '[ID_CARD_PHOTO_UPLOAD_FAILED]');
      return apiError(`Failed to update student photo: ${err.message}`, 500);
    }
  },
});
