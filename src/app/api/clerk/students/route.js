import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails, 
  studentAcademicBackground 
} from '@/db/schema';
import { eq, or, like } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const year = req.nextUrl.searchParams.get('year');
    const branch = req.nextUrl.searchParams.get('branch');

    if (!year || !branch) {
      return apiError('Year and branch are required', 400);
    }

    const yearShort = year.slice(-2);
    const regularRollPattern = `${yearShort}567T${branch}%`;
    const lateralRollPattern = `${yearShort}567${branch}%L`;

    const students = await db.select()
      .from(studentsTable)
      .where(or(
        like(studentsTable.roll_no, regularRollPattern),
        like(studentsTable.roll_no, lateralRollPattern)
      ));

    return apiResponse({ students });
  } catch (error) {
    console.error('Error fetching students:', error);
    return apiError('Failed to fetch students', 500, error.message);
  }
}

export async function POST(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const data = await req.json();
    const {
      admission_no, roll_no, name, date_of_birth, gender, mobile, email,
      father_name, mother_name, religion, sub_caste, category, address,
      qualifying_exam
    } = data;

    if (!roll_no || !name) return apiError('Roll number and name are required', 400);

    const [result] = await db.transaction(async (tx) => {
      // 1. Insert into core students table
      const [res] = await tx.insert(studentsTable).values({
        admission_no,
        roll_no,
        name,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
        gender,
        mobile,
        email,
        added_by_clerk_id: user.clerkId || user.id
      });
      const studentId = res.insertId;

      // 2. Insert into personal details
      await tx.insert(studentPersonalDetails).values({
        student_id: studentId,
        father_name,
        mother_name,
        religion,
        sub_caste,
        category,
        address
      });

      // 3. Insert into academic background
      if (qualifying_exam) {
        await tx.insert(studentAcademicBackground).values({
          student_id: studentId,
          qualifying_exam
        });
      }

      return [res];
    });

    return apiResponse({ message: 'Student added successfully', studentId: result.insertId }, 201);
  } catch (error) {
    console.error('Error adding student:', error);
    if (error.code === 'ER_DUP_ENTRY') return apiError('Roll number or Email already exists', 409);
    return apiError('Failed to add student', 500, error.message);
  }
}
