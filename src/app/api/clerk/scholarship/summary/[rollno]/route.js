import { db } from '@/db';
import { 
  students as studentsTable, 
  studentImages, 
  collegeInfo as collegeInfoTable 
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAcademicYear, getBranchFromRoll } from '@/lib/rollNumber';
import { getCollegeAcademicYear } from '@/lib/academic-utils';
import { apiError, wrapHandler } from '@/lib/api-utils';
import { getNow } from '@/lib/clock';
import { decrypt } from '@/lib/encryption';
import { ScholarshipService } from '@/services/ScholarshipService';
import { getAssetUrl } from '@/lib/assets';

/**
 * GET /api/clerk/scholarship/summary/[rollno]
 * Fetch comprehensive financial and scholarship summary for a student
 */
export const GET = wrapHandler({
  auth: 'clerk',
  handler: async (req, { context }) => {
    const { rollno } = await context.params;
    const url = new URL(req.url);
    let year = url.searchParams.get('year');

    const now = await getNow();

    // 1. Fetch student core info
    const studentRows = await db.select({
      id: studentsTable.id,
      roll_no: studentsTable.roll_no,
      name: studentsTable.name,
      fee_reimbursement: studentsTable.fee_reimbursement,
      email: studentsTable.email,
      mobile: studentsTable.mobile,
      pfp: studentImages.pfp
    })
    .from(studentsTable)
    .leftJoin(studentImages, eq(studentsTable.id, studentImages.student_id))
    .where(eq(studentsTable.roll_no, String(rollno).toUpperCase().trim()))
    .limit(1);

    if (studentRows.length === 0) {
      return apiError('Student not found', 404);
    }
    const student = studentRows[0];

    // 2. Resolve academic context
    const admissionYear = getAcademicYear(student.roll_no);
    const currentYear = await getCollegeAcademicYear();
    
    if (!year) year = currentYear;

    // 3. Fetch financial summary via service
    const financialSummary = await ScholarshipService.getScholarshipFinancialSummary(student.id, year, student.roll_no);

    const enrichedStudent = {
      id: student.id,
      roll_no: student.roll_no,
      name: student.name,
      fee_reimbursement: student.fee_reimbursement,
      fee_category: financialSummary.feeSummary.feeCategory,
      course: getBranchFromRoll(student.roll_no) || student.roll_no.substring(student.roll_no.length - 4, student.roll_no.length - 2),
      email: student.email || null,
      mobile: student.mobile ? decrypt(student.mobile) : null,
      pfp: student.pfp ? getAssetUrl(student.pfp) : null,
      admission_year: admissionYear,
      current_year: currentYear,
    };

    return {
      student: enrichedStudent,
      ...financialSummary,
      data: { // Legacy structure support for frontend compatibility
        student: enrichedStudent,
        ...financialSummary,
        academic_year: year
      }
    };
  }
});
