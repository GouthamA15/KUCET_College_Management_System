import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getDb } from '@/lib/db';

export async function GET(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch');
    const semester = searchParams.get('semester');
    const academicYear = searchParams.get('academicYear');

    const db = getDb();

    if (branch && semester) {
      // 1. Fetch structure and subject metadata
      const [structureRows] = await db.execute(`
        SELECT 
          ss.subject_code, ss.is_group, ss.parent_group_code,
          sb.subject_name as title, sb.subject_type
        FROM syllabus_structure ss
        JOIN syllabus_subjects sb ON ss.subject_code = sb.subject_code
        WHERE ss.branch = ? AND ss.semester = ?
      `, [branch.toUpperCase(), semester]);

      if (structureRows.length === 0) {
        return apiResponse({ data: [] });
      }

      const subjectCodes = [...new Set(structureRows.map(r => r.subject_code))];

      // 2. Fetch units for these subjects
      const [unitRows] = await db.execute(`
        SELECT subject_code, unit_order, unit_name as name, topics
        FROM syllabus_units
        WHERE subject_code IN (${subjectCodes.map(() => '?').join(',')})
        ORDER BY subject_code, unit_order
      `, subjectCodes);

      // Group units by subject_code
      const unitsBySubject = unitRows.reduce((acc, u) => {
        if (!acc[u.subject_code]) acc[u.subject_code] = [];
        acc[u.subject_code].push({ 
          name: u.name, 
          topics: typeof u.topics === 'string' ? JSON.parse(u.topics) : u.topics 
        });
        return acc;
      }, {});

      // 3. Fetch allocations if academicYear is provided
      let allocations = [];
      if (academicYear) {
        const [rows] = await db.execute(
          'SELECT subject_code, faculty_id FROM faculty_subject_assignments WHERE branch = ? AND course_semester = ? AND academic_year = ?',
          [branch, semester, academicYear]
        );
        allocations = rows;
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
    const [allRows] = await db.execute(`
      SELECT branch, semester, COUNT(*) as subject_count
      FROM syllabus_structure
      WHERE parent_group_code IS NULL
      GROUP BY branch, semester
      ORDER BY branch, semester
    `);

    // Grouping by branch
    const syllabusOverview = allRows.reduce((acc, row) => {
      if (!acc[row.branch]) acc[row.branch] = {};
      acc[row.branch][row.semester] = { count: row.subject_count };
      return acc;
    }, {});

    return apiResponse({ data: syllabusOverview });
  } catch (error) {
    console.error('Syllabus Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
