import _logger from '@/lib/logger';
import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails, 
  studentAcademicBackground 
} from '@/db/schema';
import { eq, like, or, isNull, and, sql } from 'drizzle-orm';
import { apiError, wrapHandler } from '@/lib/api-utils';
import { decrypt } from '@/lib/encryption';

/**
 * GET /api/staff/students/search
 * Search students by name, roll no, admission no, apaar_id, or missing_apaar filter
 */
export const GET = wrapHandler({
  auth: 'staff',
  handler: async (req) => {
    const url = req.nextUrl;
    const name = url.searchParams.get('name');
    const admission_no = url.searchParams.get('admission_no');
    const roll_no = url.searchParams.get('roll_no');
    const apaar_id = url.searchParams.get('apaar_id');
    const missing_apaar = url.searchParams.get('missing_apaar') === 'true' || url.searchParams.get('missing_apaar') === '1';
    const count_only = url.searchParams.get('count_only') === 'true' || url.searchParams.get('count_only') === '1';

    if (!name && !admission_no && !roll_no && !apaar_id && !missing_apaar) {
      return apiError('Provide name, admission_no, roll_no, apaar_id, or missing_apaar filter', 400);
    }

    let condition;
    if (roll_no) {
      condition = eq(studentsTable.roll_no, String(roll_no).trim().toUpperCase());
    } else if (admission_no) {
      condition = eq(studentsTable.admission_no, String(admission_no).trim());
    } else if (apaar_id) {
      const cleanApaar = String(apaar_id).replace(/\s+/g, '');
      condition = eq(studentPersonalDetails.apaar_id, cleanApaar);
    } else if (missing_apaar) {
      condition = and(
        eq(studentsTable.student_status, 'ACTIVE'),
        or(
          isNull(studentPersonalDetails.apaar_id),
          eq(studentPersonalDetails.apaar_id, '')
        )
      );
    } else {
      condition = like(studentsTable.name, `%${name}%`);
    }

    if (count_only) {
      const [countResult] = await db.select({ count: sql`count(distinct ${studentsTable.id})` })
        .from(studentsTable)
        .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
        .where(condition);
      return { count: Number(countResult?.count || 0) };
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
      apaar_id: studentPersonalDetails.apaar_id,
      ssc_marks: studentAcademicBackground.ssc_marks,
      inter_marks: studentAcademicBackground.inter_marks
    })
    .from(studentsTable)
    .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
    .leftJoin(studentAcademicBackground, eq(studentsTable.id, studentAcademicBackground.student_id));

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
      aadhaar_no: row.aadhaar_no ? decrypt(row.aadhaar_no) : null,
      apaar_id: row.apaar_id || null
    }));

    return { students };
  }
});
