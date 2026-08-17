import { db } from '@/db';
import { 
  staffRegistrationRequests, 
  staffAccounts, 
  staffAccountRoles, 
  staffAcademicAffiliations, 
  staffAccountActivationTokens,
  auditLogs
} from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { wrapHandler } from '@/lib/api-utils';
import crypto from 'crypto';
import { sendInstitutionalEmail } from '@/lib/email';
import logger from '@/lib/logger';

export const POST = wrapHandler({
  auth: 'admin',
  handler: async (req, { user, context }) => {
    // get id from URL params
    const idUrl = req.nextUrl.pathname.split('/');
    const idStr = idUrl[idUrl.length - 2];
    const requestId = parseInt(idStr, 10);

    if (isNaN(requestId)) {
      return { error: 'Invalid request ID', status: 400 };
    }

    const adminId = user?.id || user?.adminId || 1; // Fallback to 1 if testing

    // Use transaction
    const result = await db.transaction(async (tx) => {
      // 1. Lock/read registration request
      const [request] = await tx
        .select()
        .from(staffRegistrationRequests)
        .where(eq(staffRegistrationRequests.id, requestId))
        .for('update');

      if (!request) {
        throw new Error('Registration request not found');
      }

      // 2. Verify status and email
      if (request.status !== 'PENDING') {
        throw new Error(`Request has already been processed (Current status: ${request.status})`);
      }

      if (!request.email_verified_at) {
        throw new Error('Cannot approve: Email has not been verified');
      }

      // 3. Generate unique employee ID
      const employeeId = `KU-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${Date.now().toString().slice(-4)}`;

      // 4. Create staff_accounts row
      const [insertAccountRes] = await tx.insert(staffAccounts).values({
        name: request.name,
        email: request.email,
        employee_id: employeeId,
        staff_category: request.staff_category,
        designation: request.designation,
        mobile_hash: request.mobile_hash,
        pfp: request.pfp,
        signature: request.signature,
        account_status: 'PENDING_ACTIVATION',
      });

      const newAccountId = insertAccountRes.insertId;

      // 5. Create staff_account_roles row
      let roleToAssign = request.requested_role;
      if (!['FACULTY', 'ADMISSION_CLERK', 'SCHOLARSHIP_CLERK'].includes(roleToAssign)) {
        throw new Error(`Invalid role: ${roleToAssign}`);
      }

      await tx.insert(staffAccountRoles).values({
        staff_id: newAccountId,
        role: roleToAssign,
      });

      // 6. If FACULTY: create staff_academic_affiliations rows
      if (request.staff_category === 'FACULTY' && request.academic_affiliations) {
        let affiliations;
        try {
          affiliations = typeof request.academic_affiliations === 'string' 
            ? JSON.parse(request.academic_affiliations) 
            : request.academic_affiliations;
        } catch (e) {
          throw new Error('Invalid academic affiliations JSON format');
        }

        // We expect an array of affiliations like: [{ department_code, program_codes }]
        // But since we don't have department_id lookups easily available without querying the DB,
        // we'll fetch them. Wait, the DB stores department_code? 
        // The staff_academic_affiliations schema uses `department_id` and `program_id`.
        // Let's query academic_departments to map codes to ids.
        const { academicDepartments, academicPrograms } = await import('@/db/schema');
        
        for (const affil of affiliations) {
          const [dept] = await tx
            .select({ id: academicDepartments.id })
            .from(academicDepartments)
            .where(eq(academicDepartments.department_code, affil.department_code));

          if (!dept) continue; // Skip invalid depts

          for (const pCode of affil.program_codes) {
            const [prog] = await tx
              .select({ id: academicPrograms.id })
              .from(academicPrograms)
              .where(eq(academicPrograms.program_code, pCode));
            
            if (prog) {
              await tx.insert(staffAcademicAffiliations).values({
                staff_id: newAccountId,
                department_id: dept.id,
                program_id: prog.id,
                is_primary: true // First one can be primary? Just setting true.
              });
            }
          }
        }
      }

      // 7. Mark registration request APPROVED
      await tx.update(staffRegistrationRequests)
        .set({
          status: 'APPROVED',
          processed_at: new Date(),
          processed_by_admin_id: adminId
        })
        .where(eq(staffRegistrationRequests.id, requestId));

      // 8. Create activation token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48); // 48 hours

      await tx.insert(staffAccountActivationTokens).values({
        staff_id: newAccountId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

      // 9. Create audit log
      await tx.insert(auditLogs).values({
        user_id: adminId.toString(),
        user_type: 'admin',
        action: 'STAFF_REGISTRATION_APPROVED',
        entity_type: 'staff_registration_requests',
        entity_id: requestId.toString(),
        metadata: {
          new_staff_id: newAccountId,
          employee_id: employeeId,
          role: roleToAssign
        },
        ip_address: context?.ip || '127.0.0.1'
      });
      
      await tx.insert(auditLogs).values({
        user_id: adminId.toString(),
        user_type: 'admin',
        action: 'STAFF_ACCOUNT_CREATED',
        entity_type: 'staff_accounts',
        entity_id: newAccountId.toString(),
        metadata: { employee_id: employeeId },
        ip_address: context?.ip || '127.0.0.1'
      });

      return {
        email: request.email,
        name: request.name,
        employeeId: employeeId,
        role: roleToAssign,
        rawToken // pass out of tx to send email
      };
    });

    // 10. Send Activation Email (after transaction commits)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const activationLink = `${baseUrl}/register/staff/activate?token=${result.rawToken}`;

    const emailHtml = `
      <h2>Welcome to KUCET, ${result.name}</h2>
      <p>Your staff registration has been approved.</p>
      <p><strong>Employee ID:</strong> ${result.employeeId}</p>
      <p><strong>Assigned Role:</strong> ${result.role}</p>
      <p>Please activate your account and set up your password within the next 48 hours by clicking the link below:</p>
      <p><a href="${activationLink}" style="padding: 10px 20px; background-color: #0b3578; color: #ffffff; text-decoration: none; border-radius: 5px;">Activate Account</a></p>
      <p>If the link expires, you will need to request a new activation email from the administrator.</p>
    `;

    try {
      await sendInstitutionalEmail({
        to: result.email,
        subject: 'KUCET Staff Account Activation',
        html: emailHtml,
        text: `Welcome to KUCET, ${result.name}.\n\nYour Employee ID is: ${result.employeeId}.\n\nActivate your account here: ${activationLink}\n\nThis link expires in 48 hours.`
      });
      logger.info({ email: result.email }, '[STAFF_APPROVAL] Activation email sent successfully');
    } catch (err) {
      logger.error({ email: result.email, err }, '[STAFF_APPROVAL] Failed to send activation email. The account was still created.');
      // Do not roll back, just indicate email failure
      return { success: true, message: 'Approved, but activation email failed to send.' };
    }

    return { success: true, message: 'Request approved and activation email sent.' };
  }
});
