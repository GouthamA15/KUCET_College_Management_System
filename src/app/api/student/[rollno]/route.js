export const dynamic = 'force-dynamic';

import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  students, 
  studentPersonalDetails, 
  studentAcademicBackground, 
  studentImages, 
  studentSignatures, 
  scholarshipSanctions, 
  studentFeePayments 
} from '@/db/schema';
import { eq, asc, _desc } from 'drizzle-orm';
import { getBranchFromRoll, getAdmissionTypeFromRoll, getAcademicYear as computeAcademicYear } from '@/lib/rollNumber';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { decrypt } from '@/lib/encryption';
import { calculateYearAndSemesterAsync } from '@/lib/academic-utils';

export async function GET(req, context) {
  // Check any valid auth
  const user = await getAuthUser();

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  try {
    const params = await context.params;
    let { rollno } = params;

    // Invisible Normalization Hook
    rollno = String(rollno || '').trim().toUpperCase();

    // SECURITY GUARD: A student can ONLY access their own profile.
    // Staff (clerk/admin) can access any profile.
    const isStudent = !!user.roll_no;
    if (isStudent && user.roll_no !== rollno) {
      logger.warn(`[SECURITY_ALERT] Student ${user.roll_no} tried to access profile ${rollno}`);
      return apiError('Forbidden: Access denied to this profile', 403);
    }

    // 1. Fetch student with joined personal and academic data
    const studentResult = await db.select()
      .from(students)
      .leftJoin(studentPersonalDetails, eq(students.id, studentPersonalDetails.student_id))
      .leftJoin(studentAcademicBackground, eq(students.id, studentAcademicBackground.student_id))
      .where(eq(students.roll_no, rollno));

    if (studentResult.length === 0) {
      return apiError('Student not found', 404);
    }

    const row = studentResult[0];
    const studentData = row.students;
    const studentId = studentData.id;

    // Nest the data as expected by the frontend
    const student = { 
      ...studentData,
      mobile: decrypt(studentData.mobile) // Decrypt student mobile
    };
    
    student.personal_details = row.student_personal_details ? {
      ...row.student_personal_details,
      guardian_mobile: decrypt(row.student_personal_details.guardian_mobile), // Decrypt guardian mobile
      aadhaar_no: decrypt(row.student_personal_details.aadhaar_no) // Decrypt Aadhaar
    } : { /* empty */ };
    
    const academics = row.student_academic_background ? [row.student_academic_background] : [];
    
    student.course = getBranchFromRoll(student.roll_no);
    student.branch = student.course;
    student.admission_type = getAdmissionTypeFromRoll(student.roll_no);

    // Helper to handle both URLs and legacy Buffer data
    const imageHelper = (val) => {
      if (!val) return null;
      if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:'))) return val;
      if (Buffer.isBuffer(val)) return `data:image/png;base64,${val.toString('base64')}`;
      return val;
    };

    // 2. Fetch pfp and signature separately
    const pfpRow = await db.query.studentImages.findFirst({
      columns: { student_id: true },
      where: eq(studentImages.student_id, studentId)
    });
    student.pfp = pfpRow ? `/api/student/image/${student.roll_no}` : null;

    const sigRow = await db.query.studentSignatures.findFirst({
      where: eq(studentSignatures.student_id, studentId)
    });
    student.signature = sigRow ? imageHelper(sigRow.signature) : null;

    // 3. Fetch one-to-many relationships
    const scholarshipRows = await db.query.scholarshipSanctions.findMany({
      where: eq(scholarshipSanctions.student_id, studentId),
      orderBy: [asc(scholarshipSanctions.sanction_date)]
    });

    const scholarship = scholarshipRows.map(s => {
      const academic_year = s.academic_year || (s.year ? computeAcademicYear(student.roll_no, s.year) : null);
      return {
        ...s,
        academic_year,
        application_no: s.application_no,
        proceeding_no: s.proceeding_no,
        sanctioned_amount: s.sanctioned_amount,
        sanction_date: s.sanction_date,
      };
    });

    const feesRows = await db.query.studentFeePayments.findMany({
      where: eq(studentFeePayments.student_id, studentId),
      orderBy: [asc(studentFeePayments.academic_year), asc(studentFeePayments.transaction_date)]
    });

    const fees = feesRows.map(f => ({
      ...f,
      transaction_ref: f.transaction_ref_no,
      date: f.transaction_date,
    }));

    const academic_session = await calculateYearAndSemesterAsync(rollno, student.academic_offset_years || 0);
    student.academic_session = academic_session;

    return apiResponse({ student, scholarship, fees, academics, academic_session });
  } catch (error) {
    logger.error(error, 'Error fetching student profile data');
    return apiError('Failed to fetch student profile data', 500, error.message);
  }
}
