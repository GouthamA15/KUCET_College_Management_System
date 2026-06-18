import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails, 
  studentAcademicBackground 
} from '@/db/schema';
import { eq, like } from 'drizzle-orm';
import { apiError, wrapHandler } from '@/lib/api-utils';
import { decrypt } from '@/lib/encryption';

/**
 * GET /api/clerk/students/search
 * Search students by name, roll no, or admission no
 */
export const GET = wrapHandler({
  auth: 'clerk',
  handler: async (req) => {
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
      condition = eq(studentsTable.roll_no, String(roll_no).trim().toUpperCase());
    } else if (admission_no) {
      condition = eq(studentsTable.admission_no, String(admission_no).trim());
    } else {
      condition = like(studentsTable.name, `%${name}%`);
    }

    const rows = await query.where(condition).limit(100);

    // Deduplicate rows by student ID (row.id) to prevent duplicate records
    const uniqueStudentsMap = new Map();
    for (const row of rows) {
      if (!uniqueStudentsMap.has(row.id)) {
        uniqueStudentsMap.set(row.id, row);
      }
    }
    const uniqueRows = Array.from(uniqueStudentsMap.values());

    // Decrypt sensitive fields
    const students = uniqueRows.map(row => ({
      ...row,
      mobile: row.mobile ? decrypt(row.mobile) : null,
      aadhaar_no: row.aadhaar_no ? decrypt(row.aadhaar_no) : null
    }));

    return { students };
  }
});
