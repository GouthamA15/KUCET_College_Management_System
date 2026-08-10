import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  students as studentsTable, 
  studentImages, 
  scholarshipSanctions, 
  studentFeePayments 
} from '@/db/schema';
import { eq, and, asc, sql, _or, _like } from 'drizzle-orm';
import { 
  getBranchFromRoll, 
  getAcademicYear,
  getAdmissionTypeFromRoll,
  _getAcademicYearForStudyYear
} from '@/lib/rollNumber';
import { getCollegeAcademicYear } from '@/lib/academic-utils';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { getNow } from '@/lib/clock';
import { decrypt } from '@/lib/encryption';
import { getAssetUrl } from '@/lib/assets';

export async function GET(req, ctx) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const params = await ctx.params;
    const { application_no } = params;
    if (!application_no) return apiError('Missing application_no parameter', 400);

    // Validation: Must be numeric
    if (!/^\d+$/.test(application_no)) {
      return apiError('application_no must be numeric', 400);
    }

    // Find sanction rows that match the application number
    const sanctionRows = await db.select({ 
      student_id: scholarshipSanctions.student_id, 
      academic_year: scholarshipSanctions.academic_year 
    })
    .from(scholarshipSanctions)
    .where(eq(scholarshipSanctions.application_no, application_no));

    if (sanctionRows.length === 0) {
      return apiError('Application not found', 404);
    }

    // Pick the first student (application_no should map to one student)
    const studentId = sanctionRows[0].student_id;

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
    .where(eq(studentsTable.id, studentId))
    .limit(1);

    if (studentRows.length === 0) return apiError('Student not found', 404);
    const student = studentRows[0];

    const now = await getNow();
    const course = getBranchFromRoll(student.roll_no);
    const admission_year = getAcademicYear(student.roll_no);
    const current_year = await getCollegeAcademicYear();
    const _admissionType = getAdmissionTypeFromRoll(student.roll_no);

    // For each academic_year belonging to this application, build a summary
    const allYears = Array.from(new Set(sanctionRows.map(r => r.academic_year))).filter(Boolean).sort();
    const year_records = { /* empty */ };

    for (const year of allYears) {
      // sanctions for this student/year
      const sanctions = await db.query.scholarshipSanctions.findMany({
        where: and(
          eq(scholarshipSanctions.student_id, studentId),
          eq(scholarshipSanctions.academic_year, year)
        ),
        orderBy: [asc(scholarshipSanctions.sanction_date)]
      });

      const scholarship_proceedings = sanctions.map(r => ({ 
        id: r.id, 
        proceeding_no: r.proceeding_no, 
        amount: Number(r.sanctioned_amount) || 0, 
        date: r.sanction_date 
      }));
      const application_for_year = sanctions.map(r => r.application_no).find(v => v && String(v).trim() !== '') || null;

      // payments for this student/year
      const payments = await db.query.studentFeePayments.findMany({
        where: and(
          eq(studentFeePayments.student_id, studentId),
          eq(studentFeePayments.academic_year, year)
        ),
        orderBy: [asc(studentFeePayments.transaction_date)]
      });

      const student_payments = payments.map(r => ({ 
        id: r.id, 
        transaction_ref: r.transaction_ref_no, 
        amount: Number(r.amount) || 0, 
        date: r.transaction_date 
      }));

      // derive fee summary
      const SFC_COURSES = new Set(['CSD', 'IT', 'CIVIL']);
      const fee_category = SFC_COURSES.has(String(course).toUpperCase()) ? 'SFC' : 'NON-SFC';
      const total_fee = fee_category === 'SFC' ? 70000 : 35000;
      const govt_paid = scholarship_proceedings.reduce((sum, p) => sum + p.amount, 0);
      const student_paid = student_payments.reduce((sum, p) => sum + p.amount, 0);
      const pending_fee = Math.max(0, Number(total_fee) - (Number(govt_paid) + Number(student_paid)));
      const status = pending_fee === 0 ? 'COMPLETED' : 'PENDING';

      year_records[year] = {
        academic_year: year,
        scholarship_proceedings,
        application_no: application_for_year,
        student_payments,
        fee_summary: {
          total_fee,
          govt_paid,
          student_paid,
          pending_fee,
          status,
        },
      };
    }

    const response = {
      student: {
        id: student.id,
        roll_no: student.roll_no,
        name: student.name,
        fee_reimbursement: student.fee_reimbursement,
        fee_category: new Set(['CSD', 'IT', 'CIVIL']).has(String(course).toUpperCase()) ? 'SFC' : 'NON-SFC',
        course,
        email: student.email ?? null,
        mobile: decrypt(student.mobile) ?? null,
        pfp: student.pfp ? getAssetUrl(student.pfp) : null,
        admission_year,
        current_year,
      },
      year_records,
    };

    return apiResponse({ data: response });
  } catch (error) {
    logger.error('Error fetching application data:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }
export async function DELETE() { return apiError('Method Not Allowed', 405); }
