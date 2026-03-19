import { db } from '@/db';
import { clerks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { sendInstitutionalEmail } from '@/lib/email';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function POST(req) {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const { name, email, password, employee_id, role } = await req.json();

    if (!name || !email || !password || !employee_id || !role) {
      return apiError('Name, email, password, employee_id, and role are required', 400);
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const [result] = await db.insert(clerks).values({
      name,
      email,
      password_hash: passwordHash,
      employee_id,
      role
    });

    const subject = `Your KUCET CMS ${role} Account Credentials`;
    const title = 'Account Activation';
    const bodyHtml = `
      <p>Dear ${name},</p>
      <p>Your account for the KUCET College Management System has been created.</p>
      <p>Please find your account details below. Keep these credentials confidential and change your password after first login.</p>
    `;

    const emailResult = await sendInstitutionalEmail({
      to: email,
      subject,
      title,
      bodyHtml,
      infoRows: [
        { label: 'Name', value: name },
        { label: 'Email', value: email },
        { label: 'Employee ID', value: employee_id },
        { label: 'Role', value: role },
        { label: 'Temporary Password', value: password }
      ]
    });

    if (!emailResult.success) {
      console.error(`Failed to send welcome email to ${email}: ${emailResult.message}`);
    }

    return apiResponse({ success: true, clerkId: result.insertId }, 201);
  } catch (error) {
    console.error('Error creating clerk:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return apiError('Email or Employee ID already exists', 409);
    }
    return apiError('Internal Server Error', 500);
  }
}
