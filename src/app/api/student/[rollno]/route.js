import { query } from '@/lib/db';
import { computeAcademicYear } from '@/app/lib/academicYear';
import { getBranchFromRoll, getAdmissionTypeFromRoll } from '@/lib/rollNumber';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req, context) {
  // Check any valid auth
  const user = await getAuthUser();

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  // Optional: Add specific logic if clerk can see all, but student only their own
  // if (user.student_id && user.roll_no !== context.params.rollno) return apiError('Forbidden', 403);

  try {
    const params = await context.params;
    const { rollno } = params;

    const studentSql = `
      SELECT s.*, CASE WHEN si.pfp IS NOT NULL THEN 1 ELSE 0 END as has_pfp 
      FROM students s 
      LEFT JOIN student_images si ON s.id = si.student_id 
      WHERE s.roll_no = ?
    `;
    const studentResult = await query(studentSql, [rollno]);

    if (studentResult.length === 0) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    const student = studentResult[0];
    const studentId = student.id;

    // Set pfp URL if image exists
    if (student.has_pfp) {
      student.pfp = `/api/student/image/${student.roll_no}`;
    } else {
      student.pfp = null;
    }
    // Remove temporary field
    delete student.has_pfp;

    // Derive course and admission type
    student.course = getBranchFromRoll(student.roll_no);
    student.admission_type = getAdmissionTypeFromRoll(student.roll_no);

    const scholarshipSql = 'SELECT * FROM scholarship_sanctions WHERE student_id = ? ORDER BY sanction_date';
    let scholarship = await query(scholarshipSql, [studentId]);
    // Normalize scholarship fields to support both old and new schemas.
    scholarship = scholarship.map(s => {
      const academic_year = s.academic_year || (s.year ? computeAcademicYear(student.roll_no, s.year) : null);
      return {
        ...s,
        academic_year,
        application_no: s.application_no ?? s.application_no,
        proceeding_no: s.proceeding_no ?? s.proceeding_no,
        sanctioned_amount: s.sanctioned_amount ?? s.amount_sanctioned ?? s.sanctioned_amount,
        sanction_date: s.sanction_date ?? s.date ?? s.sanction_date,
      };
    });

    const feesSql = 'SELECT * FROM student_fee_payments WHERE student_id = ? ORDER BY academic_year, transaction_date';
    const feesRaw = await query(feesSql, [studentId]);
    // Normalize fee field names (transaction_ref_no -> transaction_ref, transaction_date -> date)
    const fees = feesRaw.map(f => ({
      ...f,
      transaction_ref: f.transaction_ref_no ?? f.transaction_ref ?? f.transactionRef ?? null,
      date: f.transaction_date ?? f.date ?? null,
    }));

    // const academicsSql = 'SELECT * FROM academics WHERE student_id = ? ORDER BY year';
    // const academics = await query(academicsSql, [studentId]);

    // Fetch personal details from separate table if present
    let personalDetails = {};
    try {
      const pd = await query('SELECT * FROM student_personal_details WHERE student_id = ?', [studentId]);
      if (pd && pd.length > 0) personalDetails = pd[0];
    } catch (e) {
      console.warn('Could not fetch personal details:', e.message || e);
    }

    // Merge some commonly used fields for backward compatibility
    const mergedStudent = { ...student, personal_details: personalDetails };

    return NextResponse.json({ student: mergedStudent, scholarship, fees });
  } catch (error) {
    console.error('Error fetching student profile data:', error);
    return NextResponse.json({ message: 'Failed to fetch student profile data', error: error.message }, { status: 500 });
  }
}
