import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { syllabusData } from '@/lib/syllabus-data';

export async function GET(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    // Optionally filter by branch/semester if provided in query params
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch');
    const semester = searchParams.get('semester');

    if (branch && semester) {
      const branchSyllabus = syllabusData[branch.toUpperCase()];
      if (!branchSyllabus) return apiError('Branch not found', 404);
      const semSyllabus = branchSyllabus[semester];
      if (!semSyllabus) return apiError('Semester not found', 404);
      return apiResponse({ data: semSyllabus });
    }

    return apiResponse({ data: syllabusData });
  } catch (error) {
    console.error('Syllabus Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
