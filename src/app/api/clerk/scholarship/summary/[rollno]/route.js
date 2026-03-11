import { query } from '@/lib/db';
import { getBranchFromRoll, getAcademicYear, getResolvedCurrentAcademicYear } from '@/lib/rollNumber';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { getNow } from '@/lib/clock';

// Helper function to handle undefined values
const toNull = (value) => (value === undefined || value === '' ? null : value);

// Normalize status to DB enum: only 'Pending' or 'Success'
const normalizeStatus = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return 'Pending';
  const v = String(value).trim().toLowerCase();
  if (['success', 'successful', 'paid'].includes(v)) return 'Success';
  if (v === 'pending') return 'Pending';
  return 'Pending';
};

export async function GET(req, ctx) {
  const user = await getAuthUser('clerk');

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  try {
    const url = new URL(req.url);
    let year = url.searchParams.get('year');
    const params = ctx?.params ? (typeof ctx.params.then === 'function' ? await ctx.params : ctx.params) : {};
    const { rollno } = params;

    if (!rollno) return apiError('Missing rollno parameter', 400);

    const now = await getNow();

    // STEP A: Fetch student with pfp check
    const [student] = await query(
      `SELECT s.id, s.roll_no, s.name, s.fee_reimbursement, s.email, s.mobile, 
       CASE WHEN si.pfp IS NOT NULL THEN 1 ELSE 0 END as has_pfp
       FROM students s
       LEFT JOIN student_images si ON s.id = si.student_id
       WHERE s.roll_no = ?`,
      [rollno]
    );

    if (!student) {
      return apiError('Student not found', 404);
    }

    // STEP B: Derive course from roll number
    const course = getBranchFromRoll(student.roll_no);
    // Admission academic year period (e.g., 2023-2027)
    const admission_year = getAcademicYear(student.roll_no);

    // Fetch college info for academic year boundary
    const collegeInfoRows = await query('SELECT * FROM college_info WHERE id = 1');
    const collegeInfo = collegeInfoRows.length > 0 ? collegeInfoRows[0] : null;

    // Server-resolved current academic year (e.g., 2025-26)
    const current_year = getResolvedCurrentAcademicYear(student.roll_no, collegeInfo, now);
    // If client did not provide year, default to current_year to avoid UI-side hardcoding
    if (!year) {
      year = current_year;
    }
    const SFC_COURSES = new Set(['CSD', 'IT', 'CIVIL']);
    const fee_category = SFC_COURSES.has(String(course).toUpperCase()) ? 'SFC' : 'NON-SFC';

    // STEP C: Resolve total fee
    const total_fee = fee_category === 'SFC' ? 70000 : 35000;

    // STEP D: Fetch scholarship sanctions for the academic year
    const sanctionsRows = await query(
      'SELECT id, application_no, proceeding_no, sanctioned_amount, sanction_date, thumb_update_available, thumb_status, hardcopy_submitted FROM scholarship_sanctions WHERE student_id = ? AND academic_year = ? ORDER BY sanction_date ASC',
      [student.id, year]
    );
    const scholarship_proceedings = (sanctionsRows || []).map(r => ({
      id: r.id,
      proceeding_no: r.proceeding_no,
      amount: Number(r.sanctioned_amount) || 0,
      date: r.sanction_date,
    }));
    const application_no = (sanctionsRows || []).map(r => r.application_no).find(v => v && String(v).trim() !== '') || null;
    // Derive thumb fields from the most relevant sanction row (prefer base row without proceeding, else latest)
    let thumb_update_available = 0;
    let thumb_status = null;
    let hardcopy_submitted = 0;
    try {
      if (Array.isArray(sanctionsRows) && sanctionsRows.length > 0) {
        // prefer a row without proceeding_no (base row), otherwise the last row
        const baseRow = sanctionsRows.find(r => !r.proceeding_no) || sanctionsRows[sanctionsRows.length - 1];
        if (baseRow) {
          thumb_update_available = baseRow.thumb_update_available ? 1 : 0;
          thumb_status = baseRow.thumb_status || null;
          hardcopy_submitted = baseRow.hardcopy_submitted ? 1 : 0;
        }
      }
    } catch (e) {
      // ignore and leave defaults
    }
    const govt_paid = scholarship_proceedings.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // STEP E: Fetch student payments for the academic year
    const paymentsRows = await query(
      'SELECT id, transaction_ref_no, amount, transaction_date FROM student_fee_payments WHERE student_id = ? AND academic_year = ? ORDER BY transaction_date ASC',
      [student.id, year]
    );
    const student_payments = (paymentsRows || []).map(r => ({
      id: r.id,
      transaction_ref: r.transaction_ref_no,
      amount: Number(r.amount) || 0,
      date: r.transaction_date,
    }));
    const student_paid = student_payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // STEP F: Compute derived fields
    const pending_fee = Math.max(0, Number(total_fee) - (Number(govt_paid) + Number(student_paid)));
    const status = pending_fee === 0 ? 'COMPLETED' : 'PENDING';

    // STEP G: Shape response exactly per contract
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
    console.error('Error fetching student data:', error);
    return apiError('Internal Server Error', 500);
  }
}

// Unsupported methods for this endpoint until POST endpoints are implemented
export async function POST() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }
export async function DELETE() { return apiError('Method Not Allowed', 405); }
