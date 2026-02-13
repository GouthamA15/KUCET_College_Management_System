import { query } from '@/lib/db'; // Adjust path if necessary

export async function getStudentEmail(rollNo) {
  try {
    const results = await query('SELECT email FROM students WHERE roll_no = ?', [rollNo]);
    if (results.length > 0 && results[0].email) {
      return String(results[0].email).replace(/\s+/g, '');
    }
    return null;
  } catch (error) {
    console.error('Error fetching student email:', error);
    return null;
  }
}
