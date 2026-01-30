import { query } from '@/lib/db'; // Adjust path if necessary

export async function getStudentEmail(rollNo) {
  try {
    const results = await query('SELECT email FROM students WHERE roll_no = ?', [rollNo]);
    if (results.length > 0) {
      return results[0].email;
    }
    return null;
  } catch (error) {
    console.error('Error fetching student email:', error);
    return null;
  }
}
