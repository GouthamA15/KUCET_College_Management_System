import logger from '@/lib/logger';
import { db } from '@/db';
import { clerks } from '@/db/schema';
import { _eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { sendInstitutionalEmail } from '@/lib/email';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { clerkSchema } from '@/lib/validations/staff';
import { z } from 'zod';

export async function POST(req) {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const json = await req.json();
    
    // Validate with Zod
    const validationSchema = clerkSchema.extend({
      password: z.string().min(8, "Password must be at least 8 characters"),
      employee_id: z.string().trim().min(1, "Employee ID is required").max(50)
    });

    const validatedData = validationSchema.parse(json);
    const { name, email, password, employee_id, role, branch, is_hod } = validatedData;

    // ─── FIX #10: bcrypt cost raised from 10 → 12 ───
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const [result] = await db.insert(clerks).values({
      name,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      employee_id,
      role,
      branch: branch || null,
      is_hod: !!is_hod
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
      logger.error(`Failed to send welcome email to ${email}: ${emailResult.message}`);
    }

    return apiResponse({ success: true, clerkId: result.insertId }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    logger.error('Error creating clerk:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return apiError('Email or Employee ID already exists', 409);
    }
    return apiError('Internal Server Error', 500);
  }
}
