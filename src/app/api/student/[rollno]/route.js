import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { computeAcademicYear } from '@/app/lib/academicYear';
import { getBranchFromRoll, getAdmissionTypeFromRoll } from '@/lib/rollNumber';
import { jwtVerify } from 'jose'; // Import jwtVerify

// Helper function to verify JWT using jose (Edge compatible)
async function verifyJwt(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    console.error('JWT Verification failed:', error);
    return null;
  }
}

export async function GET(req, context) {
  const cookieStore = await cookies();
  const studentAuthCookie = cookieStore.get('student_auth');
  const clerkAuthCookie = cookieStore.get('clerk_auth'); // Get clerk auth cookie

  let isAuthenticated = false;

  // Check student authentication
  if (studentAuthCookie) {
    const token = studentAuthCookie.value;
    const decoded = await verifyJwt(token, process.env.JWT_SECRET);
    if (decoded) {
      isAuthenticated = true;
    }
  }

  // If not authenticated as student, check clerk authentication
  if (!isAuthenticated && clerkAuthCookie) {
    const token = clerkAuthCookie.value;
    const decoded = await verifyJwt(token, process.env.JWT_SECRET);
    if (decoded && decoded.role === 'admission') { // Check if role is 'admission'
      isAuthenticated = true;
    }
  }

  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const params = await context.params;
    const { rollno } = params;

    const studentSql = 'SELECT * FROM students WHERE roll_no = ?';
    const studentResult = await query(studentSql, [rollno]);

    if (studentResult.length === 0) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    const student = studentResult[0];
    const studentId = student.id;

    // Convert pfp BLOB to base64 data URL if exists
    if (student.pfp) {
      student.pfp = `data:image/jpeg;base64,${student.pfp.toString('base64')}`;
    }

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
