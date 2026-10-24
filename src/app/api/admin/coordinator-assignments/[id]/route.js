import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { CoordinatorAssignmentService } from '@/services/identity/CoordinatorAssignmentService';
import { z } from 'zod';

const updateAssignmentSchema = z.object({
  action: z.enum(['REVOKE', 'UPDATE_DATES', 'RENEW']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in format YYYY-MM-DD').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in format YYYY-MM-DD').optional().nullable(),
  academic_year: z.string().regex(/^(\d{4}-\d{2}|\d{4}-\d{4})$/, 'Academic year must be in format YYYY-YY or YYYY-YYYY').optional(),
  reason: z.string().optional(),
});

export const PUT = wrapHandler({
  auth: 'admin',
  schema: updateAssignmentSchema,
  handler: async (req, { user, data, context, ip, userAgent }) => {
    const { id } = (await context?.params) || {};
    const assignmentId = Number(id);

    if (!assignmentId) {
      return apiError('Valid assignment ID is required in URL parameter', 400);
    }

    try {
      if (data.action === 'REVOKE') {
        const result = await CoordinatorAssignmentService.revokeCoordinator(assignmentId, {
          revokedBy: user.id,
          reason: data.reason,
          ip,
          userAgent,
        });
        return apiResponse({
          success: true,
          ...result,
        });
      }

      if (data.action === 'UPDATE_DATES') {
        if (!data.start_date) {
          return apiError('Start date is required for updating dates', 400);
        }
        const result = await CoordinatorAssignmentService.updateCoordinatorDates(assignmentId, {
          startDate: data.start_date,
          endDate: data.end_date,
          updatedBy: user.id,
          ip,
          userAgent,
        });
        return apiResponse({
          success: true,
          ...result,
        });
      }

      if (data.action === 'RENEW') {
        const result = await CoordinatorAssignmentService.renewCoordinator(assignmentId, {
          academicYear: data.academic_year,
          startDate: data.start_date,
          endDate: data.end_date,
          renewedBy: user.id,
          ip,
          userAgent,
        });
        return apiResponse({
          success: true,
          message: 'Coordinator renewed successfully',
          data: result,
        });
      }

      return apiError('Invalid action', 400);
    } catch (err) {
      const status = err.status || 500;
      return apiError(err.message, status);
    }
  },
});
