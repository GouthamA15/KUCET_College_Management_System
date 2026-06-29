import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { sendInstitutionalEmail } from '@/lib/email';
import { db } from '@/db';
import { students } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { Queue } from '@/lib/queue';

export async function POST(request) {
  try {
    // Security: Only institutional staff (clerks or admins) can send system emails
    let user = await getAuthUser('clerk');
    if (!user) {
      user = await getAuthUser('admin');
    }

    if (!user) {
      return apiError('Unauthorized. Only institutional staff can send emails.', 401);
    }

    const { rollNo, subject, html, title, infoRows } = await request.json();

    if (!rollNo || !subject || !html) {
      return apiError('rollNo, subject, and html body are required', 400);
    }

    // Fetch student's email and verification status from database
    const student = await db.query.students.findFirst({
      where: eq(students.roll_no, rollNo),
      columns: {
        email: true,
        is_email_verified: true
      }
    });

    if (!student) {
      return apiError(`Student with roll number ${rollNo} not found.`, 404);
    }

    const studentEmail = student.email;

    if (!studentEmail) {
      return apiError(`Student with roll number ${rollNo} does not have an email.`, 404);
    }

    // Enforce: college-related emails should only be sent to verified emails
    if (!student.is_email_verified) {
      return apiError('Student email is not verified. Email not sent.', 403);
    }

    const emailResult = await Queue.enqueueEmail(studentEmail, subject, html, title || 'KUCET Notification', Array.isArray(infoRows) ? infoRows : undefined);

    if (emailResult && emailResult.success) {
      return apiResponse({ success: true, message: 'Email queued for sending.' });
    } else if (emailResult === null) {
      // Fallback if QStash is not configured (e.g. local dev without token)
      const directResult = await sendInstitutionalEmail({
        to: studentEmail,
        subject,
        title: title || 'KUCET Notification',
        bodyHtml: html,
        infoRows: Array.isArray(infoRows) ? infoRows : undefined
      });
      if (directResult.success) {
        return apiResponse({ success: true, message: 'Email sent successfully directly.' });
      } else {
        return apiError(directResult.message || 'Failed to send email directly.', 500);
      }
    } else {
      return apiError(emailResult.error || 'Failed to queue email.', 500);
    }
  } catch (error) {
    logger.error('Error in send-student-email API:', error);
    return apiError('An internal server error occurred.', 500);
  }
}
