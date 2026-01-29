import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { query } from '@/lib/db';

export async function POST(request) {
  try {
    const { rollNo, subject, html } = await request.json();

    if (!rollNo || !subject || !html) {
      return NextResponse.json({ success: false, message: 'rollNo, subject, and html body are required' }, { status: 400 });
    }

    // Fetch student's email and verification status from database
    const students = await query('SELECT email, is_email_verified FROM students WHERE roll_no = ?', [rollNo]);
    if (!students || students.length === 0) {
      return NextResponse.json({ success: false, message: `Student with roll number ${rollNo} not found.` }, { status: 404 });
    }

    const student = students[0];
    const studentEmail = student.email;

    if (!studentEmail) {
      return NextResponse.json({ success: false, message: `Student with roll number ${rollNo} does not have an email.` }, { status: 404 });
    }

    // Enforce: college-related emails should only be sent to verified emails
    if (!student.is_email_verified) {
      return NextResponse.json({ success: false, message: 'Student email is not verified. Email not sent.' }, { status: 403 });
    }

    const emailResult = await sendEmail(studentEmail, subject, html);

    if (emailResult.success) {
      return NextResponse.json({ success: true, message: 'Email sent successfully.' });
    } else {
      return NextResponse.json({ success: false, message: emailResult.message || 'Failed to send email.' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in send-student-email API:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}
