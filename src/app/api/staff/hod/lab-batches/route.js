import { wrapHandler, apiError, apiResponse } from '@/lib/api-utils';
import { LabBatchAllocationService } from '@/services/academic/LabBatchAllocationService';
import { isAcademicScopeAllowed } from '@/lib/academic-authorization';
import { z } from 'zod';

const saveSchema = z.object({
  academic_year: z.string().min(4),
  branch: z.string().min(1),
  semester: z.number().int().min(1).max(8),
  subject_code: z.string().min(1),
  batch_1_name: z.string().trim().max(50).default('Batch 1'),
  batch_2_name: z.string().trim().max(50).default('Batch 2'),
  batch_1_student_ids: z.array(z.number().int().positive()).default([]),
  batch_2_student_ids: z.array(z.number().int().positive()).default([]),
  change_reason: z.string().trim().optional().nullable(),
  auto_publish: z.boolean().default(false)
});

const putSchema = z.object({
  allocation_id: z.number().int().positive(),
  action: z.enum(['PUBLISH']),
  change_reason: z.string().trim().optional().nullable()
});

export const GET = wrapHandler({
  auth: ['hod', 'faculty', 'admin'],
  handler: async (req, { user }) => {
    const isAuthorized = (user.role === 'faculty' && (user.is_hod || user.is_first_year_coordinator)) || user.role === 'admin';
    if (!isAuthorized) return apiError('Unauthorized', 403);

    const { searchParams } = new URL(req.url);
    const academic_year = searchParams.get('academic_year');
    const branch = searchParams.get('branch');
    const semesterStr = searchParams.get('semester');
    const subject_code = searchParams.get('subject_code');

    if (!academic_year || !branch || !semesterStr) {
      return apiError('academic_year, branch, and semester are required', 400);
    }

    const semester = parseInt(semesterStr, 10);
    if (isNaN(semester)) return apiError('Invalid semester', 400);

    if (!isAcademicScopeAllowed(user, { branch, semester })) {
      return apiError('Forbidden: Outside authorized academic scope', 403);
    }

    try {
      if (subject_code) {
        const details = await LabBatchAllocationService.getAllocation({
          academicYear: academic_year,
          branch,
          semester,
          subjectCode: subject_code
        });
        return apiResponse({ data: details });
      }

      const list = await LabBatchAllocationService.listCohortAllocations({
        academicYear: academic_year,
        branch,
        semester
      });
      return apiResponse({ data: list });
    } catch (err) {
      return apiError(err.message, 500);
    }
  }
});

export const POST = wrapHandler({
  auth: ['hod', 'faculty', 'admin'],
  handler: async (req, { user }) => {
    const isAuthorized = (user.role === 'faculty' && (user.is_hod || user.is_first_year_coordinator)) || user.role === 'admin';
    if (!isAuthorized) return apiError('Unauthorized', 403);

    const json = await req.json();
    const parsed = saveSchema.safeParse(json);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0]?.message || 'Invalid parameters', 400);
    }

    const data = parsed.data;
    if (!isAcademicScopeAllowed(user, { branch: data.branch, semester: data.semester })) {
      return apiError('Forbidden: Outside authorized academic scope', 403);
    }

    try {
      const saved = await LabBatchAllocationService.saveAllocation({
        academicYear: data.academic_year,
        branch: data.branch,
        semester: data.semester,
        subjectCode: data.subject_code,
        batch1Name: data.batch_1_name,
        batch2Name: data.batch_2_name,
        batch1StudentIds: data.batch_1_student_ids,
        batch2StudentIds: data.batch_2_student_ids,
        staffId: user.id,
        changeReason: data.change_reason,
        autoPublish: data.auto_publish
      });

      return apiResponse({
        success: true,
        message: data.auto_publish ? 'Lab batch allocation published successfully' : 'Lab batch allocation draft saved',
        data: saved
      });
    } catch (err) {
      return apiError(err.message, 400);
    }
  }
});

export const PUT = wrapHandler({
  auth: ['hod', 'faculty', 'admin'],
  handler: async (req, { user }) => {
    const isAuthorized = (user.role === 'faculty' && (user.is_hod || user.is_first_year_coordinator)) || user.role === 'admin';
    if (!isAuthorized) return apiError('Unauthorized', 403);

    const json = await req.json();
    const parsed = putSchema.safeParse(json);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0]?.message || 'Invalid parameters', 400);
    }

    const { allocation_id, action, change_reason } = parsed.data;

    try {
      if (action === 'PUBLISH') {
        const result = await LabBatchAllocationService.publishAllocation({
          allocationId: allocation_id,
          staffId: user.id,
          reason: change_reason || 'Published by HOD'
        });
        return apiResponse(result);
      }
      return apiError('Unsupported action', 400);
    } catch (err) {
      return apiError(err.message, 400);
    }
  }
});
