import { query } from '@/lib/db';
import { getBranchFromRoll, getAcademicYear, getResolvedCurrentAcademicYear } from '@/lib/rollNumber';
import { SFC_COURSES } from '../../../../../../lib/financial-utils';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { getNow } from '@/lib/clock';

export async function GET(req, ctx) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const params = ctx?.params ? (typeof ctx.params.then === 'function' ? await ctx.params : ctx.params) : {};
    const { application_no } = params;
    if (!application_no) return apiError('Missing application_no parameter', 400);

    // Find sanction rows that match the application number
    const sanctionRows = await query('SELECT DISTINCT student_id, academic_year FROM scholarship_sanctions WHERE application_no = ?', [application_no]);
    if (!sanctionRows || sanctionRows.length === 0) {
      return apiError('Application not found', 404);
    }

    // Pick the first student (application_no should map to one student)
    const studentId = sanctionRows[0].student_id;

    const [student] = await query(
      `SELECT s.id, s.roll_no, s.name, s.fee_reimbursement, s.email, s.mobile,
       CASE WHEN si.pfp IS NOT NULL THEN 1 ELSE 0 END as has_pfp
       FROM students s
       LEFT JOIN student_images si ON s.id = si.student_id
       WHERE s.id = ?`,
      [studentId]
    );
    if (!student) return apiError('Student not found', 404);

    const now = await getNow();
    const course = getBranchFromRoll(student.roll_no);
    const admission_year = getAcademicYear(student.roll_no);
    const current_year = getResolvedCurrentAcademicYear(student.roll_no, null, now);

    // For each academic_year belonging to this application, build a summary
    const years = Array.from(new Set(sanctionRows.map(r => r.academic_year))).filter(Boolean);
    const year_records = {};

    for (const year of years) {
      // sanctions for this student/year
      const sanctions = await query('SELECT id, application_no, proceeding_no, sanctioned_amount, sanction_date FROM scholarship_sanctions WHERE student_id = ? AND academic_year = ? ORDER BY sanction_date ASC', [studentId, year]);
      const scholarship_proceedings = (sanctions || []).map(r => ({ id: r.id, proceeding_no: r.proceeding_no, amount: Number(r.sanctioned_amount) || 0, date: r.sanction_date }));
      const application_for_year = (sanctions || []).map(r => r.application_no).find(v => v && String(v).trim() !== '') || null;

      // payments for this student/year
      const payments = await query('SELECT id, transaction_ref_no, amount, transaction_date FROM student_fee_payments WHERE student_id = ? AND academic_year = ? ORDER BY transaction_date ASC', [studentId, year]);
      const student_payments = (payments || []).map(r => ({ id: r.id, transaction_ref: r.transaction_ref_no, amount: Number(r.amount) || 0, date: r.transaction_date }));

      // derive fee summary consistent with summary endpoint
      const SFC_COURSES = new Set(['CSD', 'IT', 'CIVIL']);
      const fee_category = SFC_COURSES.has(String(course).toUpperCase()) ? 'SFC' : 'NON-SFC';
      const total_fee = fee_category === 'SFC' ? 70000 : 35000;
      const govt_paid = scholarship_proceedings.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const student_paid = student_payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
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
        fee_category: SFC_COURSES.has(String(course).toUpperCase()) ? 'SFC' : 'NON-SFC',
        course,
        email: student.email ?? null,
        mobile: student.mobile ?? null,
        pfp: student.has_pfp ? `/api/student/image/${student.roll_no}` : null,
        admission_year,
        current_year,
      },
      year_records,
    };

    return apiResponse({ data: response });
  } catch (error) {
    console.error('Error fetching application data:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }
export async function DELETE() { return apiError('Method Not Allowed', 405); }
