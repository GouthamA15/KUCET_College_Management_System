import { db } from '@/db';
import { staffRegistrationRequests, staffAccounts, academicDepartments, academicPrograms } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { wrapHandler, apiResponse, apiError } from '@/lib/api-utils';
import { hashForIndex } from '@/lib/encryption';
import { z } from 'zod';
import { jwtVerify } from 'jose';

const schema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email"),
  mobile: z.string().regex(/^\d{10}$/, "Invalid mobile"),
  requested_role: z.enum(['FACULTY', 'ADMISSION_CLERK', 'SCHOLARSHIP_CLERK']),
  designation: z.string().min(1, "Designation is required"),
  verificationToken: z.string().min(1, "Email verification token is required"),
  academic_affiliations: z.array(z.object({
    department_code: z.string(),
    program_codes: z.array(z.string())
  })).optional().default([])
});

const handler = async (req, { data }) => {
  const { fullName, email, mobile, requested_role, designation, verificationToken, academic_affiliations } = data;

  // Verify Email Token
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-do-not-use');
    const { payload } = await jwtVerify(verificationToken, secret);
    
    if (payload.verifiedEmail !== email.trim().toLowerCase() || payload.purpose !== 'staff_registration_email') {
      return apiError('Email verification failed or mismatched email.', 400);
    }
  } catch (_error) {
    return apiError('Invalid or expired email verification token. Please verify your email again.', 400);
  }

  // Enforce role-based academic validation
  if (requested_role === 'FACULTY') {
    if (!academic_affiliations || academic_affiliations.length === 0) {
      return apiError('Faculty must provide academic affiliations.', 400);
    }
    const affil = academic_affiliations[0];
    if (!affil.department_code || !affil.program_codes || affil.program_codes.length === 0) {
      return apiError('Faculty must select a department and at least one program.', 400);
    }

    // Verify department exists and is active
    const deptResult = await db.select().from(academicDepartments)
      .where(and(
        eq(academicDepartments.department_code, affil.department_code),
        eq(academicDepartments.is_active, true)
      ))
      .limit(1)
      .execute();

    if (deptResult.length === 0) {
      return apiError('Invalid or inactive department selected.', 400);
    }
    
    const deptId = deptResult[0].id;

    // Verify all programs exist, are active, and belong to the department
    for (const progCode of affil.program_codes) {
      const progResult = await db.select().from(academicPrograms)
        .where(and(
          eq(academicPrograms.program_code, progCode),
          eq(academicPrograms.department_id, deptId),
          eq(academicPrograms.is_active, true)
        ))
        .limit(1)
        .execute();
        
      if (progResult.length === 0) {
        return apiError(`Invalid program ${progCode} for department ${affil.department_code}.`, 400);
      }
    }
  } else {
    // Non-faculty roles should not have academic affiliations
    if (academic_affiliations && academic_affiliations.length > 0) {
      return apiError('Academic affiliations are not allowed for this role.', 400);
    }
  }

  // Duplicate protection check
  const mobileHash = hashForIndex(mobile);
  
  // Check existing active staff (staffAccounts table)
  const existingStaff = await db.select({ id: staffAccounts.id }).from(staffAccounts)
    .where(eq(staffAccounts.email, email))
    .limit(1)
    .execute();
    
  if (existingStaff.length > 0) {
    return apiError('An active staff account already exists with this email.', 409);
  }

  // Check pending/approved/rejected requests
  const existingRequest = await db.select({ status: staffRegistrationRequests.status }).from(staffRegistrationRequests)
    .where(eq(staffRegistrationRequests.email, email))
    .limit(1)
    .execute();
    
  if (existingRequest.length > 0) {
    const status = existingRequest[0].status;
    if (status === 'PENDING') return apiError('A registration request is already pending for this email.', 409);
    if (status === 'APPROVED') return apiError('A registration request for this email was already approved.', 409);
    if (status === 'REJECTED') return apiError('A previous registration request for this email was rejected.', 409);
  }

  const mappedCategory = requested_role === 'FACULTY' ? 'FACULTY' : 'NON_TEACHING';

  // Insert registration request
  const [insertRes] = await db.insert(staffRegistrationRequests).values({
    name: fullName,
    email: email,
    staff_category: mappedCategory,
    requested_role: requested_role,
    designation: designation,
    mobile_hash: mobileHash,
    academic_affiliations: academic_affiliations,
    email_verified_at: new Date(),
    status: 'PENDING',
  });

  const newRequestId = insertRes?.insertId;

  // Realtime Broadcast for Admin Staff Requests
  try {
    const { broadcastUpdate } = await import('@/lib/sse');
    await broadcastUpdate('STAFF_REGISTRATION_CREATED', {
      id: newRequestId,
      name: fullName,
      email: email,
      staff_category: mappedCategory,
      requested_role: requested_role,
      designation: designation,
      academic_affiliations: academic_affiliations,
      status: 'PENDING',
      created_at: new Date().toISOString()
    });
  } catch (_e) {
    // Non-blocking
  }

  return apiResponse({ message: 'Registration submitted successfully. Your application is now pending administrative verification.' }, 201);
};

export const POST = wrapHandler({
  handler,
  schema
});
