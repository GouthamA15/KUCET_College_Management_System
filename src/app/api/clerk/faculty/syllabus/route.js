import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  syllabusStructure, 
  syllabusSubjects, 
  syllabusUnits, 
  facultySubjectAssignments 
} from '@/db/schema';
import { eq, and, asc, sql, inArray } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch');
    const semester = searchParams.get('semester') ? parseInt(searchParams.get('semester')) : null;
    const academicYear = searchParams.get('academicYear');

    if (branch && semester) {
      // 1. Fetch structure and subject metadata
      const structureRows = await db.select({
        subject_code: syllabusStructure.subject_code,
        is_group: syllabusStructure.is_group,
        parent_group_code: syllabusStructure.parent_group_code,
        title: syllabusSubjects.subject_name,
        subject_type: syllabusSubjects.subject_type
      })
      .from(syllabusStructure)
      .innerJoin(syllabusSubjects, eq(syllabusStructure.subject_code, syllabusSubjects.subject_code))
      .where(and(
        eq(syllabusStructure.branch, branch.toUpperCase()),
        eq(syllabusStructure.semester, semester)
      ));

      if (structureRows.length === 0) {
        return apiResponse({ data: [] });
      }

      const subjectCodes = [...new Set(structureRows.map(r => r.subject_code))];

      // 2. Fetch units
      const unitRows = await db.query.syllabusUnits.findMany({
        where: inArray(syllabusUnits.subject_code, subjectCodes),
        orderBy: [asc(syllabusUnits.subject_code), asc(syllabusUnits.unit_order)]
      });

      const unitsBySubject = unitRows.reduce((acc, u) => {
        if (!acc[u.subject_code]) acc[u.subject_code] = [];
        acc[u.subject_code].push({ 
          name: u.unit_name, 
          topics: typeof u.topics === 'string' ? JSON.parse(u.topics) : u.topics 
        });
        return acc;
      }, {});

      // 3. Fetch allocations
      let allocations = [];
      if (academicYear) {
        allocations = await db.select({
          subject_code: facultySubjectAssignments.subject_code,
          faculty_id: facultySubjectAssignments.faculty_id
        })
        .from(facultySubjectAssignments)
        .where(and(
          eq(facultySubjectAssignments.branch, branch),
          eq(facultySubjectAssignments.course_semester, semester),
          eq(facultySubjectAssignments.academic_year, academicYear)
        ));
      }

      const check = (code) => {
        if (!code) return { is_allocated: false, allocated_to_me: false };
        const allocation = allocations.find(a => a.subject_code === code);
        return {
          is_allocated: !!allocation,
          allocated_to_me: allocation ? (allocation.faculty_id === user.id) : false
        };
      };

      // 4. Reconstruct Nested Structure
      const topLevel = structureRows.filter(r => !r.parent_group_code);
      const variants = structureRows.filter(r => r.parent_group_code);

      const semSyllabus = topLevel.map(item => {
        let result = {
          code: item.subject_code,
          title: item.title,
          isGroup: !!item.is_group,
          subject_type: item.subject_type,
          units: unitsBySubject[item.subject_code] || []
        };

        if (item.is_group) {
          const groupVariants = variants
            .filter(v => v.parent_group_code === item.subject_code)
            .map(v => ({
              code: v.subject_code,
              title: v.title,
              subject_type: v.subject_type,
              units: unitsBySubject[v.subject_code] || [],
              ...check(v.subject_code)
            }));
          
          result.variants = groupVariants;
          result.is_allocated = groupVariants.some(v => v.is_allocated);
          result.allocated_to_me = groupVariants.some(v => v.allocated_to_me);
        } else {
          const status = check(item.subject_code);
          result = { ...result, ...status };
        }

        return result;
      });

      return apiResponse({ data: semSyllabus });
    }

    // Default: Return basic branches/semesters info
    const allRows = await db.select({
      branch: syllabusStructure.branch,
      semester: syllabusStructure.semester,
      subject_count: sql`COUNT(*)`
    })
    .from(syllabusStructure)
    .where(sql`${syllabusStructure.parent_group_code} IS NULL`)
    .groupBy(syllabusStructure.branch, syllabusStructure.semester)
    .orderBy(asc(syllabusStructure.branch), asc(syllabusStructure.semester));

    const syllabusOverview = allRows.reduce((acc, row) => {
      if (!acc[row.branch]) acc[row.branch] = {};
      acc[row.branch][row.semester] = { count: Number(row.subject_count) };
      return acc;
    }, {});

    return apiResponse({ data: syllabusOverview });
  } catch (error) {
    logger.error('Syllabus Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
