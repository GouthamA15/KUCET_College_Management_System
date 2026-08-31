import logger from '@/lib/logger';
import { db } from '@/db';
import { syllabusSubjects, syllabusStructure, electiveGroups, electiveGroupSubjects, academicDepartments, academicPrograms } from '@/db/schema';
import { eq, and, asc, or, like, sql, inArray } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { ValidationService } from '@/services/ValidationService';
import { z } from 'zod';

// ─── Auth helpers ────────────────────────────────────────────────────────────

async function getHodUserAndBranches(role = 'hod') {
  const user = await getAuthUser(role);
  if (!user || (!((user.role === 'faculty' && user.is_hod) || user.role === 'admin'))) {
    return { error: 'Unauthorized', status: 401 };
  }
  if (!user.hod_department_code) {
    return { error: 'Unauthorized - Active HOD Assignment Required', status: 403 };
  }
  const programs = await db.select({ program_code: academicPrograms.program_code })
    .from(academicPrograms)
    .innerJoin(academicDepartments, eq(academicPrograms.department_id, academicDepartments.id))
    .where(eq(academicDepartments.department_code, user.hod_department_code));
  const authorizedBranches = Array.from(new Set([user.hod_department_code, ...programs.map(p => p.program_code)]));
  return { authorizedBranches };
}

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(req) {
  try {
    const { authorizedBranches, error, status } = await getHodUserAndBranches();
    if (error) return apiError(error, status);

    const { searchParams } = new URL(req.url);
    const semester = searchParams.get('semester');
    const branch = searchParams.get('branch');
    const init = searchParams.get('init') === 'true';

    // Search subjects in global catalogue
    const searchQ = searchParams.get('search');
    if (searchQ !== null) {
      const query = searchQ.trim();
      if (!query || query.length < 2) {
        return apiResponse({ subjects: [] });
      }
      const results = await db.select({
        subject_code: syllabusSubjects.subject_code,
        subject_name: syllabusSubjects.subject_name,
        subject_type: syllabusSubjects.subject_type,
      })
      .from(syllabusSubjects)
      .where(or(
        like(syllabusSubjects.subject_code, `%${query}%`),
        like(syllabusSubjects.subject_name, `%${query}%`)
      ))
      .orderBy(asc(syllabusSubjects.subject_name))
      .limit(20);
      return apiResponse({ subjects: results });
    }

    if (branch && !authorizedBranches.includes(branch)) {
      return apiError('Forbidden - Branch outside authorized scope', 403);
    }

    if (init || !branch || !semester) {
      return apiResponse({ coreSubjects: [], electiveGroups: [], authorizedBranches });
    }

    const semInt = parseInt(semester);

    // 1. Core subjects (not in any elective group, not a group themselves)
    const coreSubjects = await db.select({
      subject_code: syllabusSubjects.subject_code,
      subject_name: syllabusSubjects.subject_name,
      subject_type: syllabusSubjects.subject_type,
      structure_id: syllabusStructure.id,
    })
    .from(syllabusStructure)
    .innerJoin(syllabusSubjects, eq(syllabusStructure.subject_code, syllabusSubjects.subject_code))
    .where(and(
      eq(syllabusStructure.branch, branch),
      eq(syllabusStructure.semester, semInt),
      eq(syllabusStructure.is_group, false),
      sql`${syllabusStructure.parent_group_code} IS NULL`
    ))
    .orderBy(asc(syllabusSubjects.subject_name));

    // 2. All elective groups for this branch+semester
    const groups = await db.select()
      .from(electiveGroups)
      .where(and(
        eq(electiveGroups.branch, branch),
        eq(electiveGroups.semester, semInt),
        eq(electiveGroups.is_active, true)
      ))
      .orderBy(asc(electiveGroups.display_order), asc(electiveGroups.group_code));

    // 3. Fetch subjects for all groups
    const groupIds = groups.map(g => g.id);
    let groupSubjects = [];
    if (groupIds.length > 0) {
      groupSubjects = await db.select({
        group_id: electiveGroupSubjects.group_id,
        subject_code: syllabusSubjects.subject_code,
        subject_name: syllabusSubjects.subject_name,
        subject_type: syllabusSubjects.subject_type,
        egs_id: electiveGroupSubjects.id,
        display_order: electiveGroupSubjects.display_order,
      })
      .from(electiveGroupSubjects)
      .innerJoin(syllabusSubjects, eq(electiveGroupSubjects.subject_code, syllabusSubjects.subject_code))
      .where(inArray(electiveGroupSubjects.group_id, groupIds))
      .orderBy(asc(electiveGroupSubjects.display_order), asc(syllabusSubjects.subject_name));
    }

    // 4. Attach subjects to groups and split by type
    const subjectsByGroup = {};
    for (const s of groupSubjects) {
      if (!subjectsByGroup[s.group_id]) subjectsByGroup[s.group_id] = [];
      subjectsByGroup[s.group_id].push(s);
    }
    const enrichedGroups = groups.map(g => ({
      ...g,
      subjects: subjectsByGroup[g.id] || []
    }));

    const professionalElectives = enrichedGroups.filter(g => g.group_type === 'PROFESSIONAL_ELECTIVE');
    const openElectives = enrichedGroups.filter(g => g.group_type === 'OPEN_ELECTIVE');
    const otherGroups = enrichedGroups.filter(g => g.group_type !== 'PROFESSIONAL_ELECTIVE' && g.group_type !== 'OPEN_ELECTIVE');

    return apiResponse({
      coreSubjects,
      professionalElectives,
      openElectives,
      otherGroups,
      authorizedBranches,
    });

  } catch (error) {
    logger.error({ err: error }, 'Syllabus GET Error');
    return apiError('Internal Server Error', 500);
  }
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(req) {
  try {
    const { authorizedBranches, error, status } = await getHodUserAndBranches();
    if (error) return apiError(error, status);

    const json = await req.json();

    const actionSchema = z.discriminatedUnion('action', [

      // --- Add core subject ---
      z.object({
        action: z.literal('ADD_CORE_SUBJECT'),
        subject: z.object({
          subject_code: z.string().trim().min(1).max(50).toUpperCase(),
          subject_name: z.string().trim().min(2).max(255),
          subject_type: z.preprocess(v => typeof v === 'string' ? v.toLowerCase() : v, z.enum(['theory', 'lab'])),
          branch: z.string().trim().toUpperCase(),
          semester: z.preprocess(v => Number(v), z.number().int().min(1).max(8)),
        })
      }),

      // --- Create elective group ---
      z.object({
        action: z.literal('ADD_ELECTIVE_GROUP'),
        group: z.object({
          branch: z.string().trim().toUpperCase(),
          semester: z.preprocess(v => Number(v), z.number().int().min(1).max(8)),
          group_code: z.string().trim().min(1).max(50).toUpperCase(),
          group_name: z.string().trim().min(2).max(255),
          group_type: z.enum(['PROFESSIONAL_ELECTIVE', 'OPEN_ELECTIVE', 'MANDATORY_NON_CREDIT', 'OTHER']),
          subject_mode: z.enum(['theory', 'lab']).default('theory'),
          sequence_num: z.preprocess(v => Number(v), z.number().int().min(0).max(20)).default(0),
          display_order: z.preprocess(v => Number(v), z.number().int().min(0)).default(0),
        })
      }),

      // --- Add subject to elective group ---
      z.object({
        action: z.literal('ADD_ELECTIVE_SUBJECT'),
        payload: z.object({
          group_id: z.preprocess(v => Number(v), z.number().int().positive()),
          branch: z.string().trim().toUpperCase(),
          subject_code: z.string().trim().min(1).max(50).toUpperCase(),
          subject_name: z.string().trim().min(2).max(255),
          subject_type: z.preprocess(v => typeof v === 'string' ? v.toLowerCase() : v, z.enum(['theory', 'lab'])),
        })
      }),

      // --- Edit a core subject's global details ---
      z.object({
        action: z.literal('EDIT_SUBJECT'),
        subject: z.object({
          subject_code: z.string().trim().min(1).max(50).toUpperCase(),
          subject_name: z.string().trim().min(2).max(255),
          subject_type: z.preprocess(v => typeof v === 'string' ? v.toLowerCase() : v, z.enum(['theory', 'lab'])),
        })
      }),

      // --- Edit an elective group ---
      z.object({
        action: z.literal('EDIT_ELECTIVE_GROUP'),
        group: z.object({
          id: z.preprocess(v => Number(v), z.number().int().positive()),
          branch: z.string().trim().toUpperCase(),
          group_name: z.string().trim().min(2).max(255),
          subject_mode: z.enum(['theory', 'lab']).optional(),
          display_order: z.preprocess(v => Number(v), z.number().int().min(0)).optional(),
        })
      }),

      // --- Remove core subject mapping from branch/semester ---
      z.object({
        action: z.literal('DELETE_CORE_MAPPING'),
        subject: z.object({
          subject_code: z.string().trim().toUpperCase(),
          branch: z.string().trim().toUpperCase(),
          semester: z.preprocess(v => Number(v), z.number().int().min(1).max(8)),
        })
      }),

      // --- Delete entire elective group (if no subjects remain) ---
      z.object({
        action: z.literal('DELETE_ELECTIVE_GROUP'),
        group: z.object({
          id: z.preprocess(v => Number(v), z.number().int().positive()),
          branch: z.string().trim().toUpperCase(),
        })
      }),

      // --- Remove a subject from an elective group ---
      z.object({
        action: z.literal('REMOVE_FROM_GROUP'),
        payload: z.object({
          egs_id: z.preprocess(v => Number(v), z.number().int().positive()),
          branch: z.string().trim().toUpperCase(),
          subject_code: z.string().trim().toUpperCase(),
        })
      }),
    ]);

    const validated = actionSchema.parse(json);
    const { action } = validated;

    // ─── ADD_CORE_SUBJECT ───────────────────────────────────────────────
    if (action === 'ADD_CORE_SUBJECT') {
      const { subject_code, subject_name, subject_type, branch, semester } = validated.subject;
      if (!authorizedBranches.includes(branch)) return apiError('Forbidden - Outside authorized branches', 403);

      await db.transaction(async (tx) => {
        await tx.insert(syllabusSubjects).values({ subject_code, subject_name, subject_type })
          .onDuplicateKeyUpdate({ set: { subject_name, subject_type } });
        const existing = await tx.select({ id: syllabusStructure.id }).from(syllabusStructure)
          .where(and(eq(syllabusStructure.branch, branch), eq(syllabusStructure.semester, semester), eq(syllabusStructure.subject_code, subject_code)))
          .limit(1);
        if (!existing.length) {
          await tx.insert(syllabusStructure).values({ branch, semester, subject_code, is_group: false, parent_group_code: null });
        }
      });
      return apiResponse({ success: true, message: 'Subject added successfully' });
    }

    // ─── ADD_ELECTIVE_GROUP ─────────────────────────────────────────────
    if (action === 'ADD_ELECTIVE_GROUP') {
      const { branch, semester, group_code, group_name, group_type, subject_mode, sequence_num, display_order } = validated.group;
      if (!authorizedBranches.includes(branch)) return apiError('Forbidden - Outside authorized branches', 403);
      // PE/OE validation: must be sem 5+
      if (['PROFESSIONAL_ELECTIVE', 'OPEN_ELECTIVE'].includes(group_type) && semester < 5) {
        return apiError('Professional and Open Electives are only valid from Semester 5 onwards', 400);
      }
      const existing = await db.select({ id: electiveGroups.id }).from(electiveGroups)
        .where(and(eq(electiveGroups.branch, branch), eq(electiveGroups.semester, semester), eq(electiveGroups.group_code, group_code)))
        .limit(1);
      if (existing.length) return apiError(`Elective group ${group_code} already exists for ${branch} Semester ${semester}`, 409);

      const result = await db.insert(electiveGroups).values({ branch, semester, group_code, group_name, group_type, subject_mode, sequence_num, display_order });
      return apiResponse({ success: true, id: result[0].insertId, message: 'Elective group created successfully' });
    }

    // ─── ADD_ELECTIVE_SUBJECT ───────────────────────────────────────────
    if (action === 'ADD_ELECTIVE_SUBJECT') {
      const { group_id, branch, subject_code, subject_name, subject_type } = validated.payload;
      if (!authorizedBranches.includes(branch)) return apiError('Forbidden - Outside authorized branches', 403);
      // Verify group belongs to authorized branch
      const group = await db.select().from(electiveGroups).where(eq(electiveGroups.id, group_id)).limit(1);
      if (!group.length) return apiError('Elective group not found', 404);
      if (!authorizedBranches.includes(group[0].branch)) return apiError('Forbidden - Group belongs to unauthorized branch', 403);

      // Check for duplicate before starting transaction
      const existing = await db.select({ id: electiveGroupSubjects.id }).from(electiveGroupSubjects)
        .where(and(eq(electiveGroupSubjects.group_id, group_id), eq(electiveGroupSubjects.subject_code, subject_code)))
        .limit(1);
      if (existing.length) {
        return apiError(`Subject ${subject_code} already exists in this elective group`, 409);
      }

      await db.transaction(async (tx) => {
        // Upsert the subject in global catalogue
        await tx.insert(syllabusSubjects).values({ subject_code, subject_name, subject_type })
          .onDuplicateKeyUpdate({ set: { subject_name, subject_type } });
        // Add to group
        await tx.insert(electiveGroupSubjects).values({ group_id, subject_code, display_order: 0 });
      });
      return apiResponse({ success: true, message: 'Subject added to elective group' });
    }

    // ─── EDIT_SUBJECT ───────────────────────────────────────────────────
    if (action === 'EDIT_SUBJECT') {
      const { subject_code, subject_name, subject_type } = validated.subject;
      await db.update(syllabusSubjects).set({ subject_name, subject_type }).where(eq(syllabusSubjects.subject_code, subject_code));
      return apiResponse({ success: true, message: 'Subject updated' });
    }

    // ─── EDIT_ELECTIVE_GROUP ────────────────────────────────────────────
    if (action === 'EDIT_ELECTIVE_GROUP') {
      const { id, branch, group_name, subject_mode, display_order } = validated.group;
      if (!authorizedBranches.includes(branch)) return apiError('Forbidden', 403);
      const updates = { group_name };
      if (subject_mode !== undefined) updates.subject_mode = subject_mode;
      if (display_order !== undefined) updates.display_order = display_order;
      await db.update(electiveGroups).set(updates).where(and(eq(electiveGroups.id, id), eq(electiveGroups.branch, branch)));
      return apiResponse({ success: true, message: 'Elective group updated' });
    }

    // ─── DELETE_CORE_MAPPING ────────────────────────────────────────────
    if (action === 'DELETE_CORE_MAPPING') {
      const { subject_code, branch, semester } = validated.subject;
      if (!authorizedBranches.includes(branch)) return apiError('Forbidden', 403);
      const { canDelete, reason } = await ValidationService.checkSubjectBranchDependencies(subject_code, branch);
      if (!canDelete) return apiError(reason, 400);
      await db.delete(syllabusStructure).where(and(
        eq(syllabusStructure.branch, branch),
        eq(syllabusStructure.semester, semester),
        eq(syllabusStructure.subject_code, subject_code)
      ));
      return apiResponse({ success: true, message: 'Subject mapping removed' });
    }

    // ─── DELETE_ELECTIVE_GROUP ──────────────────────────────────────────
    if (action === 'DELETE_ELECTIVE_GROUP') {
      const { id, branch } = validated.group;
      if (!authorizedBranches.includes(branch)) return apiError('Forbidden', 403);
      const subjectsInGroup = await db.select({ id: electiveGroupSubjects.id })
        .from(electiveGroupSubjects).where(eq(electiveGroupSubjects.group_id, id)).limit(1);
      if (subjectsInGroup.length) {
        return apiError('Cannot delete this elective group — it still has subjects mapped to it. Remove all subjects first.', 400);
      }
      await db.delete(electiveGroups).where(and(eq(electiveGroups.id, id), eq(electiveGroups.branch, branch)));
      return apiResponse({ success: true, message: 'Elective group deleted' });
    }

    // ─── REMOVE_FROM_GROUP ──────────────────────────────────────────────
    if (action === 'REMOVE_FROM_GROUP') {
      const { egs_id, branch, subject_code } = validated.payload;
      if (!authorizedBranches.includes(branch)) return apiError('Forbidden', 403);

      const mapping = await db.select({
        id: electiveGroupSubjects.id,
        group_id: electiveGroupSubjects.group_id,
        branch: electiveGroups.branch
      })
      .from(electiveGroupSubjects)
      .innerJoin(electiveGroups, eq(electiveGroupSubjects.group_id, electiveGroups.id))
      .where(eq(electiveGroupSubjects.id, egs_id))
      .limit(1);

      if (!mapping.length) {
        return apiError('Elective subject mapping not found', 404);
      }

      if (!authorizedBranches.includes(mapping[0].branch)) {
        return apiError('Forbidden - Outside authorized branches', 403);
      }

      await db.delete(electiveGroupSubjects).where(eq(electiveGroupSubjects.id, egs_id));
      return apiResponse({ success: true, message: `${subject_code} removed from group` });
    }

    return apiError('Invalid action', 400);
  } catch (error) {
    if (error?.constructor?.name === 'ZodError') {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    logger.error({ err: error }, 'HOD Syllabus POST Error');
    return apiError('Internal Server Error', 500);
  }
}
