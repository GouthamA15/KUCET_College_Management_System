import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }
    
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const currentRollno = searchParams.get('currentRollno'); // Optional: student's own rollno

    if (!email) {
      return apiError('Email is required', 400);
    }

    let queryString = `SELECT roll_no FROM students WHERE email = ?`;
    let queryParams = [email];

    // If currentRollno is provided, exclude the student's own email from the check
    if (currentRollno) {
      queryString += ` AND roll_no != ?`;
      queryParams.push(currentRollno);
    }

    const rows = await query(queryString, queryParams);

    if (rows.length > 0) {
      return apiResponse({ isUnique: false, message: 'This email is already registered to another student.' });
    }

    return apiResponse({ isUnique: true, message: 'Email is available.' });
  } catch (error) {
    console.error('Error checking email uniqueness:', error);
    return apiError('Server error', 500);
  }
}
