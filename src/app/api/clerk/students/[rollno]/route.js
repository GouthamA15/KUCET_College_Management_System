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
import { encrypt, decrypt, hashForIndex } from '@/lib/encryption';
import { studentUpdateSchema } from '@/lib/validations/student';

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
      mobile: decrypt(studentRow.students.mobile), // Decrypt student mobile
      personal_details: studentRow.student_personal_details ? {
        ...studentRow.student_personal_details,
        guardian_mobile: decrypt(studentRow.student_personal_details.guardian_mobile), // Decrypt guardian mobile
        aadhaar_no: decrypt(studentRow.student_personal_details.aadhaar_no) // Decrypt Aadhaar
      } : {},
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
    logger.error(error, 'Error fetching student profile data for clerk');
    return apiError('Failed to fetch student profile data', 500, error.message);
  }
}

export async function PUT(req, context) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const params = await context.params;
    const { rollno } = params;
    if (!rollno) return apiError('Roll number is required', 400);

    const body = await req.json();
    
    // 1. Validate Input using Zod
    const validation = studentUpdateSchema.safeParse(body);
    if (!validation.success) {
      const details = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      return apiError('Validation failed', 400, details);
    }

    const data = validation.data;
    const { name, gender, mobile, email, date_of_birth } = data;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (gender !== undefined) updateData.gender = gender;
    if (email !== undefined) updateData.email = email;
    if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth ? new Date(date_of_birth) : null;

    if (mobile !== undefined) {
        if (!mobile) {
            updateData.mobile = null;
            updateData.mobile_hash = null;
        } else {
            updateData.mobile = encrypt(mobile);
            updateData.mobile_hash = hashForIndex(mobile);
        }
    }

    const [result] = await db.update(studentsTable)
      .set(updateData)
      .where(eq(studentsTable.roll_no, rollno));

    if (result.affectedRows === 0) return apiError('Student not found or no changes made', 404);

    return apiResponse({ success: true, message: 'Student details updated successfully' });
  } catch (err) {
    logger.error(err, 'Update Student Error');
    return apiError('Server error', 500, err.message);
  }
}
