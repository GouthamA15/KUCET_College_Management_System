import logger from '@/lib/logger';
import { db } from '@/db';
import { syllabusSubjects, syllabusStructure, syllabusUnits } from '@/db/schema';
import { eq, and, inArray, asc } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

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

    // Fetch all units for these subjects
    const subjectCodes = subjects.map(s => s.subject_code);
    let units = [];
    if (subjectCodes.length > 0) {
      units = await db.select()
        .from(syllabusUnits)
        .where(inArray(syllabusUnits.subject_code, subjectCodes))
        .orderBy(asc(syllabusUnits.subject_code), asc(syllabusUnits.unit_order));
    }

    // Combine data
    const data = subjects.map(s => ({
      ...s,
      units: units.filter(u => u.subject_code === s.subject_code)
    }));

    return apiResponse({ data });
  } catch (error) {
    logger.error({ err: error, user: user?.email, branch: user?.branch }, 'HOD Syllabus GET Error');
    console.error('[DEBUG] Syllabus Error:', error.message);
    return apiError('Internal Server Error', 500, error.message);
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const body = await req.json();
    const { action, subject, unit } = body;

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
        semester: parseInt(semester),
        subject_code
      }).onDuplicateKeyUpdate({
        set: { semester: parseInt(semester) }
      });

      return apiResponse({ success: true, message: 'Subject added/updated successfully' });
    }

    if (action === 'DELETE_SUBJECT') {
      const { subject_code } = subject;
      // Only remove mapping for THIS branch
      await db.delete(syllabusStructure)
        .where(and(
            eq(syllabusStructure.branch, user.branch),
            eq(syllabusStructure.subject_code, subject_code)
        ));
      return apiResponse({ success: true, message: 'Subject mapping removed' });
    }

    if (action === 'SAVE_UNIT') {
      const { subject_code, unit_order, unit_name, topics } = unit;
      
      // Validation: Ensure topics is an array and cleanup
      let finalTopics = [];
      if (Array.isArray(topics)) {
        finalTopics = topics.map(t => String(t).trim()).filter(Boolean);
      } else if (typeof topics === 'string') {
        try {
          const parsed = JSON.parse(topics);
          finalTopics = Array.isArray(parsed) ? parsed : [topics];
        } catch (e) {
          finalTopics = [topics];
        }
      }

      await db.insert(syllabusUnits).values({
        subject_code,
        unit_order: parseInt(unit_order),
        unit_name,
        topics: finalTopics
      }).onDuplicateKeyUpdate({
        set: { unit_name, topics: finalTopics }
      });

      return apiResponse({ success: true, message: 'Unit saved' });
    }

    if (action === 'DELETE_UNIT') {
        const { id } = unit;
        await db.delete(syllabusUnits).where(eq(syllabusUnits.id, id));
        return apiResponse({ success: true, message: 'Unit deleted' });
    }

    return apiError('Invalid action', 400);
  } catch (error) {
    logger.error('HOD Syllabus POST Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
