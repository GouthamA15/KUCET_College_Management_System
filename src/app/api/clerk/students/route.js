import { query } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  const user = await getAuthUser('clerk');

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  try {
    const year = req.nextUrl.searchParams.get('year');
    const branch = req.nextUrl.searchParams.get('branch');

    if (!year || !branch) {
      return apiError('Year and branch are required', 400);
    }

    const yearShort = year.slice(-2);

    const regularRollPattern = `${yearShort}567T${branch}%`;
    const lateralRollPattern = `${yearShort}567${branch}%L`;

    const sql = `
      SELECT * FROM students
      WHERE 
        roll_no LIKE ? OR roll_no LIKE ?
    `;

    const students = await query(sql, [regularRollPattern, lateralRollPattern]);

    return apiResponse({ students });
  } catch (error) {
    console.error('Error fetching students:', error);
    return apiError('Failed to fetch students', 500, error.message);
  }
}

export async function POST(req) {
  const user = await getAuthUser('clerk');

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  try {
    const data = await req.json();
    const {
      admission_no,
      roll_no,
      name,
      father_name,
      mother_name,
      date_of_birth,
      gender,
      religion,
      caste,
      sub_caste,
      category,
      address,
      mobile,
      email,
      qualifying_exam,
      scholarship_status,
      fee_payment_details,
    } = data;

    const sql = `
      INSERT INTO students (
        admission_no, roll_no, name, father_name, mother_name, date_of_birth,
        gender, religion, caste, sub_caste, category, address,
        mobile, email, qualifying_exam,
        scholarship_status, fee_payment_details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      admission_no,
      roll_no,
      name,
      father_name,
      mother_name,
      date_of_birth,
      gender,
      religion,
      caste,
      sub_caste,
      category,
      address,
      mobile,
      email,
      qualifying_exam,
      scholarship_status,
      fee_payment_details,
    ];

    await query(sql, params);

    return apiResponse({ message: 'Student added successfully' }, 201);
  } catch (error) {
    console.error('Error adding student:', error);
    return apiError('Failed to add student', 500, error.message);
  }
}
