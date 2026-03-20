import logger from '@/lib/logger';
import { db } from '@/db';
import { students, studentPersonalDetails } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function POST(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const { roll_no } = body;
    if (!roll_no) return apiError('roll_no is required', 400);

    const studentRows = await db.select({ id: students.id })
      .from(students)
      .where(eq(students.roll_no, roll_no))
      .limit(1);
    
    if (studentRows.length === 0) return apiError('Student not found', 404);
    const student_id = studentRows[0].id;

    const fields = [
      'father_name','mother_name','nationality','religion','category','sub_caste','area_status','mother_tongue','place_of_birth','father_occupation','annual_income','aadhaar_no','address','seat_allotted_category','identification_marks'
    ];

    const dataObj = {};
    fields.forEach(f => {
      dataObj[f] = body[f] || null;
    });

    await db.insert(studentPersonalDetails)
      .values({ student_id, ...dataObj })
      .onDuplicateKeyUpdate({ set: dataObj });

    return apiResponse({ success: true, message: 'Personal details saved' });
  } catch (err) {
    logger.error('Personal details save error:', err);
    return apiError('Server error', 500, err.message);
  }
}
