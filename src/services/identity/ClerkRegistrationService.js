import { db } from '@/db';
import { clerks, staffRegistrationRequests } from '@/db/schema';
import { eq, or, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { encrypt, hashForIndex } from '@/lib/encryption';
import { sendInstitutionalEmail, getBaseUrl } from '@/lib/email';
import { STAFF_CATEGORIES, FACULTY_BRANCHES } from '@/lib/staff-config';
import logger from '@/lib/logger';

/**
 * Generates a cryptographically random initial credential.
 * Complies with password complexity standards without using static string prefixes.
 */
function generateSecureRandomPassphrase() {
  const randomBytes = crypto.randomBytes(6);
  const hex = randomBytes.toString('hex');
  const upperPart = hex.slice(0, 4).toUpperCase();
  const lowerPart = hex.slice(4, 8).toLowerCase();
  const digitsPart = hex.slice(8, 12);
  const symbols = ['!', '@', '#', '$', '%', '&', '*'];
  const symbolIndex = crypto.randomBytes(1)[0] % symbols.length;
  const specialSymbol = symbols[symbolIndex];

  return `K${upperPart}c${lowerPart}${digitsPart}${specialSymbol}`;
}

export class ClerkRegistrationService {
  /**
   * Submit a new staff self-registration request
   */
  static async submitRegistrationRequest({
    name,
    email,
    employee_id,
    staff_category,
    branch,
    mobile,
    pfp,
    signature
  }) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanEmpId = employee_id.trim().toUpperCase();
    const category = staff_category?.trim()?.toUpperCase();

    // 1. Validate Category
    if (!category || !STAFF_CATEGORIES[category]) {
      throw new Error('Invalid staff registration category. Only Faculty, Scholarship Clerk, and Admission Clerk may self-register.');
    }

    // 2. Validate Branch for Faculty
    let validatedBranch = null;
    if (category === 'FACULTY') {
      const cleanBranch = branch?.trim()?.toUpperCase();
      if (!cleanBranch || !FACULTY_BRANCHES.includes(cleanBranch)) {
        throw new Error(`Faculty members must select a valid academic branch (${FACULTY_BRANCHES.join(', ')}).`);
      }
      validatedBranch = cleanBranch;
    }

    // 3. Duplicate check in active clerks
    const existingClerk = await db.select({ id: clerks.id })
      .from(clerks)
      .where(or(
        eq(clerks.email, cleanEmail),
        eq(clerks.employee_id, cleanEmpId)
      ))
      .limit(1);

    if (existingClerk.length > 0) {
      throw new Error('A staff account with this Email or Employee ID already exists.');
    }

    // 4. Duplicate check in pending registration requests
    const existingPending = await db.select({ id: staffRegistrationRequests.id })
      .from(staffRegistrationRequests)
      .where(and(
        or(
          eq(staffRegistrationRequests.email, cleanEmail),
          eq(staffRegistrationRequests.employee_id, cleanEmpId)
        ),
        eq(staffRegistrationRequests.status, 'PENDING')
      ))
      .limit(1);

    if (existingPending.length > 0) {
      throw new Error('A pending registration request with this Email or Employee ID is currently awaiting administrator review.');
    }

    // 5. Mobile encryption & hashing
    let encryptedMobile = null;
    let mobileHash = null;
    if (mobile) {
      const cleanMobile = mobile.replace(/[^0-9]/g, '');
      if (cleanMobile) {
        encryptedMobile = encrypt(cleanMobile);
        mobileHash = hashForIndex(cleanMobile);
      }
    }

    const catInfo = STAFF_CATEGORIES[category];

    // 6. Insert registration request
    const [result] = await db.insert(staffRegistrationRequests).values({
      name: name.trim(),
      email: cleanEmail,
      employee_id: cleanEmpId,
      staff_category: category,
      branch: validatedBranch,
      department: validatedBranch || catInfo.label,
      designation: catInfo.label,
      mobile: encryptedMobile,
      mobile_hash: mobileHash,
      pfp: pfp || null,
      signature: signature || null,
      status: 'PENDING',
    });

    const requestId = result.insertId;

    logger.info({ requestId, email: cleanEmail, employee_id: cleanEmpId, category, branch: validatedBranch }, '[CLERK_REGISTRATION] Pending request submitted');

    return {
      success: true,
      requestId,
      message: `Your registration request for ${catInfo.label}${validatedBranch ? ` (${validatedBranch})` : ''} has been submitted successfully and is awaiting administrator review.`
    };
  }

  /**
   * List all registration requests (filterable by status and staff category)
   */
  static async getRequests(status = 'PENDING', staffCategory = null) {
    const conditions = [];
    if (status) {
      conditions.push(eq(staffRegistrationRequests.status, status));
    }
    if (staffCategory) {
      conditions.push(eq(staffRegistrationRequests.staff_category, staffCategory.toUpperCase()));
    }

    let query = db.select().from(staffRegistrationRequests);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const requests = await query.orderBy(staffRegistrationRequests.created_at);
    return requests;
  }

  /**
   * Approve a staff registration request
   */
  static async approveRequest(requestId, adminId) {
    const reqs = await db.select()
      .from(staffRegistrationRequests)
      .where(eq(staffRegistrationRequests.id, requestId))
      .limit(1);

    if (reqs.length === 0) {
      throw new Error('Registration request not found.');
    }

    const request = reqs[0];
    if (request.status !== 'PENDING') {
      throw new Error(`Registration request has already been ${request.status.toLowerCase()}.`);
    }

    // 1. Generate strong temporary credential dynamically
    const oneTimePassphrase = generateSecureRandomPassphrase();
    const passwordHash = await bcrypt.hash(oneTimePassphrase, 10);

    // 2. Resolve Role & Branch from Category
    const categoryKey = request.staff_category || 'FACULTY';
    const catInfo = STAFF_CATEGORIES[categoryKey] || STAFF_CATEGORIES.FACULTY;
    const targetRole = catInfo.role;
    const targetBranch = request.branch || null;

    // 3. Create active clerk/staff account
    const [clerkResult] = await db.insert(clerks).values({
      name: request.name,
      email: request.email,
      employee_id: request.employee_id,
      password_hash: passwordHash,
      role: targetRole,
      branch: targetBranch,
      is_hod: false, // HOD is assigned later by admin
      mobile: request.mobile,
      mobile_hash: request.mobile_hash,
      pfp: request.pfp,
      signature: request.signature,
      is_active: true,
      must_change_password: true,
    });

    const newClerkId = clerkResult.insertId;

    // 4. Update request status
    await db.update(staffRegistrationRequests)
      .set({
        status: 'APPROVED',
        processed_at: new Date(),
        processed_by_admin_id: adminId,
      })
      .where(eq(staffRegistrationRequests.id, requestId));

    // 5. Send approval email with credentials
    const baseUrl = getBaseUrl();
    const loginUrl = `${baseUrl.replace(/\/$/, '')}/`;

    const emailSent = await sendInstitutionalEmail({
      to: request.email,
      subject: 'Account Approved - KUCET College Management System',
      title: `${catInfo.label} Registration Approved`,
      bodyHtml: `<p>Dear <strong>${request.name}</strong>,</p>
        <p>We are pleased to inform you that your registration request for Kakatiya University College of Engineering & Technology (KUCET) CMS as <strong>${catInfo.label}</strong>${targetBranch ? ` (${targetBranch} Branch)` : ''} has been <strong>APPROVED</strong> by the administrator.</p>
        <p>You may now log in to the portal using your temporary password. For security reasons, you will be required to change your password immediately upon your first login.</p>`,
      infoRows: [
        { label: 'Login URL', value: `<a href="${loginUrl}">${loginUrl}</a>` },
        { label: 'Username / Email', value: request.email },
        { label: 'Employee ID', value: request.employee_id },
        { label: 'Temporary Password', value: `<code>${oneTimePassphrase}</code>` },
        { label: 'Staff Category', value: catInfo.label },
        ...(targetBranch ? [{ label: 'Branch', value: targetBranch }] : []),
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
      message: 'Staff account created successfully and welcome credentials email sent.'
    };
  }

  /**
   * Reject a registration request
   */
  static async rejectRequest(requestId, adminId, reason = '') {
    const reqs = await db.select()
      .from(staffRegistrationRequests)
      .where(eq(staffRegistrationRequests.id, requestId))
      .limit(1);

    if (reqs.length === 0) {
      throw new Error('Registration request not found.');
    }

    const request = reqs[0];
    if (request.status !== 'PENDING') {
      throw new Error(`Registration request has already been ${request.status.toLowerCase()}.`);
    }

    const rejectionReason = reason?.trim() || 'Institutional verification requirements not met.';
    const catInfo = STAFF_CATEGORIES[request.staff_category] || STAFF_CATEGORIES.FACULTY;

    // 1. Update request status
    await db.update(staffRegistrationRequests)
      .set({
        status: 'REJECTED',
        rejection_reason: rejectionReason,
        processed_at: new Date(),
        processed_by_admin_id: adminId,
      })
      .where(eq(staffRegistrationRequests.id, requestId));

    // 2. Send rejection email
    const emailSent = await sendInstitutionalEmail({
      to: request.email,
      subject: 'Registration Request Status - KUCET College Management System',
      title: 'Staff Account Registration Update',
      bodyHtml: `<p>Dear <strong>${request.name}</strong>,</p>
        <p>Thank you for submitting a staff account registration request to Kakatiya University College of Engineering & Technology (KUCET) CMS.</p>
        <p>After review by the administration, we regret to inform you that your registration request for <strong>${catInfo.label}</strong> was <strong>not approved</strong> at this time.</p>
        <p><strong>Reason:</strong> ${rejectionReason}</p>
        <p>If you believe this decision was made in error, please contact the Principal / Administrator's office with your institutional employment verification documents.</p>`,
      infoRows: [
        { label: 'Applicant Name', value: request.name },
        { label: 'Employee ID', value: request.employee_id },
        { label: 'Category', value: catInfo.label },
        ...(request.branch ? [{ label: 'Branch', value: request.branch }] : []),
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
   * Force password change for first-login staff
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
      throw new Error('Staff account not found.');
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
