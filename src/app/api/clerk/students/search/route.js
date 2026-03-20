import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails, 
  studentAcademicBackground 
} from '@/db/schema';
import { eq, and, like } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { decrypt } from '@/lib/encryption';

export async function GET(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const url = req.nextUrl;
    const name = url.searchParams.get('name');
    const admission_no = url.searchParams.get('admission_no');
    const roll_no = url.searchParams.get('roll_no');

    if (!name && !admission_no && !roll_no) {
      return apiError('Provide name or admission_no or roll_no', 400);
    }

    const query = db.select({
      id: studentsTable.id,
      roll_no: studentsTable.roll_no,
      admission_no: studentsTable.admission_no,
      name: studentsTable.name,
      email: studentsTable.email,
      mobile: studentsTable.mobile,
      father_name: studentPersonalDetails.father_name,
      mother_name: studentPersonalDetails.mother_name,
      aadhaar_no: studentPersonalDetails.aadhaar_no,
      ssc_marks: studentAcademicBackground.ssc_marks,
      inter_marks: studentAcademicBackground.inter_marks
    })
    .from(studentsTable)
    .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
    .leftJoin(studentAcademicBackground, eq(studentsTable.id, studentAcademicBackground.student_id));

    let condition;
    if (roll_no) {
      condition = eq(studentsTable.roll_no, roll_no);
    } else if (admission_no) {
      condition = eq(studentsTable.admission_no, admission_no);
    } else {
      condition = like(studentsTable.name, `%${name}%`);
    }

    const rows = await query.where(condition).limit(100);

    // Decrypt sensitive fields
    const decryptedRows = rows.map(row => ({
      ...row,
      mobile: decrypt(row.mobile),
      aadhaar_no: decrypt(row.aadhaar_no)
    }));

    return apiResponse({ students: decryptedRows });
  } catch (err) {
    logger.error(err, 'Search students error');
    return apiError('Server error', 500, err.message);
  }
}
