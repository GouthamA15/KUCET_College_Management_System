import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { getStudentEmail } from '@/lib/student-utils'; // Assuming a utility to get student email by rollNo

export async function POST(request) {
  try {
    const { rollNo, subject, html } = await request.json();

    if (!rollNo || !subject || !html) {
      return NextResponse.json({ success: false, message: 'rollNo, subject, and html body are required' }, { status: 400 });
    }

    // In a real application, you would fetch the student's email from the database using rollNo
    // For this example, let's assume a placeholder or a utility function
    const studentEmail = await getStudentEmail(rollNo); // This function needs to be implemented

    if (!studentEmail) {
      return NextResponse.json({ success: false, message: `Student with roll number ${rollNo} not found or email not available.` }, { status: 404 });
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
