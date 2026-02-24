import { apiResponse, apiError } from '@/lib/api-utils';
import { sendInstitutionalEmail } from '@/lib/email';
import { query } from '@/lib/db';

export async function POST(request) {
  try {
    const { rollNo, subject, html, title, infoRows } = await request.json();

    if (!rollNo || !subject || !html) {
      return apiError('rollNo, subject, and html body are required', 400);
    }

    // Fetch student's email and verification status from database
    const students = await query('SELECT email, is_email_verified FROM students WHERE roll_no = ?', [rollNo]);
    if (!students || students.length === 0) {
      return apiError(`Student with roll number ${rollNo} not found.`, 404);
    }

    const student = students[0];
    const studentEmail = student.email;

    if (!studentEmail) {
      return apiError(`Student with roll number ${rollNo} does not have an email.`, 404);
    }

    // Enforce: college-related emails should only be sent to verified emails
    if (!student.is_email_verified) {
      return apiError('Student email is not verified. Email not sent.', 403);
    }

    const emailResult = await sendInstitutionalEmail({
      to: studentEmail,
      subject,
      title: title || 'KUCET Notification',
      bodyHtml: html,
      // bodyText: optional, fallback will be derived from HTML
      infoRows: Array.isArray(infoRows) ? infoRows : undefined
    });

    if (emailResult.success) {
      return apiResponse({ success: true, message: 'Email sent successfully.' });
    } else {
      return apiError(emailResult.message || 'Failed to send email.', 500);
    }
  } catch (error) {
    console.error('Error in send-student-email API:', error);
    return apiError('An internal server error occurred.', 500);
  }
}
