import { query } from '@/lib/db';
import bcrypt from 'bcrypt';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { sendEmail } from '@/lib/email';

// Helper function to verify JWT using jose (Edge compatible)
async function verifyJwt(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    console.error('JWT Verification failed:', error);
    return null;
  }
}

// Helper function to generate the HTML content for the clerk account email
const generateClerkAccountEmailHtml = (clerkName, clerkEmail, clerkPassword, clerkRole, employeeId) => {
  const loginUrl = `${process.env.NEXT_PUBLIC_BASE_URL}`;
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="cid:ku_logo@kucet" alt="College Logo" style="max-width: 100px;">
      </div>
      <h2 style="color: #0056b3; text-align: center;">Welcome to KUCET College Management System!</h2>
      <p>Dear ${clerkName},</p>
      <p>Your account as a <strong>${clerkRole}</strong> has been successfully created. You can now log in using the following credentials:</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f2f2f2; font-weight: bold;">Employee ID:</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${employeeId}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f2f2f2; font-weight: bold;">Email:</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${clerkEmail}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f2f2f2; font-weight: bold;">Temporary Password:</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${clerkPassword}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: #f2f2f2; font-weight: bold;">Role:</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${clerkRole}</td>
        </tr>
      </table>
      <p>Please log in using your email and temporary password at the link below and change your password as soon as possible for security reasons:</p>
      <p style="text-align: center;">
        <a href="${loginUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Login to KUCET CMS</a>
      </p>
      <p>If you have any issues, please contact the system administrator.</p>
      <p>Thank you,</p>
      <p>KUCET Administration</p>
      <div style="text-align: center; margin-top: 30px; font-size: 0.8em; color: #777;">
        <p>This is an automated email, please do not reply.</p>
      </div>
    </div>
  `;
};

export async function POST(req) {
  const cookieStore = await cookies();
  const adminAuthCookie = cookieStore.get('admin_auth');
  const token = adminAuthCookie ? adminAuthCookie.value : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded || decoded.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, email, password, employee_id, role } = await req.json();

    if (!name || !email || !password || !employee_id || !role) {
      return new Response(JSON.stringify({ error: 'Name, email, password, employee_id, and role are required' }), { status: 400 });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await query(
      'INSERT INTO clerks (name, email, password_hash, employee_id, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, passwordHash, employee_id, role]
    );

    // Send email with credentials
    const subject = `Your KUCET CMS ${role} Account Credentials`;
    const htmlContent = generateClerkAccountEmailHtml(name, email, password, role, employee_id);
    const emailResult = await sendEmail(email, subject, htmlContent);

    if (!emailResult.success) {
      console.error(`Failed to send welcome email to ${email}: ${emailResult.message}`);
      // Optionally, you might want to log this or store it for retry,
      // but for now, we'll proceed as clerk creation was successful.
    }

    return new Response(JSON.stringify({ success: true, clerkId: result.insertId }), { status: 201 });
  } catch (error) {
    console.error('Error creating clerk:', error);
    // Check for duplicate entry error
    if (error.code === 'ER_DUP_ENTRY') {
      return new Response(JSON.stringify({ error: 'Email already exists' }), { status: 409 });
    }
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}