import { db } from '@/db';
import { clerks, clerkRegistrationRequests } from '@/db/schema';
import { eq, or, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { encrypt, hashForIndex } from '@/lib/encryption';
import { sendInstitutionalEmail, getBaseUrl } from '@/lib/email';
import logger from '@/lib/logger';

export class ClerkRegistrationService {
  /**
   * Submit a new clerk self-registration request
   */
  static async submitRegistrationRequest({
    name,
    email,
    employee_id,
    department,
    designation,
    mobile,
    pfp,
    signature
  }) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanEmpId = employee_id.trim().toUpperCase();

    // 1. Duplicate check in active clerks
    const existingClerk = await db.select({ id: clerks.id })
      .from(clerks)
      .where(or(
        eq(clerks.email, cleanEmail),
        eq(clerks.employee_id, cleanEmpId)
      ))
      .limit(1);

    if (existingClerk.length > 0) {
      throw new Error('A clerk account with this Email or Employee ID already exists.');
    }

    // 2. Duplicate check in pending registration requests
    const existingPending = await db.select({ id: clerkRegistrationRequests.id })
      .from(clerkRegistrationRequests)
      .where(and(
        or(
          eq(clerkRegistrationRequests.email, cleanEmail),
          eq(clerkRegistrationRequests.employee_id, cleanEmpId)
        ),
        eq(clerkRegistrationRequests.status, 'PENDING')
      ))
      .limit(1);

    if (existingPending.length > 0) {
      throw new Error('A pending registration request with this Email or Employee ID is currently awaiting administrator review.');
    }

    // 3. Mobile encryption & hashing
    let encryptedMobile = null;
    let mobileHash = null;
    if (mobile) {
      const cleanMobile = mobile.replace(/[^0-9]/g, '');
      if (cleanMobile) {
        encryptedMobile = encrypt(cleanMobile);
        mobileHash = hashForIndex(cleanMobile);
      }
    }

    // 4. Insert registration request
    const [result] = await db.insert(clerkRegistrationRequests).values({
      name: name.trim(),
      email: cleanEmail,
      employee_id: cleanEmpId,
      department: department.trim(),
      designation: designation.trim(),
      mobile: encryptedMobile,
      mobile_hash: mobileHash,
      pfp: pfp || null,
      signature: signature || null,
      status: 'PENDING',
    });

    const requestId = result.insertId;

    logger.info({ requestId, email: cleanEmail, employee_id: cleanEmpId }, '[CLERK_REGISTRATION] Pending request submitted');

    return {
      success: true,
      requestId,
      message: 'Your registration request has been submitted successfully and is pending administrator approval.'
    };
  }

  /**
   * List all clerk registration requests (filterable by status)
   */
  static async getRequests(status = 'PENDING') {
    const query = db.select().from(clerkRegistrationRequests);
    if (status) {
      query.where(eq(clerkRegistrationRequests.status, status));
    }
    const requests = await query.orderBy(clerkRegistrationRequests.created_at);
    return requests;
  }

  /**
   * Approve a clerk registration request
   */
  static async approveRequest(requestId, adminId) {
    const reqs = await db.select()
      .from(clerkRegistrationRequests)
      .where(eq(clerkRegistrationRequests.id, requestId))
      .limit(1);

    if (reqs.length === 0) {
      throw new Error('Registration request not found.');
    }

    const request = reqs[0];
    if (request.status !== 'PENDING') {
      throw new Error(`Registration request has already been ${request.status.toLowerCase()}.`);
    }

    // 1. Generate strong temporary password
    const rawTempPassword = `Kucet@${crypto.randomBytes(4).toString('hex').toUpperCase()}!`;
    const passwordHash = await bcrypt.hash(rawTempPassword, 10);

    // 2. Map department to role
    const deptRoleMap = {
      'SCHOLARSHIP': 'scholarship',
      'EXAMINATIONS': 'examinations',
      'ACADEMIC': 'academic',
      'ADMISSION': 'admission',
      'CSE': 'clerk',
      'ECE': 'clerk',
      'EEE': 'clerk',
      'MECH': 'clerk',
      'CIVIL': 'clerk',
    };
    const mappedRole = deptRoleMap[request.department.toUpperCase()] || 'scholarship';

    // 3. Create active clerk account
    const [clerkResult] = await db.insert(clerks).values({
      name: request.name,
      email: request.email,
      employee_id: request.employee_id,
      password_hash: passwordHash,
      role: mappedRole,
      branch: request.department,
      mobile: request.mobile,
      mobile_hash: request.mobile_hash,
      pfp: request.pfp,
      signature: request.signature,
      is_active: true,
      must_change_password: true,
    });

    const newClerkId = clerkResult.insertId;

    // 4. Update request status
    await db.update(clerkRegistrationRequests)
      .set({
        status: 'APPROVED',
        processed_at: new Date(),
        processed_by_admin_id: adminId,
      })
      .where(eq(clerkRegistrationRequests.id, requestId));

    // 5. Send approval email with login credentials
    const baseUrl = getBaseUrl();
    const loginUrl = `${baseUrl.replace(/\/$/, '')}/`;

    const emailSent = await sendInstitutionalEmail({
      to: request.email,
      subject: 'Account Approved - KUCET College Management System',
      title: 'Clerk Account Registration Approved',
      bodyHtml: `<p>Dear <strong>${request.name}</strong>,</p>
        <p>We are pleased to inform you that your registration request for Kakatiya University College of Engineering & Technology (KUCET) CMS has been <strong>APPROVED</strong> by the administrator.</p>
        <p>You may now log in to the portal using your temporary password. For security reasons, you will be required to change your password immediately upon your first login.</p>`,
      infoRows: [
        { label: 'Login URL', value: `<a href="${loginUrl}">${loginUrl}</a>` },
        { label: 'Username / Email', value: request.email },
        { label: 'Employee ID', value: request.employee_id },
        { label: 'Temporary Password', value: `<code>${rawTempPassword}</code>` },
        { label: 'Department', value: request.department },
        { label: 'Designation', value: request.designation },
      ],
      action: {
        url: loginUrl,
        label: 'Log In Now',
        expiresIn: '7 days'
      }
    });

    logger.info({ requestId, newClerkId, email: request.email, emailSent }, '[CLERK_REGISTRATION] Approved request & sent credentials');

    return {
      success: true,
      clerkId: newClerkId,
      emailSent: !!emailSent?.success,
      message: 'Clerk account created successfully and welcome credentials email sent.'
    };
  }

  /**
   * Reject a clerk registration request
   */
  static async rejectRequest(requestId, adminId, reason = '') {
    const reqs = await db.select()
      .from(clerkRegistrationRequests)
      .where(eq(clerkRegistrationRequests.id, requestId))
      .limit(1);

    if (reqs.length === 0) {
      throw new Error('Registration request not found.');
    }

    const request = reqs[0];
    if (request.status !== 'PENDING') {
      throw new Error(`Registration request has already been ${request.status.toLowerCase()}.`);
    }

    const rejectionReason = reason?.trim() || 'Institutional verification requirements not met.';

    // 1. Update request status
    await db.update(clerkRegistrationRequests)
      .set({
        status: 'REJECTED',
        rejection_reason: rejectionReason,
        processed_at: new Date(),
        processed_by_admin_id: adminId,
      })
      .where(eq(clerkRegistrationRequests.id, requestId));

    // 2. Send rejection email
    const emailSent = await sendInstitutionalEmail({
      to: request.email,
      subject: 'Registration Request Status - KUCET College Management System',
      title: 'Clerk Account Registration Update',
      bodyHtml: `<p>Dear <strong>${request.name}</strong>,</p>
        <p>Thank you for submitting a clerk account registration request to Kakatiya University College of Engineering & Technology (KUCET) CMS.</p>
        <p>After review by the administration, we regret to inform you that your registration request was <strong>not approved</strong> at this time.</p>
        <p><strong>Reason:</strong> ${rejectionReason}</p>
        <p>If you believe this decision was made in error, please contact the Principal / Administrator's office with your institutional employment verification documents.</p>`,
      infoRows: [
        { label: 'Applicant Name', value: request.name },
        { label: 'Employee ID', value: request.employee_id },
        { label: 'Department', value: request.department },
        { label: 'Status', value: 'REJECTED' },
      ]
    });

    logger.info({ requestId, email: request.email, emailSent }, '[CLERK_REGISTRATION] Rejected request');

    return {
      success: true,
      message: 'Registration request has been rejected and notice email sent.'
    };
  }

  /**
   * Force password change for first-login clerks
   */
  static async changePassword(clerkId, currentPassword, newPassword) {
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long.');
    }

    const clerkRows = await db.select()
      .from(clerks)
      .where(eq(clerks.id, clerkId))
      .limit(1);

    if (clerkRows.length === 0) {
      throw new Error('Clerk account not found.');
    }

    const clerk = clerkRows[0];
    const passwordMatch = await bcrypt.compare(currentPassword, clerk.password_hash);
    if (!passwordMatch) {
      throw new Error('Current password is incorrect.');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(clerks)
      .set({
        password_hash: newHash,
        must_change_password: false,
        password_changed_at: new Date(),
      })
      .where(eq(clerks.id, clerkId));

    logger.info({ clerkId }, '[CLERK_REGISTRATION] Password changed successfully');

    return {
      success: true,
      message: 'Password updated successfully. You may now continue using the system.'
    };
  }
}
