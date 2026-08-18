import logger from '@/lib/logger';
import { db } from '@/db';
import { staffAccounts, staffAcademicAffiliations, academicDepartments, academicPrograms, facultyHodAssignments } from '@/db/schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser, logAudit } from '@/lib/api-utils';
import { z } from 'zod';

export async function DELETE(req, context) {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const params = await context.params;
    const idNum = parseInt(params.id);

    const staffBefore = await db.query.staffAccounts.findFirst({
      where: eq(staffAccounts.id, idNum)
    });

    if (!staffBefore) {
      return apiError('Staff not found', 404);
    }

    await db.transaction(async (tx) => {
      // 1. Revoke active sessions and refresh tokens
      if (tx.userSessions) {
        await tx.delete(tx.userSessions).where(and(eq(tx.userSessions.user_id, idNum), eq(tx.userSessions.user_type, 'staff')));
      } else {
        await tx.execute(sql`DELETE FROM user_sessions WHERE user_id = ${idNum} AND user_type = 'staff'`);
      }
      
      await tx.execute(sql`DELETE FROM refresh_tokens WHERE user_id = ${idNum.toString()} AND user_type = 'staff'`);

      // 2. Soft-deactivate staff account without dropping data rows (preserves history & allows reactivation)
      const [result] = await tx.update(staffAccounts)
        .set({ account_status: 'SUSPENDED' })
        .where(eq(staffAccounts.id, idNum));
      
      if (result.affectedRows === 0) {
        throw new Error('Failed to deactivate staff account');
      }
    });

    // Audit Log
    await logAudit(req, {
      userId: user.id,
      userType: 'admin',
      action: 'DEACTIVATE_STAFF',
      targetId: idNum,
      targetType: 'staff_accounts',
      before: staffBefore
    });

    return apiResponse({ message: 'Staff account deactivated successfully' });
  } catch (error) {
    logger.error('Error deactivating staff:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function PUT(req, context) {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const params = await context.params;
    const idNum = parseInt(params.id);
    const json = await req.json();

    // Validate with Zod
    const updateSchema = z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      employee_id: z.string().trim().min(1).max(50).optional(),
      is_active: z.boolean().default(true).optional(),
      is_hod: z.boolean().optional(),
      branches: z.array(z.string()).optional()
    });

    const validatedData = updateSchema.parse(json);
    const { name, email, employee_id, is_hod, branches, is_active } = validatedData;

    const staffBefore = await db.query.staffAccounts.findFirst({
      where: eq(staffAccounts.id, idNum)
    });

    if (!staffBefore) {
      return apiError('Staff not found', 404);
    }

    await db.transaction(async (tx) => {
      // 1. Update Staff Accounts
      const updatePayload = {};
      if (name !== undefined) updatePayload.name = name;
      if (email !== undefined) updatePayload.email = email.toLowerCase();
      if (employee_id !== undefined) updatePayload.employee_id = employee_id;
      if (is_active !== undefined) updatePayload.account_status = is_active ? 'ACTIVE' : 'SUSPENDED';
      
      if (Object.keys(updatePayload).length > 0) {
        await tx.update(staffAccounts).set(updatePayload).where(eq(staffAccounts.id, idNum));
      }

      // 2. Handle Branch and HOD Updates (for Faculty)
      if (branches !== undefined || is_hod !== undefined) {
        
        let programData = [];
        let deptCodes = [];
        // If branches is provided, update affiliations
        if (branches !== undefined) {
          // Resolve program IDs and department IDs
          for (const b of branches) {
            const prog = await tx.query.academicPrograms.findFirst({ where: eq(academicPrograms.program_code, b) });
            if (prog) {
              programData.push({ department_id: prog.department_id, program_id: prog.id });
            }
          }

          // Wipe existing affiliations
          await tx.delete(staffAcademicAffiliations).where(eq(staffAcademicAffiliations.staff_account_id, idNum));

          // Insert new affiliations
          for (const p of programData) {
             await tx.insert(staffAcademicAffiliations).values({
               staff_account_id: idNum,
               department_id: p.department_id,
               program_id: p.program_id
             });
          }
          
          const uniqueDeptIds = [...new Set(programData.map(p => p.department_id))];
          for (const dId of uniqueDeptIds) {
             const dept = await tx.query.academicDepartments.findFirst({ where: eq(academicDepartments.id, dId) });
             if (dept) deptCodes.push(dept.department_code);
          }
        } else {
          // We need deptCodes to update HOD status for existing branches if branches wasn't changed
          const existingAffils = await tx.select({ 
              code: academicDepartments.department_code 
            })
            .from(staffAcademicAffiliations)
            .innerJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
            .where(eq(staffAcademicAffiliations.staff_account_id, idNum));
            
          deptCodes = [...new Set(existingAffils.map(a => a.code))];
        }

        // HOD Updates
        if (is_hod !== undefined) {
           if (is_hod === false) {
             // Remove HOD status
             await tx.delete(facultyHodAssignments).where(eq(facultyHodAssignments.staff_account_id, idNum));
             await tx.update(staffAcademicAffiliations).set({ is_hod: false }).where(eq(staffAcademicAffiliations.staff_account_id, idNum));
           } else if (is_hod === true && deptCodes.length > 0) {
             // Add HOD status for all assigned departments
             const { getCurrentCalendarSession } = await import('@/lib/academic-utils');
             const currentSession = await getCurrentCalendarSession();
             
             for (const dCode of deptCodes) {
               // Check if someone else is already HOD for this department
               const existingHOD = await tx.select({ id: staffAccounts.id, name: staffAccounts.name })
                  .from(facultyHodAssignments)
                  .innerJoin(staffAccounts, eq(facultyHodAssignments.staff_account_id, staffAccounts.id))
                  .where(and(
                    eq(facultyHodAssignments.department_code, dCode),
                    eq(staffAccounts.account_status, 'ACTIVE'),
                    ne(staffAccounts.id, idNum)
                  ))
                  .limit(1);

               if (existingHOD.length > 0) {
                  throw new Error(`Conflict: ${existingHOD[0].name} is already the HOD for this department. Please demote them first.`);
               }

               // Check if this user is already HOD
               const alreadyHOD = await tx.query.facultyHodAssignments.findFirst({
                 where: and(eq(facultyHodAssignments.department_code, dCode), eq(facultyHodAssignments.staff_account_id, idNum))
               });

               if (!alreadyHOD) {
                  await tx.insert(facultyHodAssignments).values({
                    staff_account_id: idNum,
                    department_code: dCode,
                    academic_year: currentSession.academic_year,
                    start_date: new Date()
                  });
               }
             }
             await tx.update(staffAcademicAffiliations).set({ is_hod: true }).where(eq(staffAcademicAffiliations.staff_account_id, idNum));
           }
        }
      }
    });

    // Audit Log
    await logAudit(req, {
      userId: user.id,
      userType: 'admin',
      action: 'UPDATE_STAFF',
      targetId: idNum,
      targetType: 'staff_accounts',
      before: staffBefore,
      after: { name, email, employee_id, is_hod, branches, is_active }
    });

    return apiResponse({ message: 'Staff updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    if (error.message && error.message.startsWith('Conflict:')) {
      return apiError(error.message, 400);
    }
    logger.error('Error updating staff:', error);
    if (error && error.code === 'ER_DUP_ENTRY') {
      return apiError('Email or Employee ID already exists', 409);
    }
    return apiError('Internal Server Error', 500);
  }
}

