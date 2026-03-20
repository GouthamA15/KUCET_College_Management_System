import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  students as studentsTable, 
  studentImages, 
  collegeInfo as collegeInfoTable, 
  scholarshipSanctions, 
  studentFeePayments 
} from '@/db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { getBranchFromRoll, getAcademicYear, getResolvedCurrentAcademicYear } from '@/lib/rollNumber';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { getNow } from '@/lib/clock';

export async function GET(req, ctx) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const url = new URL(req.url);
    let year = url.searchParams.get('year');
    const params = await ctx.params;
    const { rollno } = params;

    if (!rollno) return apiError('Missing rollno parameter', 400);

    const now = await getNow();

    // STEP A: Fetch student with pfp check
    const studentRows = await db.select({
      id: studentsTable.id,
      roll_no: studentsTable.roll_no,
      name: studentsTable.name,
      fee_reimbursement: studentsTable.fee_reimbursement,
      email: studentsTable.email,
      mobile: studentsTable.mobile,
      has_pfp: sql`CASE WHEN ${studentImages.pfp} IS NOT NULL THEN 1 ELSE 0 END`
    })
    .from(studentsTable)
    .leftJoin(studentImages, eq(studentsTable.id, studentImages.student_id))
    .where(eq(studentsTable.roll_no, rollno))
    .limit(1);

    if (studentRows.length === 0) {
      return apiError('Student not found', 404);
    }
    const student = studentRows[0];

    // STEP B: Resolve context
    const course = getBranchFromRoll(student.roll_no);
    const admission_year = getAcademicYear(student.roll_no);

    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const collegeInfo = collegeRows[0] || null;

    const current_year = getResolvedCurrentAcademicYear(student.roll_no, collegeInfo, now);
    if (!year) year = current_year;

    const SFC_COURSES = new Set(['CSD', 'IT', 'CIVIL']);
    const fee_category = SFC_COURSES.has(String(course).toUpperCase()) ? 'SFC' : 'NON-SFC';
    const total_fee = fee_category === 'SFC' ? 70000 : 35000;

    // STEP D: Fetch scholarship sanctions
    const sanctionsRows = await db.query.scholarshipSanctions.findMany({
      where: and(
        eq(scholarshipSanctions.student_id, student.id),
        eq(scholarshipSanctions.academic_year, year)
      ),
      orderBy: [asc(scholarshipSanctions.sanction_date)]
    });

    const scholarship_proceedings = sanctionsRows.map(r => ({
      id: r.id,
      proceeding_no: r.proceeding_no,
      amount: Number(r.sanctioned_amount) || 0,
      date: r.sanction_date,
    }));

    const application_no = sanctionsRows.map(r => r.application_no).find(v => v && String(v).trim() !== '') || null;
    
    let thumb_update_available = 0;
    let thumb_status = null;
    let hardcopy_submitted = 0;
    if (sanctionsRows.length > 0) {
      const baseRow = sanctionsRows.find(r => !r.proceeding_no) || sanctionsRows[sanctionsRows.length - 1];
      if (baseRow) {
        thumb_update_available = baseRow.thumb_update_available ? 1 : 0;
        thumb_status = baseRow.thumb_status || null;
        hardcopy_submitted = baseRow.hardcopy_submitted ? 1 : 0;
      }
    }

    const govt_paid = scholarship_proceedings.reduce((sum, p) => sum + p.amount, 0);

    // STEP E: Fetch student payments
    const paymentsRows = await db.query.studentFeePayments.findMany({
      where: and(
        eq(studentFeePayments.student_id, student.id),
        eq(studentFeePayments.academic_year, year)
      ),
      orderBy: [asc(studentFeePayments.transaction_date)]
    });

    const student_payments = paymentsRows.map(r => ({
      id: r.id,
      transaction_ref: r.transaction_ref_no,
      amount: Number(r.amount) || 0,
      date: r.transaction_date,
    }));
    const student_paid = student_payments.reduce((sum, p) => sum + p.amount, 0);

    // STEP F: Compute derived fields
    const pending_fee = Math.max(0, Number(total_fee) - (Number(govt_paid) + Number(student_paid)));
    const status = pending_fee === 0 ? 'COMPLETED' : 'PENDING';

    const response = {
      student: {
        id: student.id,
        roll_no: student.roll_no,
        name: student.name,
        fee_reimbursement: student.fee_reimbursement,
        fee_category,
        course,
        email: student.email ?? null,
        mobile: student.mobile ?? null,
        pfp: student.has_pfp ? `/api/student/image/${student.roll_no}` : null,
        admission_year,
        current_year,
      },
      academic_year: year,
      fee_summary: {
        total_fee,
        govt_paid,
        student_paid,
        pending_fee,
        status,
      },
      scholarship_proceedings,
      application_no,
      thumb_update_available,
      thumb_status,
      hardcopy_submitted,
      student_payments,
    };

    return apiResponse({ data: response });
  } catch (error) {
    logger.error('Error fetching student data:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }
export async function DELETE() { return apiError('Method Not Allowed', 405); }
