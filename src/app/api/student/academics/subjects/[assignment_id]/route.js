import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { db } from '@/db';
import { 
  syllabusStructure, 
  syllabusSubjects, 
  facultySubjectAssignments, 
  staffAccounts
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { calculateYearAndSemesterAsync, getCollegeAcademicYear } from '@/lib/academic-utils';
import { getBranchFromRoll } from '@/lib/rollNumber';
import { getStudentSubjectAttendance } from '@/services/academic/AttendanceService';

export async function GET(_request, { params }) {
  try {
    const { assignment_id } = await params;
    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const assignmentId = parseInt(assignment_id, 10);
    if (isNaN(assignmentId)) {
      return apiError('Invalid assignment ID', 400);
    }

    const academicSession = await calculateYearAndSemesterAsync(user.roll_no, user.academic_offset_years || 0);
    const { semester, status: sessionStatus } = academicSession;
    const academicYear = await getCollegeAcademicYear();
    const branch = getBranchFromRoll(user.roll_no);
    const studentId = user.student_id;

    if (sessionStatus === 'Semester Not Configured' || !studentId || !branch || !semester || !academicYear) {
      return apiError('Unable to determine student academic context', 400);
    }

    const assignmentRecord = await db.select({
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      faculty_name: staffAccounts.name
    })
    .from(facultySubjectAssignments)
    .leftJoin(staffAccounts, eq(facultySubjectAssignments.staff_account_id, staffAccounts.id))
    .where(eq(facultySubjectAssignments.id, assignmentId))
    .limit(1);

    if (assignmentRecord.length === 0) {
      return apiError('Subject assignment not found', 404);
    }

    const assignment = assignmentRecord[0];

    if (assignment.branch !== branch || assignment.academic_year !== academicYear || assignment.course_semester !== semester) {
      return apiError('Unauthorized to view this subject assignment', 403);
    }

    const subjectRecord = await db.select({
      subject_name: syllabusSubjects.subject_name,
      subject_type: syllabusSubjects.subject_type,
    })
    .from(syllabusStructure)
    .innerJoin(syllabusSubjects, eq(syllabusStructure.subject_code, syllabusSubjects.subject_code))
    .where(and(
      eq(syllabusStructure.subject_code, assignment.subject_code),
      eq(syllabusStructure.branch, branch),
      eq(syllabusStructure.semester, semester)
    ))
    .limit(1);

    if (subjectRecord.length === 0) {
      return apiError('Subject syllabus information not found', 404);
    }
    const subject = subjectRecord[0];

    const { summary, timeline } = await getStudentSubjectAttendance(studentId, assignmentId);

    return apiResponse({
      data: {
        assignment_id: assignmentId,
        subject_code: assignment.subject_code,
        subject_name: subject.subject_name,
        subject_type: subject.subject_type,
        faculty_name: assignment.faculty_name,
        semester: assignment.course_semester,
        academic_year: assignment.academic_year,
        attendance: summary,
        timeline: timeline
      }
    });
  } catch (error) {
    logger.error('Subject Detail API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
