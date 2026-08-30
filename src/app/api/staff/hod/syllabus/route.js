import logger from '@/lib/logger';
import { db } from '@/db';
import { syllabusSubjects, syllabusStructure, academicDepartments, academicPrograms, auditLogs } from '@/db/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { ValidationService } from '@/services/ValidationService';
import { z } from 'zod';

export async function GET(req) {
  let user;
  try {
    user = await getAuthUser('hod');
    if (!user || (!((user.role === 'faculty' && user.is_hod) || user.role === 'admin'))) {
      return apiError('Unauthorized', 401);
    }

    if (!user.hod_department_code) {
      return apiError('Unauthorized - Active HOD Assignment Required', 403);
    }

    const { searchParams } = new URL(req.url);
    const semester = searchParams.get('semester');
    const branch = searchParams.get('branch'); // allow specific branch filter

    // Get authorized branches
    const programs = await db.select({ program_code: academicPrograms.program_code })
      .from(academicPrograms)
      .innerJoin(academicDepartments, eq(academicPrograms.department_id, academicDepartments.id))
      .where(eq(academicDepartments.department_code, user.hod_department_code));
    
    const authorizedBranches = Array.from(new Set([user.hod_department_code, ...programs.map(p => p.program_code)]));

    if (branch && !authorizedBranches.includes(branch)) {
      return apiError('Forbidden - Branch outside authorized scope', 403);
    }

    const init = searchParams.get('init') === 'true';

    // If init=true or missing filters, just return the authorizedBranches and empty data
    if (init || !branch || !semester) {
      return apiResponse({ data: [], authorizedBranches });
    }

    // Build conditions
    const conditions = [];
    conditions.push(eq(syllabusStructure.branch, branch));
    conditions.push(eq(syllabusStructure.semester, parseInt(semester)));

    // Fetch subjects for the branch
    const subjects = await db.select({
      subject_code: syllabusSubjects.subject_code,
      subject_name: syllabusSubjects.subject_name,
      subject_type: syllabusSubjects.subject_type,
      semester: syllabusStructure.semester,
      branch: syllabusStructure.branch,
      is_group: syllabusStructure.is_group,
      parent_group_code: syllabusStructure.parent_group_code
    })
    .from(syllabusStructure)
    .innerJoin(syllabusSubjects, eq(syllabusStructure.subject_code, syllabusSubjects.subject_code))
    .where(and(...conditions))
    .orderBy(asc(syllabusStructure.semester), asc(syllabusSubjects.subject_name));

    return apiResponse({ data: subjects, authorizedBranches });
  } catch (error) {
    logger.error({ err: error, user: user?.id, hodDept: user?.hod_department_code }, 'Syllabus API Error');
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser('hod');
    if (!user || (!((user.role === 'faculty' && user.is_hod) || user.role === 'admin'))) {
      return apiError('Unauthorized', 401);
    }

    if (!user.hod_department_code) {
      return apiError('Unauthorized - Active HOD Assignment Required', 403);
    }

    // Get authorized branches
    const programs = await db.select({ program_code: academicPrograms.program_code })
      .from(academicPrograms)
      .innerJoin(academicDepartments, eq(academicPrograms.department_id, academicDepartments.id))
      .where(eq(academicDepartments.department_code, user.hod_department_code));
    
    const authorizedBranches = Array.from(new Set([user.hod_department_code, ...programs.map(p => p.program_code)]));

    const json = await req.json();

    // --- ZERO TRUST VALIDATION ---
    const actionSchema = z.discriminatedUnion("action", [
      z.object({
        action: z.literal("ADD_SUBJECT"),
        subject: z.object({
          subject_code: z.string().trim().min(1).max(50).toUpperCase(),
          subject_name: z.string().trim().min(3).max(255),
          subject_type: z.preprocess(
            (v) => typeof v === 'string' ? v.toLowerCase() : v,
            z.enum(['theory', 'lab'])
          ),
          branch: z.string().trim().toUpperCase(),
          semester: z.preprocess(v => Number(v), z.number().int().min(1).max(8))
        })
      }),
      z.object({
        action: z.literal("EDIT_SUBJECT"),
        subject: z.object({
          subject_code: z.string().trim().min(1).max(50).toUpperCase(),
          subject_name: z.string().trim().min(3).max(255),
          subject_type: z.preprocess(
            (v) => typeof v === 'string' ? v.toLowerCase() : v,
            z.enum(['theory', 'lab'])
          )
        })
      }),
      z.object({
        action: z.literal("DELETE_MAPPING"),
        subject: z.object({
          subject_code: z.string().trim().toUpperCase(),
          branch: z.string().trim().toUpperCase(),
          semester: z.preprocess(v => Number(v), z.number().int().min(1).max(8))
        })
      })
    ]);

    const validatedData = actionSchema.parse(json);
    const { action, subject } = validatedData;

    if (action === 'ADD_SUBJECT') {
      const { subject_code, subject_name, subject_type, branch, semester, is_group, parent_group_code } = subject;
      
      if (!authorizedBranches.includes(branch)) {
         return apiError('Forbidden - Cannot add mapping outside authorized department branches', 403);
      }

      // Transaction to insert subject & mapping
      await db.transaction(async (tx) => {
          // 1. Insert/Update into syllabus_subjects
          await tx.insert(syllabusSubjects).values({
            subject_code,
            subject_name,
            subject_type
          }).onDuplicateKeyUpdate({
            set: { subject_name, subject_type }
          });

          // 2. Map to branch structure
          const existingMapping = await tx.select({ id: syllabusStructure.id })
            .from(syllabusStructure)
            .where(and(
              eq(syllabusStructure.branch, branch),
              eq(syllabusStructure.subject_code, subject_code),
              eq(syllabusStructure.semester, semester)
            ))
            .limit(1);
          
          if (existingMapping.length > 0) {
            // Already mapped
          } else {
            await tx.insert(syllabusStructure).values({
              branch,
              semester,
              subject_code,
              is_group: is_group ? 1 : 0,
              parent_group_code: parent_group_code || null
            });
          }
      });

      return apiResponse({ success: true, message: 'Subject added and mapped successfully' });
    }
    
    if (action === 'EDIT_SUBJECT') {
      const { subject_code, subject_name, subject_type } = subject;
      // Note: Editing subject global catalogue edits it for all branches!
      // In a real app we might warn. For now, it's allowed.
      await db.update(syllabusSubjects)
         .set({ subject_name, subject_type })
         .where(eq(syllabusSubjects.subject_code, subject_code));
         
      return apiResponse({ success: true, message: 'Subject updated successfully' });
    }

    if (action === 'DELETE_MAPPING') {
      const { subject_code, branch, semester } = subject;
      
      if (!authorizedBranches.includes(branch)) {
         return apiError('Forbidden - Cannot remove mapping outside authorized department branches', 403);
      }
      
      // If this is a group, ensure it has no children before deleting
      const childrenCheck = await db.select({ id: syllabusStructure.id })
        .from(syllabusStructure)
        .where(and(
          eq(syllabusStructure.branch, branch),
          eq(syllabusStructure.semester, semester),
          eq(syllabusStructure.parent_group_code, subject_code)
        )).limit(1);
        
      if (childrenCheck.length > 0) {
        return apiError('Cannot delete this elective group because it still contains subjects. Remove the subjects first.', 400);
      }

      // Logic-level Dependency Check (Can delete?)
      const { canDelete, reason } = await ValidationService.checkSubjectBranchDependencies(subject_code, branch);
      if (!canDelete) {
        return apiError(reason, 400);
      }

      // Only remove mapping for THIS branch and semester
      await db.delete(syllabusStructure)
        .where(and(
            eq(syllabusStructure.branch, branch),
            eq(syllabusStructure.semester, semester),
            eq(syllabusStructure.subject_code, subject_code)
        ));
        
      return apiResponse({ success: true, message: 'Subject mapping removed successfully' });
    }

    return apiError('Invalid action', 400);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    logger.error('HOD Syllabus POST Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
