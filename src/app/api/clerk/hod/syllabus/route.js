import logger from '@/lib/logger';
import { db } from '@/db';
import { syllabusSubjects, syllabusStructure } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { ValidationService } from '@/services/ValidationService';
import { z } from 'zod';

export async function GET(req) {
  let user;
  try {
    user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    if (!user.branch) {
      return apiError('Branch not assigned to your profile', 400);
    }

    const { searchParams } = new URL(req.url);
    const semester = searchParams.get('semester');

    // Build conditions
    const conditions = [eq(syllabusStructure.branch, user.branch)];
    if (semester) {
      conditions.push(eq(syllabusStructure.semester, parseInt(semester)));
    }

    // Fetch subjects for the branch
    const subjects = await db.select({
      subject_code: syllabusSubjects.subject_code,
      subject_name: syllabusSubjects.subject_name,
      subject_type: syllabusSubjects.subject_type,
      semester: syllabusStructure.semester,
      is_group: syllabusStructure.is_group,
      parent_group_code: syllabusStructure.parent_group_code
    })
    .from(syllabusStructure)
    .innerJoin(syllabusSubjects, eq(syllabusStructure.subject_code, syllabusSubjects.subject_code))
    .where(and(...conditions))
    .orderBy(asc(syllabusStructure.semester), asc(syllabusSubjects.subject_name));

    return apiResponse({ data: subjects });
  } catch (error) {
    logger.error({ err: error, user: user?.id, branch: user?.branch }, 'Syllabus API Error');
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

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
          semester: z.preprocess(v => Number(v), z.number().int().min(1).max(8))
        })
      }),
      z.object({
        action: z.literal("DELETE_SUBJECT"),
        subject: z.object({
          subject_code: z.string().trim().toUpperCase()
        })
      })
    ]);

    const validatedData = actionSchema.parse(json);
    const { action, subject } = validatedData;

    if (action === 'ADD_SUBJECT') {
      const { subject_code, subject_name, subject_type, semester } = subject;
      
      // 1. Insert/Update into syllabus_subjects
      await db.insert(syllabusSubjects).values({
        subject_code,
        subject_name,
        subject_type
      }).onDuplicateKeyUpdate({
        set: { subject_name, subject_type }
      });

      // 2. Map to branch structure
      await db.insert(syllabusStructure).values({
        branch: user.branch,
        semester: semester,
        subject_code
      }).onDuplicateKeyUpdate({
        set: { semester: semester }
      });

      return apiResponse({ success: true, message: 'Subject added/updated successfully' });
    }

    if (action === 'DELETE_SUBJECT') {
      const { subject_code } = subject;
      
      // Logic-level Dependency Check
      const { canDelete, reason } = await ValidationService.checkSubjectBranchDependencies(subject_code, user.branch);
      if (!canDelete) {
        return apiError(reason, 400);
      }

      // Only remove mapping for THIS branch
      await db.delete(syllabusStructure)
        .where(and(
            eq(syllabusStructure.branch, user.branch),
            eq(syllabusStructure.subject_code, subject_code)
        ));
      return apiResponse({ success: true, message: 'Subject mapping removed' });
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
