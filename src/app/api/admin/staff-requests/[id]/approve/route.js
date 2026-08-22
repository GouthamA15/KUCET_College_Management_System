import { db } from '@/db';
import { 
  staffRegistrationRequests, 
  staffAccounts, 
  staffAccountRoles, 
  staffRoles,
  staffAcademicAffiliations, 
  staffAccountActivationTokens,
  auditLogs
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { wrapHandler } from '@/lib/api-utils';
import crypto from 'crypto';
import { sendInstitutionalEmail, getBaseUrl } from '@/lib/email';
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

      const roleToAssign = request.requested_role;
      const [roleRecord] = await tx
        .select()
        .from(staffRoles)
        .where(eq(staffRoles.role_code, roleToAssign));

      if (!roleRecord) {
        throw new Error(`Requested role '${roleToAssign}' does not exist in the system.`);
      }

      await tx.insert(staffAccountRoles).values({
        staff_account_id: newAccountId,
        role_id: roleRecord.id,
        assigned_by: adminId,
      });

      // 6. If FACULTY: create staff_academic_affiliations rows
      if (request.staff_category === 'FACULTY' && request.academic_affiliations) {
        let affiliations;
        try {
          affiliations = typeof request.academic_affiliations === 'string' 
            ? JSON.parse(request.academic_affiliations) 
            : request.academic_affiliations;
        } catch {
          throw new Error('Invalid academic affiliations JSON format');
        }

        const { academicDepartments, academicPrograms } = await import('@/db/schema');
        
        for (const affil of affiliations) {
          if (!affil.department_code) continue;

          let [dept] = await tx
            .select({ id: academicDepartments.id })
            .from(academicDepartments)
            .where(eq(academicDepartments.department_code, affil.department_code));

          if (!dept) {
            const [dRes] = await tx.insert(academicDepartments).values({
              department_code: affil.department_code,
              department_name: affil.department_code,
              is_active: true
            });
            dept = { id: dRes.insertId };
          }

          if (affil.program_codes && affil.program_codes.length > 0) {
            for (const pCode of affil.program_codes) {
              let [prog] = await tx
                .select({ id: academicPrograms.id })
                .from(academicPrograms)
                .where(eq(academicPrograms.program_code, pCode));
              
              if (!prog) {
                const [pRes] = await tx.insert(academicPrograms).values({
                  department_id: dept.id,
                  program_code: pCode,
                  program_name: pCode,
                  is_active: true
                });
                prog = { id: pRes.insertId };
              }

              await tx.insert(staffAcademicAffiliations).values({
                staff_account_id: newAccountId,
                department_id: dept.id,
                program_id: prog.id,
              });
            }
          } else {
            await tx.insert(staffAcademicAffiliations).values({
              staff_account_id: newAccountId,
              department_id: dept.id,
              program_id: null,
            });
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
        staff_account_id: newAccountId,
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
        requestId,
        newAccountId,
        email: request.email,
        name: request.name,
        employeeId: employeeId,
        role: roleToAssign,
        staffCategory: request.staff_category,
        branches: request.staff_category === 'FACULTY' && request.academic_affiliations ? 
          (() => {
            try {
              const aff = typeof request.academic_affiliations === 'string' ? JSON.parse(request.academic_affiliations) : request.academic_affiliations;
              return Array.isArray(aff) ? aff.map(a => a.department_code) : [];
            } catch { return []; }
          })() : [],
        rawToken // pass out of tx to send email
      };
    });

    // Realtime Broadcasts after transaction successfully committed
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      let mappedRole = 'faculty';
      if (result.role === 'ADMISSION_STAFF') mappedRole = 'admission';
      else if (result.role === 'SCHOLARSHIP_STAFF') mappedRole = 'scholarship';

      await broadcastUpdate('STAFF_REGISTRATION_APPROVED', {
        id: result.requestId,
        status: 'APPROVED',
        account_status: 'PENDING_ACTIVATION',
        new_staff_id: result.newAccountId,
        employee_id: result.employeeId,
        processed_at: new Date().toISOString()
      });

      await broadcastUpdate('STAFF_CREATED', {
        id: result.newAccountId,
        name: result.name,
        email: result.email,
        employee_id: result.employeeId,
        roles: [mappedRole],
        branches: result.branches || [],
        is_active: false, // PENDING_ACTIVATION
        is_hod: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } catch (_e) {
      // Non-blocking
    }

    // 10. Send Activation Email (after transaction commits)
    const baseUrl = getBaseUrl();
    const activationLink = `${baseUrl}/register/staff/activate?token=${result.rawToken}`;

    try {
      await sendInstitutionalEmail({
        to: result.email,
        subject: 'KUCET Staff Account Activation',
        title: 'Account Activation',
        bodyHtml: `<p>Welcome to KUCET, <strong>${result.name}</strong>.</p>
                   <p>Your staff registration has been approved. Please activate your account and set up your password.</p>`,
        infoRows: [
          { label: 'Employee ID', value: result.employeeId },
          { label: 'Assigned Role', value: result.role }
        ],
        action: {
          url: activationLink,
          label: 'Activate Account',
          expiresIn: '48 hours'
        }
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
