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

import { StudentService } from '@/services/StudentService';

export async function POST(req) {
  const user = await getAuthUser('clerk');
  if (!user || user.role !== 'admission') {
    return apiError('Forbidden: Only admission clerks can add students', 403);
  }

  try {
    const studentData = await req.json();
    const providedRoll = String(studentData.roll_no || studentData.rollno || '').trim().toUpperCase();
    if (!providedRoll) return apiError('Roll number is required', 400);

    const { isValid } = validateRollNo(providedRoll);
    if (!isValid) return apiError('Invalid roll number format', 400);

    const clerkId = user?.clerkId || user.id || null;
    if (!clerkId) return apiError('Unauthorized: clerk id missing in token', 401);

    // Validation for specialized fields
    if (studentData.blood_group && !COLLEGE_CONFIG.bloodGroups.includes(studentData.blood_group)) {
      return apiError('Invalid blood group value', 400);
    }
    if (studentData.fee_reimbursement && !['YES', 'NO'].includes(String(studentData.fee_reimbursement).toUpperCase())) {
      return apiError('Invalid fee_reimbursement value', 400);
    }

    const studentId = await StudentService.upsertStudent(studentData, clerkId);

    return apiResponse({ success: true, studentId, roll_no: providedRoll, message: 'Student admitted successfully.' });

  } catch (error) {
    if (error.message === 'STUDENT_EXISTS') return apiError('Student with this Roll Number already exists.', 409);
    if (error.message === 'MISSING_REQUIRED_FIELDS') return apiError('Roll number and name are required.', 400);
    logger.error(error, 'Error adding student');
    return apiError('Internal Server Error', 500);
  }
}
