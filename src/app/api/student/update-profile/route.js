import logger from '@/lib/logger';
import { db } from '@/db';
import { students, studentPersonalDetails } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { encrypt, hashForIndex } from '@/lib/encryption';
import { studentUpdateSchema } from '@/lib/validations/student';
import { z } from 'zod';

export async function POST(req) {
  const user = await getAuthUser('student');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const json = await req.json();
    const rollno = user.roll_no;
    if (!rollno) return apiError('Missing roll_no in session', 400);

    // Validate with Zod
    const validation = studentUpdateSchema.extend({
      phone: z.string().transform(v => v.replace(/\D/g, '')).refine(v => v === '' || v.length === 10).nullable().optional(),
    }).safeParse(json);

    if (!validation.success) {
      return apiError(validation.error.errors[0].message, 400);
    }

    const validatedData = validation.data;

    const student = await db.query.students.findFirst({
      columns: { id: true },
      where: eq(students.roll_no, rollno)
    });

    if (!student) return apiError('Student not found', 404);
    const student_id = student.id;

    // 1. Update mobile in students table if provided (Encrypted + Hash)
    if (validatedData.phone) {
      await db.update(students)
        .set({ 
            mobile: encrypt(validatedData.phone),
            mobile_hash: hashForIndex(validatedData.phone)
        })
        .where(eq(students.roll_no, rollno));
    }
    
    // 2. Handle personal details
    const fields = [
      'father_name','mother_name','nationality','religion','category','sub_caste','area_status','mother_tongue','place_of_birth','father_occupation','annual_income','aadhaar_no','address','seat_allotted_category','identification_marks', 'guardian_mobile'
    ];

    const updateObj = {};
    fields.forEach(f => {
      if (validatedData.hasOwnProperty(f)) {
        let value = validatedData[f] || null;
        
        // Encrypt sensitive fields before saving
        if (value && (f === 'aadhaar_no' || f === 'guardian_mobile')) {
          value = encrypt(value);
          // Special case: also update blind index for aadhaar
          if (f === 'aadhaar_no') {
              updateObj['aadhaar_hash'] = hashForIndex(validatedData[f]);
          }
        }
        
        updateObj[f] = value;
      }
    });

    if (Object.keys(updateObj).length > 0) {
      await db.insert(studentPersonalDetails)
        .values({ student_id, ...updateObj })
        .onDuplicateKeyUpdate({ set: updateObj });
    }

    return apiResponse({ success: true, message: "Profile updated successfully" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return apiError(err.errors[0].message, 400);
    }
    logger.error(err, "Update profile error");
    return apiError('Server error', 500, err.message);
  }
}
