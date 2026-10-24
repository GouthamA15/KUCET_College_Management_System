import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { CoordinatorAssignmentService } from '@/services/identity/CoordinatorAssignmentService';
import { z } from 'zod';

const assignCoordinatorSchema = z.object({
  staff_account_id: z.coerce.number().int().positive('Valid staff account is required'),
  coordinator_type: z.string().trim().default('FIRST_YEAR'),
  academic_year: z.string().regex(/^\d{4}-\d{2}$/, 'Academic year must be in format YYYY-YY'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in format YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in format YYYY-MM-DD').optional().nullable(),
});

export const GET = wrapHandler({
  auth: 'admin',
  handler: async (req) => {
    const { searchParams } = new URL(req.url);
    const coordinatorType = searchParams.get('type') || 'FIRST_YEAR';
    const includeInactive = searchParams.get('includeInactive') !== 'false';

    const assignments = await CoordinatorAssignmentService.getCoordinatorAssignments({
      coordinatorType,
      includeInactive,
    });

    return apiResponse({
      success: true,
      data: assignments,
    });
  },
});

export const POST = wrapHandler({
  auth: 'admin',
  schema: assignCoordinatorSchema,
  handler: async (req, { user, data, ip, userAgent }) => {
    try {
      const result = await CoordinatorAssignmentService.assignCoordinator({
        staffAccountId: data.staff_account_id,
        coordinatorType: data.coordinator_type,
        academicYear: data.academic_year,
        startDate: data.start_date,
        endDate: data.end_date,
        assignedBy: user.id,
        ip,
        userAgent,
      });

      return apiResponse({
        success: true,
        message: 'First Year Coordinator assigned successfully',
        data: result,
      }, 201);
    } catch (err) {
      const status = err.status || 500;
      return apiError(err.message, status);
    }
  },
});
