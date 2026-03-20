import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails, 
  studentAcademicBackground,
  studentImages,
  studentSignatures,
  scholarshipSanctions,
  studentFeePayments
} from '@/db/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { toMySQLDate } from '@/lib/date';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { computeAcademicYear } from '@/app/lib/academicYear';
import { getBranchFromRoll, getAdmissionTypeFromRoll } from '@/lib/rollNumber';

export async function GET(req, context) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const params = await context.params;
    const { rollno } = params;

    const rows = await db.select()
      .from(studentsTable)
      .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
      .leftJoin(studentAcademicBackground, eq(studentsTable.id, studentAcademicBackground.student_id))
      .where(eq(studentsTable.roll_no, rollno))
      .limit(1);

    if (rows.length === 0) return apiError('Student not found', 404);

    const studentRow = rows[0];
    const studentId = studentRow.students.id;

    // Helper to handle both URLs and legacy Buffer data
    const imageHelper = (val) => {
      if (!val) return null;
      if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:'))) return val;
      if (Buffer.isBuffer(val)) return `data:image/png;base64,${val.toString('base64')}`;
      return val;
    };

    const student = {
      ...studentRow.students,
      personal_details: studentRow.student_personal_details || {},
      course: getBranchFromRoll(studentRow.students.roll_no),
      admission_type: getAdmissionTypeFromRoll(studentRow.students.roll_no)
    };

    const academics = studentRow.student_academic_background ? [studentRow.student_academic_background] : [];

    // Fetch pfp and signature
    const pfpRow = await db.query.studentImages.findFirst({ where: eq(studentImages.student_id, studentId) });
    student.pfp = pfpRow ? imageHelper(pfpRow.pfp) : null;

    const sigRow = await db.query.studentSignatures.findFirst({ where: eq(studentSignatures.student_id, studentId) });
    student.signature = sigRow ? imageHelper(sigRow.signature) : null;

    // Fetch one-to-many relationships
    const scholarshipRows = await db.query.scholarshipSanctions.findMany({
      where: eq(scholarshipSanctions.student_id, studentId),
      orderBy: [asc(scholarshipSanctions.sanction_date)]
    });
    const scholarship = scholarshipRows.map(s => ({
      ...s,
      academic_year: s.academic_year || (s.year ? computeAcademicYear(student.roll_no, s.year) : null),
    }));

    const feesRows = await db.query.studentFeePayments.findMany({
      where: eq(studentFeePayments.student_id, studentId),
      orderBy: [asc(studentFeePayments.academic_year), asc(studentFeePayments.transaction_date)]
    });
    const fees = feesRows.map(f => ({
      ...f,
      transaction_ref: f.transaction_ref_no,
      date: f.transaction_date,
    }));

    return apiResponse({ student, scholarship, fees, academics });
  } catch (error) {
    logger.error('Error fetching student profile data:', error);
    return apiError('Failed to fetch student profile data', 500, error.message);
  }
}

export async function PUT(req, context) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const params = await context.params;
    const { rollno } = params;
    const body = await req.json();
    const { name, gender, mobile, email, date_of_birth } = body;

    if (!rollno) return apiError('Roll number is required', 400);

    const [result] = await db.update(studentsTable)
      .set({
        name: name !== undefined ? (name === '' ? null : name) : undefined,
        gender: gender !== undefined ? (gender === '' ? null : gender) : undefined,
        mobile: mobile !== undefined ? (mobile === '' ? null : mobile) : undefined,
        email: email !== undefined ? (email === '' ? null : email) : undefined,
        date_of_birth: date_of_birth !== undefined ? (date_of_birth === '' ? null : new Date(date_of_birth)) : undefined
      })
      .where(eq(studentsTable.roll_no, rollno));

    if (result.affectedRows === 0) return apiError('Student not found or no changes made', 404);

    return apiResponse({ success: true, message: 'Student details updated successfully' });
  } catch (err) {
    logger.error('Update Student Error:', err);
    return apiError('Server error', 500, err.message);
  }
}
