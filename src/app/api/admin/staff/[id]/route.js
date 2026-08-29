import logger from '@/lib/logger';
import { db } from '@/db';
import { staffAccounts, staffAcademicAffiliations, academicDepartments, academicPrograms, facultyHodAssignments, staffRoles, staffAccountRoles, semesters, auditLogs } from '@/db/schema';
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

    // Realtime Broadcast
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      await broadcastUpdate('STAFF_STATUS_CHANGED', {
        id: idNum,
        is_active: false,
        account_status: 'SUSPENDED',
        updated_at: new Date().toISOString()
      });
    } catch (_e) {
      // Non-blocking
    }

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
        let deptCodes = [];
        
        // If branches is provided, update affiliations
        if (branches !== undefined) {
          const affiliationsToInsert = [];

          for (const b of branches) {
            // First check if b matches a department directly (e.g. 'CSE')
            let dept = await tx.query.academicDepartments.findFirst({
              where: eq(academicDepartments.department_code, b)
            });

            // If not found, check if b is a program code (e.g. 'CSE' program under a dept)
            let prog = await tx.query.academicPrograms.findFirst({
              where: eq(academicPrograms.program_code, b)
            });

            if (!dept && prog) {
              dept = await tx.query.academicDepartments.findFirst({
                where: eq(academicDepartments.id, prog.department_id)
              });
            }

            // If department record does not exist at all, create it dynamically
            if (!dept) {
              const [insertedDept] = await tx.insert(academicDepartments).values({
                department_code: b,
                department_name: b,
                is_active: true
              });
              dept = { id: insertedDept.insertId, department_code: b };
            }

            affiliationsToInsert.push({
              staff_account_id: idNum,
              department_id: dept.id,
              program_id: prog?.id || null
            });

            if (dept.department_code && !deptCodes.includes(dept.department_code)) {
              deptCodes.push(dept.department_code);
            }
          }

          // Wipe existing affiliations
          await tx.delete(staffAcademicAffiliations).where(eq(staffAcademicAffiliations.staff_account_id, idNum));

          // Insert new affiliations
          for (const affil of affiliationsToInsert) {
            await tx.insert(staffAcademicAffiliations).values(affil);
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
             const [hodRoleDef] = await tx.select().from(staffRoles).where(eq(staffRoles.role_code, 'HOD'));
             if (!hodRoleDef) throw new Error('HOD role definition not found in staff_roles table');
  
             if (is_hod === false) {
               // 1. Remove HOD role
               await tx.delete(staffAccountRoles).where(
                 and(
                   eq(staffAccountRoles.staff_account_id, idNum),
                   eq(staffAccountRoles.role_id, hodRoleDef.id)
                 )
               );
               
               // 2. Deactivate active HOD assignments (Do NOT delete history!)
               await tx.update(facultyHodAssignments)
                 .set({ is_active: false })
                 .where(
                   and(
                     eq(facultyHodAssignments.staff_account_id, idNum),
                     eq(facultyHodAssignments.is_active, true)
                   )
                 );
                 
               // 3. Audit log handled via logAudit below, but let's record a DB-level one for strictness
               await tx.insert(auditLogs).values({
                 user_id: user.id,
                 user_type: 'admin',
                 action: 'HOD_ACCESS_DISABLED',
                 target_type: 'STAFF_ACCOUNT',
                 target_id: String(idNum),
                 payload_after: { action: 'Removed HOD role and deactivated active assignments' },
                 ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
                 user_agent: req.headers.get('user-agent') || 'system'
               });
             } else if (is_hod === true) {
               // Validate staff is ACTIVE
               if (staffBefore.account_status !== 'ACTIVE' && is_active !== true) {
                 throw new Error('Cannot enable HOD access for an inactive staff account.');
               }
               
               // Validate staff has FACULTY role
               const hasFaculty = await tx.select().from(staffAccountRoles)
                 .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
                 .where(and(eq(staffAccountRoles.staff_account_id, idNum), eq(staffRoles.role_code, 'FACULTY')));
               if (hasFaculty.length === 0) {
                 throw new Error('Staff must have the FACULTY role to be assigned as HOD.');
               }

               // Resolve departments
               if (deptCodes.length === 0) {
                  const existingAffils = await tx.select({ dept: academicDepartments.department_code }).from(staffAcademicAffiliations)
                    .innerJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
                    .where(eq(staffAcademicAffiliations.staff_account_id, idNum));
                  deptCodes = existingAffils.map(a => a.dept);
               }
               if (deptCodes.length === 0) {
                 throw new Error('Cannot assign HOD: Staff member has no assigned departments.');
               }

               const { getCurrentCalendarSession } = await import('@/lib/academic-utils');
               const currentSession = await getCurrentCalendarSession();

               // Get semester dates
               const semesterRows = await tx.select().from(semesters).where(eq(semesters.academic_year, currentSession.academicYear));
               let minStart = null, maxEnd = null;
               if (semesterRows.length > 0) {
                 minStart = semesterRows[0].start_date;
                 maxEnd = semesterRows[0].end_date;
                 for (const sem of semesterRows) {
                   if (sem.start_date < minStart) minStart = sem.start_date;
                   if (sem.end_date > maxEnd) maxEnd = sem.end_date;
                 }
               }
               
               for (const dCode of deptCodes) {
                 // Prevent duplicate active HODs
                 const existingHOD = await tx.select({ id: staffAccounts.id, name: staffAccounts.name })
                    .from(facultyHodAssignments)
                    .innerJoin(staffAccounts, eq(facultyHodAssignments.staff_account_id, staffAccounts.id))
                    .where(and(
                      eq(facultyHodAssignments.department_code, dCode),
                      eq(facultyHodAssignments.academic_year, currentSession.academicYear),
                      eq(facultyHodAssignments.is_active, true),
                      ne(staffAccounts.id, idNum)
                    ))
                    .limit(1);
  
                 if (existingHOD.length > 0) {
                    throw new Error(`Conflict: ${existingHOD[0].name} is already the active HOD for ${dCode} in ${currentSession.academicYear}. Please disable them first.`);
                 }
  
                 // Check for existing assignment history to reactivate
                 const alreadyHOD = await tx.query.facultyHodAssignments.findFirst({
                   where: and(
                     eq(facultyHodAssignments.department_code, dCode), 
                     eq(facultyHodAssignments.academic_year, currentSession.academicYear),
                     eq(facultyHodAssignments.staff_account_id, idNum)
                   )
                 });
  
                 if (!alreadyHOD) {
                    if (!minStart) throw new Error(`Academic session ${currentSession.academicYear} not found in semesters`);
                    await tx.insert(facultyHodAssignments).values({
                      staff_account_id: idNum,
                      department_code: dCode,
                      academic_year: currentSession.academicYear,
                      start_date: minStart instanceof Date ? minStart.toISOString().split('T')[0] : minStart,
                      end_date: maxEnd instanceof Date ? maxEnd.toISOString().split('T')[0] : maxEnd,
                      is_active: true,
                      assigned_by: user.id
                    });
                 } else if (!alreadyHOD.is_active) {
                    await tx.update(facultyHodAssignments).set({
                      is_active: true
                    }).where(eq(facultyHodAssignments.id, alreadyHOD.id));
                 }
               }
               
               // Ensure they have the HOD role exactly once
               const existingHodRole = await tx.select().from(staffAccountRoles).where(
                 and(
                   eq(staffAccountRoles.staff_account_id, idNum),
                   eq(staffAccountRoles.role_id, hodRoleDef.id)
                 )
               );
               if (existingHodRole.length === 0) {
                 await tx.insert(staffAccountRoles).values({
                   staff_account_id: idNum,
                   role_id: hodRoleDef.id,
                   assigned_by: user.id
                 });
               }

               await tx.insert(auditLogs).values({
                 user_id: user.id,
                 user_type: 'admin',
                 action: 'HOD_ACCESS_ENABLED',
                 target_type: 'STAFF_ACCOUNT',
                 target_id: String(idNum),
                 payload_after: { action: 'Granted HOD role and activated assignments' },
                 ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
                 user_agent: req.headers.get('user-agent') || 'system'
               });
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

    // Realtime Broadcast
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      await broadcastUpdate('STAFF_UPDATED', {
        id: idNum,
        name: name !== undefined ? name : staffBefore.name,
        email: email !== undefined ? email.toLowerCase() : staffBefore.email,
        employee_id: employee_id !== undefined ? employee_id : staffBefore.employee_id,
        is_active: is_active !== undefined ? is_active : (staffBefore.account_status === 'ACTIVE'),
        is_hod: is_hod,
        branches: branches,
        updated_at: new Date().toISOString()
      });
    } catch (_e) {
      // Non-blocking
    }

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

