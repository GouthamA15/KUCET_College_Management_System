import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { syllabusData } from '@/lib/syllabus-data';
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

    if (branch && semester) {
      const branchSyllabus = syllabusData[branch.toUpperCase()];
      if (!branchSyllabus) return apiError('Branch not found', 404);
      const semSyllabus = branchSyllabus[semester];
      if (!semSyllabus) return apiError('Semester not found', 404);

      // If academicYear is provided, check which subjects are already allocated
      let allocations = [];
      if (academicYear) {
        const db = getDb();
        const [rows] = await db.execute(
          'SELECT subject_code, faculty_id FROM faculty_subject_assignments WHERE branch = ? AND course_semester = ? AND academic_year = ?',
          [branch, semester, academicYear]
        );
        allocations = rows;
      }

      const dataWithAllocations = semSyllabus.map(item => {
        const check = (code) => {
          if (!code) return { is_allocated: false, allocated_to_me: false };
          const allocation = allocations.find(a => a.subject_code === code);
          return {
            is_allocated: !!allocation,
            allocated_to_me: allocation ? (allocation.faculty_id === user.id) : false
          };
        };

        let result = { ...item };

        // If it's an elective group, check each variant individually
        if (item.variants) {
          const updatedVariants = item.variants.map(v => ({
            ...v,
            ...check(v.code)
          }));
          result.variants = updatedVariants;
          
          // Also set group-level flags if any variant is allocated
          result.is_allocated = updatedVariants.some(v => v.is_allocated);
          result.allocated_to_me = updatedVariants.some(v => v.allocated_to_me);
        } else if (item.code) {
          // If it's a standard subject (Core)
          const status = check(item.code);
          result = { ...result, ...status };
        }

        return result;
      });

      return apiResponse({ data: dataWithAllocations });
    }

    return apiResponse({ data: syllabusData });
  } catch (error) {
    console.error('Syllabus Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
