import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails, 
  studentAcademicBackground,
  studentImages,
  studentSignatures
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { toMySQLDate } from '@/lib/date';
import { validateRollNo } from '@/lib/rollNumber';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { COLLEGE_CONFIG } from '@/lib/college-config';
import { encrypt, hashForIndex } from '@/lib/encryption';

export async function POST(req) {
  const user = await getAuthUser('clerk');
  if (!user || user.role !== 'admission') {
    return apiError('Forbidden: Only admission clerks can add students', 403);
  }

  try {
    const studentData = await req.json();
    const {
      admission_no, roll_no, name, father_name, mother_name, date_of_birth,
      place_of_birth, gender, nationality, religion, sub_caste, category,
      address, mobile, email, qualifying_exam, mother_tongue, father_occupation,
      student_aadhar_no, identification_marks, annual_income, guardian_mobile,
      aadhaar_no, seat_allotted_category, area_status, previous_college_details,
      medium_of_instruction, ranks, ssc_marks, inter_marks, blood_group,
      fee_reimbursement, pfp, signature
    } = studentData;

    const providedRoll = roll_no || studentData.rollno || null;
    if (!providedRoll) return apiError('Roll number is required', 400);

    const { isValid } = validateRollNo(providedRoll);
    if (!isValid) return apiError('Invalid roll number format', 400);

    const clerkId = user?.clerkId || user.id || null;
    if (!clerkId) return apiError('Unauthorized: clerk id missing in token', 401);

    const validBloodGroups = COLLEGE_CONFIG.bloodGroups;
    const bloodGroupToSave = blood_group && String(blood_group).trim() ? String(blood_group).trim() : null;
    if (bloodGroupToSave && !validBloodGroups.includes(bloodGroupToSave)) {
      return apiError('Invalid blood group value', 400);
    }

    const feeReimbursementToSave = fee_reimbursement == null ? null : String(fee_reimbursement).trim().toUpperCase();
    if (feeReimbursementToSave && !['YES', 'NO', 'GOV'].includes(feeReimbursementToSave)) {
      return apiError('Invalid fee_reimbursement value', 400);
    }

    const result = await db.transaction(async (tx) => {
      const existing = await tx.select({ id: studentsTable.id })
        .from(studentsTable)
        .where(eq(studentsTable.roll_no, providedRoll))
        .limit(1);
      
      if (existing.length > 0) throw new Error('STUDENT_EXISTS');

      const [res] = await tx.insert(studentsTable).values({
        admission_no: admission_no || null,
        roll_no: providedRoll,
        name: name || null,
        date_of_birth: toMySQLDate(date_of_birth) ? new Date(toMySQLDate(date_of_birth)) : null,
        gender: gender || null,
        mobile: mobile ? encrypt(mobile) : null,
        mobile_hash: mobile ? hashForIndex(mobile) : null,
        email: email || null,
        added_by_clerk_id: clerkId,
        fee_reimbursement: feeReimbursementToSave === 'YES' ? 'YES' : 'NO'
      });
      const studentId = res.insertId;

      const rawAadhaar = (student_aadhar_no || aadhaar_no || '') + '';
      const aadhaarToSave = rawAadhaar.replace(/\D/g, '').slice(0, 12) || null;

      await tx.insert(studentPersonalDetails).values({
        student_id: studentId,
        father_name: father_name || null,
        mother_name: mother_name || null,
        nationality: nationality || null,
        religion: religion || null,
        category: category || null,
        sub_caste: sub_caste || null,
        area_status: area_status === 'Local' ? 'Local' : 'Non-Local',
        mother_tongue: mother_tongue || null,
        place_of_birth: place_of_birth || null,
        father_occupation: father_occupation || null,
        annual_income: annual_income == null ? null : String(annual_income).trim() || null,
        guardian_mobile: guardian_mobile ? encrypt(guardian_mobile) : null,
        aadhaar_no: aadhaarToSave ? encrypt(aadhaarToSave) : null,
        aadhaar_hash: aadhaarToSave ? hashForIndex(aadhaarToSave) : null,
        address: address || null,
        seat_allotted_category: seat_allotted_category || null,
        identification_marks: identification_marks || null,
        blood_group: bloodGroupToSave
      });

      await tx.insert(studentAcademicBackground).values({
        student_id: studentId,
        qualifying_exam: qualifying_exam || null,
        previous_college_details: previous_college_details || null,
        medium_of_instruction: medium_of_instruction || null,
        ranks: ranks ? parseInt(ranks) : null,
        ssc_marks: ssc_marks || null,
        inter_marks: inter_marks || null
      });

      if (pfp && typeof pfp === 'string' && pfp.includes(',')) {
        await tx.insert(studentImages).values({ student_id: studentId, pfp: pfp });
      }
      if (signature && typeof signature === 'string' && signature.includes(',')) {
        await tx.insert(studentSignatures).values({ student_id: studentId, signature: signature });
      }

      return { studentId };
    });

    return apiResponse({ success: true, studentId: result.studentId, roll_no: providedRoll, message: 'Student admitted successfully.' });

  } catch (error) {
    if (error.message === 'STUDENT_EXISTS') return apiError('Student with this Roll Number already exists.', 409);
    logger.error(error, 'Error adding student');
    return apiError('Internal Server Error', 500);
  }
}
