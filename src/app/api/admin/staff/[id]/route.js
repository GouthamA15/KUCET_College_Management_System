import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { db } from '@/db';
import { staffAccounts, staffAcademicAffiliations, academicDepartments, academicPrograms, facultyHodAssignments, facultyCoordinatorAssignments, staffRoles, staffAccountRoles, semesters, auditLogs, systemConfigs } from '@/db/schema';
import { eq, and, ne, sql, inArray } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser, logAudit } from '@/lib/api-utils';
import { isValidFacultyBranch } from '@/lib/staff-config';
import { z } from 'zod';

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

/**
 * Sanitizes staff before payload to prevent storing password hashes and bloated base64 blobs in audit logs
 */
function sanitizeStaffForAudit(staff) {
  if (!staff || typeof staff !== 'object') return staff;
  const sanitized = { ...staff };
  delete sanitized.password_hash;
  if (typeof sanitized.pfp === 'string' && sanitized.pfp.length > 255) {
    sanitized.pfp = `${sanitized.pfp.substring(0, 32)}...[truncated]`;
  }
  if (typeof sanitized.signature === 'string' && sanitized.signature.length > 255) {
    sanitized.signature = `${sanitized.signature.substring(0, 32)}...[truncated]`;
  }
  return sanitized;
}

export async function GET(req, context) {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const params = await context.params;
    const idNum = parseInt(params?.id, 10);
    if (isNaN(idNum) || idNum <= 0) {
      return apiError('Invalid staff ID', 400);
    }

    const staff = await db.query.staffAccounts.findFirst({
      where: eq(staffAccounts.id, idNum),
    });

    if (!staff) {
      return apiError('Staff not found', 404);
    }

    // Resolve roles
    const rolesData = await db.select({
      role_code: staffRoles.role_code,
    })
      .from(staffAccountRoles)
      .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
      .where(eq(staffAccountRoles.staff_account_id, idNum));

    const roles = new Set();
    let isPrincipal = false;
    for (const r of rolesData) {
      if (r.role_code) {
        let mappedRole = 'faculty';
        if (r.role_code === 'ADMISSION_STAFF') mappedRole = 'admission';
        else if (r.role_code === 'SCHOLARSHIP_STAFF') mappedRole = 'scholarship';
        else if (r.role_code === 'PRINCIPAL') {
          isPrincipal = true;
        }
        roles.add(mappedRole);
      }
    }

    // Resolve branches
    const affilData = await db.select({
      branch: sql`COALESCE(${academicPrograms.program_code}, ${academicDepartments.department_code})`.as('branch'),
    })
      .from(staffAcademicAffiliations)
      .leftJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
      .leftJoin(academicPrograms, eq(staffAcademicAffiliations.program_id, academicPrograms.id))
      .where(eq(staffAcademicAffiliations.staff_account_id, idNum));

    const branches = new Set();
    for (const a of affilData) {
      if (a.branch) branches.add(a.branch);
    }

    // Resolve active HOD assignments
    const hodRows = await db.select({
      dept: facultyHodAssignments.department_code,
      academic_year: facultyHodAssignments.academic_year,
    })
      .from(facultyHodAssignments)
      .where(and(
        eq(facultyHodAssignments.staff_account_id, idNum),
        eq(facultyHodAssignments.is_active, true)
      ));

    const hodBranches = Array.from(new Set(hodRows.map(h => h.dept)));

    // Resolve active Coordinator assignment
    const todayStr = new Date().toISOString().split('T')[0];
    const coordRows = await db.select({
      id: facultyCoordinatorAssignments.id,
      coordinator_type: facultyCoordinatorAssignments.coordinator_type,
      academic_year: facultyCoordinatorAssignments.academic_year,
      start_date: facultyCoordinatorAssignments.start_date,
      end_date: facultyCoordinatorAssignments.end_date,
    })
      .from(facultyCoordinatorAssignments)
      .where(and(
        eq(facultyCoordinatorAssignments.staff_account_id, idNum),
        eq(facultyCoordinatorAssignments.is_active, true)
      ));

    let activeCoord = null;
    for (const c of coordRows) {
      if (c.start_date && todayStr < c.start_date) continue;
      if (c.end_date && todayStr > c.end_date) continue;
      activeCoord = c;
      break;
    }

    const formattedStaff = {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      employee_id: staff.employee_id,
      staff_category: staff.staff_category,
      designation: staff.designation,
      is_active: staff.account_status === 'ACTIVE',
      account_status: staff.account_status,
      roles: Array.from(roles),
      branches: Array.from(branches),
      hod_branches: hodBranches,
      is_hod: hodBranches.length > 0,
      is_principal: isPrincipal,
      is_first_year_coordinator: !!activeCoord,
      coordinator_assignment: activeCoord,
      created_at: staff.created_at,
      updated_at: staff.updated_at,
    };

    return apiResponse({ data: formattedStaff });
  } catch (error) {
    logger.error('Error fetching staff record:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function DELETE(req, context) {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const params = await context.params;
    const idNum = parseInt(params?.id, 10);
    if (isNaN(idNum) || idNum <= 0) {
      return apiError('Invalid staff ID', 400);
    }

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
      before: sanitizeStaffForAudit(staffBefore)
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
    const idNum = parseInt(params?.id, 10);
    if (isNaN(idNum) || idNum <= 0) {
      return apiError('Invalid staff ID', 400);
    }

    const clientIp = (req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || '127.0.0.1').trim().slice(0, 45);
    const userAgent = (req.headers.get('user-agent') || 'system').slice(0, 500);

    const json = await req.json();

    // Validate with Zod
    const updateSchema = z.object({
      name: z.string().trim().min(1, 'Name cannot be empty').max(100).optional(),
      email: z.string().trim().email('Invalid email address').optional(),
      employee_id: z.string().trim().min(1, 'Employee ID cannot be empty').max(50).optional(),
      is_active: z.boolean().default(true).optional(),
      is_hod: z.boolean().optional(),
      hod_branches: z.array(z.string()).optional(),
      is_principal: z.boolean().optional(),
      reassign_branches: z.array(z.string()).optional(),
      branches: z.array(z.string()).optional(),
      roles: z.array(z.string()).optional(),
      is_first_year_coordinator: z.boolean().optional(),
      coordinator_start_date: z.string().optional(),
      coordinator_end_date: z.string().optional().nullable()
    });

    const validatedData = updateSchema.parse(json);
    const { 
      name, email, employee_id, is_active, 
      is_hod, hod_branches, is_principal, reassign_branches, 
      branches, roles,
      is_first_year_coordinator, coordinator_start_date, coordinator_end_date
    } = validatedData;

    if (branches !== undefined) {
      if (!Array.isArray(branches)) {
        return apiError('Branches must be an array of branch codes', 400);
      }
      for (const b of branches) {
        if (!isValidFacultyBranch(b.toUpperCase().trim())) {
          return apiError(`Invalid branch: ${b}`, 400);
        }
      }
    }

    if (hod_branches !== undefined) {
      if (!Array.isArray(hod_branches)) {
        return apiError('HOD branches must be an array of branch codes', 400);
      }
      for (const b of hod_branches) {
        if (!isValidFacultyBranch(b.toUpperCase().trim())) {
          return apiError(`Invalid HOD branch: ${b}`, 400);
        }
      }
    }

    const staffBefore = await db.query.staffAccounts.findFirst({
      where: eq(staffAccounts.id, idNum)
    });

    if (!staffBefore) {
      return apiError('Staff not found', 404);
    }

    await db.transaction(async (tx) => {
      // 1. Update Staff Account Details & Status
      const updatePayload = {};
      if (name !== undefined) updatePayload.name = name.trim();
      if (email !== undefined) updatePayload.email = email.toLowerCase().trim();
      if (employee_id !== undefined) updatePayload.employee_id = employee_id.trim();
      if (is_active !== undefined) {
        updatePayload.account_status = is_active ? 'ACTIVE' : 'SUSPENDED';
        if (is_active === false) {
          // Revoke active sessions and refresh tokens on deactivation
          if (tx.userSessions) {
            await tx.delete(tx.userSessions).where(and(eq(tx.userSessions.user_id, idNum), eq(tx.userSessions.user_type, 'staff')));
          } else {
            await tx.execute(sql`DELETE FROM user_sessions WHERE user_id = ${idNum} AND (user_type = 'staff' OR user_type = 'STAFF')`);
          }
          await tx.execute(sql`DELETE FROM refresh_tokens WHERE user_id = ${idNum.toString()} AND user_type = 'staff'`);
        }
      }
      
      if (Object.keys(updatePayload).length > 0) {
        await tx.update(staffAccounts).set(updatePayload).where(eq(staffAccounts.id, idNum));
      }

      // 1.5 Handle Role Shifting (Teaching vs Non-Teaching)
      if (roles !== undefined) {
        const currentRolesData = await tx.select({ role_code: staffRoles.role_code })
          .from(staffAccountRoles)
          .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
          .where(eq(staffAccountRoles.staff_account_id, idNum));
            
        const currentRoles = currentRolesData.map(r => r.role_code.toLowerCase());
        const isTeaching = currentRoles.includes('faculty');
        
        const newRoles = roles.map(r => {
          const lower = r.toLowerCase();
          if (lower === 'admission') return 'admission_staff';
          if (lower === 'scholarship') return 'scholarship_staff';
          return lower;
        });
        
        if (isTeaching && !newRoles.includes('faculty')) {
          throw new ValidationError('Teaching roles (faculty) cannot be shifted to non-teaching roles.');
        }
        if (!isTeaching && newRoles.includes('faculty')) {
          throw new ValidationError('Non-teaching roles cannot be shifted to teaching roles.');
        }

        const allRolesDef = await tx.select().from(staffRoles);
        const newRoleIds = allRolesDef.filter(r => newRoles.includes(r.role_code.toLowerCase())).map(r => r.id);
        const hodRoleDef = allRolesDef.find(r => r.role_code.toUpperCase() === 'HOD');
        const principalRoleDef = allRolesDef.find(r => r.role_code.toUpperCase() === 'PRINCIPAL');
        const preserveRoleIds = [hodRoleDef?.id, principalRoleDef?.id].filter(Boolean);
        
        // Clear old basic roles while preserving HOD and PRINCIPAL designations
        if (preserveRoleIds.length > 0) {
          await tx.delete(staffAccountRoles).where(and(
            eq(staffAccountRoles.staff_account_id, idNum), 
            sql`${staffAccountRoles.role_id} NOT IN (${sql.join(preserveRoleIds.map(id => sql`${id}`), sql`, `)})`
          ));
        } else {
          await tx.delete(staffAccountRoles).where(eq(staffAccountRoles.staff_account_id, idNum));
        }

        // Insert new roles
        for (const rId of newRoleIds) {
          const alreadyHas = await tx.select().from(staffAccountRoles).where(and(
            eq(staffAccountRoles.staff_account_id, idNum),
            eq(staffAccountRoles.role_id, rId)
          ));
          if (alreadyHas.length === 0) {
            await tx.insert(staffAccountRoles).values({ staff_account_id: idNum, role_id: rId, assigned_by: user.id });
          }
        }
      }

      // 2. Handle Academic Branch Affiliations (Independently from HOD)
      if (branches !== undefined) {
        const affiliationsToInsert = [];

        for (const b of branches) {
          let dept = await tx.query.academicDepartments.findFirst({
            where: eq(academicDepartments.department_code, b)
          });

          let prog = await tx.query.academicPrograms.findFirst({
            where: eq(academicPrograms.program_code, b)
          });

          if (!dept && prog) {
            dept = await tx.query.academicDepartments.findFirst({
              where: eq(academicDepartments.id, prog.department_id)
            });
          }

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
        }

        // Wipe existing affiliations and insert new
        await tx.delete(staffAcademicAffiliations).where(eq(staffAcademicAffiliations.staff_account_id, idNum));
        for (const affil of affiliationsToInsert) {
          await tx.insert(staffAcademicAffiliations).values(affil);
        }
      }

      // 3. Handle Principal-Level Supervisory Designation
      if (is_principal !== undefined) {
        let [principalRoleDef] = await tx.select().from(staffRoles).where(eq(staffRoles.role_code, 'PRINCIPAL'));
        if (!principalRoleDef) {
          const [ins] = await tx.insert(staffRoles).values({
            role_code: 'PRINCIPAL',
            role_name: 'Principal / Academic Supervisor',
            description: 'Principal-level institutional supervisor with oversight across all seven branches: CSE, IT, CSD, ECE, EEE, CIVIL, and MECH'
          });
          principalRoleDef = { id: ins.insertId };
        }

        if (is_principal === true) {
          const existingPrincipalRole = await tx.select().from(staffAccountRoles).where(and(
            eq(staffAccountRoles.staff_account_id, idNum),
            eq(staffAccountRoles.role_id, principalRoleDef.id)
          ));
          if (existingPrincipalRole.length === 0) {
            await tx.insert(staffAccountRoles).values({
              staff_account_id: idNum,
              role_id: principalRoleDef.id,
              assigned_by: user.id
            });
            await tx.insert(auditLogs).values({
              user_id: user.id,
              user_type: 'admin',
              action: 'PRINCIPAL_ROLE_ASSIGNED',
              target_type: 'staff_accounts',
              target_id: String(idNum),
              payload_after: { designation: 'Institutional Principal Role Assigned' },
              ip_address: clientIp,
              user_agent: userAgent
            });
          }
        } else {
          await tx.delete(staffAccountRoles).where(and(
            eq(staffAccountRoles.staff_account_id, idNum),
            eq(staffAccountRoles.role_id, principalRoleDef.id)
          ));
          await tx.insert(auditLogs).values({
            user_id: user.id,
            user_type: 'admin',
            action: 'PRINCIPAL_ROLE_REVOKED',
            target_type: 'staff_accounts',
            target_id: String(idNum),
            payload_after: { designation: 'Institutional Principal Role Revoked' },
            ip_address: clientIp,
            user_agent: userAgent
          });

          // If this staff member held the designated supervisor role, safely revoke it
          try {
            const [activeCfg] = await tx.select().from(systemConfigs).where(and(
              eq(systemConfigs.config_key, 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID'),
              eq(systemConfigs.config_value, String(idNum))
            )).limit(1);

            if (activeCfg) {
              await tx.update(systemConfigs).set({
                config_value: 'REVOKED',
                updated_by: String(user.id),
                updated_at: new Date()
              }).where(eq(systemConfigs.config_key, 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID'));

              await tx.update(systemConfigs).set({
                config_value: '',
                updated_by: String(user.id),
                updated_at: new Date()
              }).where(eq(systemConfigs.config_key, 'DESIGNATED_ACADEMIC_SUPERVISOR_EMAIL'));

              await tx.insert(auditLogs).values({
                user_id: user.id,
                user_type: 'admin',
                action: 'ACADEMIC_SUPERVISOR_REVOKED',
                target_type: 'system_configs',
                target_id: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID',
                payload_before: { staff_id: idNum },
                payload_after: { status: 'REVOKED', reason: 'Principal role revoked' },
                ip_address: clientIp,
                user_agent: userAgent
              });
            }
          } catch (_cfgErr) {
            // Non-fatal if systemConfigs is temporarily unavailable
          }
        }
      }

      // 4. Handle Branch-Specific HOD Appointments
      const isHodSpecified = (hod_branches !== undefined || is_hod !== undefined);
      if (isHodSpecified) {
        let [hodRoleDef] = await tx.select().from(staffRoles).where(eq(staffRoles.role_code, 'HOD'));
        if (!hodRoleDef) {
          const [insH] = await tx.insert(staffRoles).values({
            role_code: 'HOD',
            role_name: 'Head of Department',
            description: 'Department-level academic management and faculty oversight'
          });
          hodRoleDef = { id: insH.insertId };
        }

        // Determine target HOD branches
        let targetHodBranches = [];
        if (hod_branches !== undefined) {
          targetHodBranches = Array.from(new Set(hod_branches.map(b => b.toUpperCase().trim()).filter(Boolean)));
        } else if (is_hod === false) {
          targetHodBranches = [];
        } else if (is_hod === true) {
          // Backward compatibility fallback: use branches or existing affiliations
          if (branches && branches.length > 0) {
            targetHodBranches = Array.from(new Set(branches.map(b => b.toUpperCase().trim()).filter(Boolean)));
          } else {
            const existingAffils = await tx.select({ code: academicDepartments.department_code })
              .from(staffAcademicAffiliations)
              .innerJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
              .where(eq(staffAcademicAffiliations.staff_account_id, idNum));
            targetHodBranches = Array.from(new Set(existingAffils.map(a => a.code)));
          }
        }

        if (targetHodBranches.length > 0) {
          // Validate staff is ACTIVE
          if (staffBefore.account_status !== 'ACTIVE' && is_active !== true) {
            throw new ValidationError('Cannot enable HOD access for an inactive staff account.');
          }

          // Validate staff has FACULTY role
          const hasFaculty = await tx.select().from(staffAccountRoles)
            .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
            .where(and(eq(staffAccountRoles.staff_account_id, idNum), eq(staffRoles.role_code, 'FACULTY')));
          if (hasFaculty.length === 0) {
            throw new ValidationError('Staff must have the FACULTY role to be assigned as HOD.');
          }
        }

        const { getCurrentCalendarSession } = await import('@/lib/academic-utils');
        const currentSession = await getCurrentCalendarSession().catch(() => null);
        const currentAcademicYear = currentSession?.academicYear || '2026-27';

        // Get semester dates for default window
        const semesterRows = await tx.select().from(semesters).where(eq(semesters.academic_year, currentAcademicYear));
        let minStart = null, maxEnd = null;
        if (semesterRows.length > 0) {
          minStart = semesterRows[0].start_date;
          maxEnd = semesterRows[0].end_date;
          for (const sem of semesterRows) {
            if (sem.start_date < minStart) minStart = sem.start_date;
            if (sem.end_date > maxEnd) maxEnd = sem.end_date;
          }
        }
        const todayStr = new Date().toISOString().split('T')[0];

        // Fetch existing active HOD assignments for this staff member
        const currentStaffHodRows = await tx.select().from(facultyHodAssignments).where(and(
          eq(facultyHodAssignments.staff_account_id, idNum),
          eq(facultyHodAssignments.is_active, true)
        ));
        const currentStaffHodDepts = currentStaffHodRows.map(r => r.department_code);

        // Process each target HOD branch
        for (const dCode of targetHodBranches) {
          // Check for conflicting active HOD for this branch and academic year
          const existingHOD = await tx.select({ 
            id: staffAccounts.id, 
            name: staffAccounts.name 
          })
          .from(facultyHodAssignments)
          .innerJoin(staffAccounts, eq(facultyHodAssignments.staff_account_id, staffAccounts.id))
          .where(and(
            eq(facultyHodAssignments.department_code, dCode),
            eq(facultyHodAssignments.academic_year, currentAcademicYear),
            eq(facultyHodAssignments.is_active, true),
            ne(facultyHodAssignments.staff_account_id, idNum)
          ))
          .limit(1);

          if (existingHOD.length > 0) {
            const isReassignConfirmed = Boolean(reassign_branches && reassign_branches.includes(dCode));
            if (!isReassignConfirmed) {
              const conflictErr = new Error(`Conflict: ${existingHOD[0].name} is already the active HOD for ${dCode} in ${currentAcademicYear}. Please confirm reassignment to replace them.`);
              conflictErr.conflictDetails = {
                conflict: true,
                branch: dCode,
                current_hod: existingHOD[0].name,
                academic_year: currentAcademicYear
              };
              throw conflictErr;
            }

            // Safe transactional reassignment:
            // 1. Deactivate existing active HOD assignment for this branch without disabling account or other duties
            await tx.update(facultyHodAssignments).set({
              is_active: false,
              end_date: todayStr
            }).where(and(
              eq(facultyHodAssignments.department_code, dCode),
              eq(facultyHodAssignments.academic_year, currentAcademicYear),
              eq(facultyHodAssignments.is_active, true),
              ne(facultyHodAssignments.staff_account_id, idNum)
            ));

            // 2. Check if the previous HOD has any remaining active HOD assignments
            const prevRemaining = await tx.select({ id: facultyHodAssignments.id })
              .from(facultyHodAssignments)
              .where(and(
                eq(facultyHodAssignments.staff_account_id, existingHOD[0].id),
                eq(facultyHodAssignments.is_active, true)
              ));

            if (prevRemaining.length === 0) {
              // Also check if they are designated as PRINCIPAL
              const isPrincipalCheck = await tx.select().from(staffAccountRoles)
                .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
                .where(and(
                  eq(staffAccountRoles.staff_account_id, existingHOD[0].id),
                  eq(staffRoles.role_code, 'PRINCIPAL')
                ));
              if (isPrincipalCheck.length === 0) {
                await tx.delete(staffAccountRoles).where(and(
                  eq(staffAccountRoles.staff_account_id, existingHOD[0].id),
                  eq(staffAccountRoles.role_id, hodRoleDef.id)
                ));
              }
            }

            // 3. Record audit log for HOD reassignment
            await tx.insert(auditLogs).values({
              user_id: user.id,
              user_type: 'admin',
              action: 'HOD_BRANCH_REASSIGNED',
              target_type: 'faculty_hod_assignments',
              target_id: String(idNum),
              payload_before: { 
                previous_hod_id: existingHOD[0].id, 
                previous_hod_name: existingHOD[0].name, 
                branch: dCode, 
                academic_year: currentAcademicYear 
              },
              payload_after: { 
                new_hod_id: idNum, 
                new_hod_name: staffBefore.name, 
                branch: dCode, 
                academic_year: currentAcademicYear 
              },
              ip_address: clientIp,
              user_agent: userAgent
            });
          }

          // Check if this staff member already has an assignment record for this branch & year
          const alreadyHOD = await tx.query.facultyHodAssignments.findFirst({
            where: and(
              eq(facultyHodAssignments.department_code, dCode), 
              eq(facultyHodAssignments.academic_year, currentAcademicYear),
              eq(facultyHodAssignments.staff_account_id, idNum)
            )
          });

          if (!alreadyHOD) {
            await tx.insert(facultyHodAssignments).values({
              staff_account_id: idNum,
              department_code: dCode,
              academic_year: currentAcademicYear,
              start_date: minStart instanceof Date ? minStart.toISOString().split('T')[0] : (minStart || todayStr),
              end_date: maxEnd instanceof Date ? maxEnd.toISOString().split('T')[0] : maxEnd,
              is_active: true,
              assigned_by: user.id
            });
          } else if (!alreadyHOD.is_active) {
            await tx.update(facultyHodAssignments).set({
              is_active: true,
              end_date: maxEnd instanceof Date ? maxEnd.toISOString().split('T')[0] : maxEnd
            }).where(eq(facultyHodAssignments.id, alreadyHOD.id));
          }
        }

        // Deactivate assignments for branches that were removed
        const removedBranches = currentStaffHodDepts.filter(b => !targetHodBranches.includes(b));
        if (removedBranches.length > 0) {
          await tx.update(facultyHodAssignments).set({
            is_active: false,
            end_date: todayStr
          }).where(and(
            eq(facultyHodAssignments.staff_account_id, idNum),
            eq(facultyHodAssignments.is_active, true),
            inArray(facultyHodAssignments.department_code, removedBranches)
          ));
        }

        // Update HOD role in staffAccountRoles
        if (targetHodBranches.length > 0) {
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
        } else {
          // If no active HOD branches remain, remove HOD role (unless they are Principal)
          const isPrincipalStill = await tx.select().from(staffAccountRoles)
            .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
            .where(and(
              eq(staffAccountRoles.staff_account_id, idNum),
              eq(staffRoles.role_code, 'PRINCIPAL')
            ));
          if (isPrincipalStill.length === 0) {
            await tx.delete(staffAccountRoles).where(
              and(
                eq(staffAccountRoles.staff_account_id, idNum),
                eq(staffAccountRoles.role_id, hodRoleDef.id)
              )
            );
          }
        }

        await tx.insert(auditLogs).values({
          user_id: user.id,
          user_type: 'admin',
          action: targetHodBranches.length > 0 ? 'HOD_ACCESS_UPDATED' : 'HOD_ACCESS_DISABLED',
          target_type: 'STAFF_ACCOUNT',
          target_id: String(idNum),
          payload_after: { targetHodBranches },
          ip_address: clientIp,
          user_agent: userAgent
        });
      }

      // 5. Handle First Year Coordinator Appointment
      if (is_first_year_coordinator !== undefined) {
        const todayStr = new Date().toISOString().split('T')[0];
        const { getCurrentCalendarSession } = await import('@/lib/academic-utils');
        const currentSession = await getCurrentCalendarSession().catch(() => null);
        const currentAcademicYear = currentSession?.academicYear || '2026-27';

        const existingCoord = await tx.select().from(facultyCoordinatorAssignments).where(and(
          eq(facultyCoordinatorAssignments.staff_account_id, idNum),
          eq(facultyCoordinatorAssignments.coordinator_type, 'FIRST_YEAR'),
          eq(facultyCoordinatorAssignments.is_active, true)
        ));

        if (is_first_year_coordinator === true) {
          if (staffBefore.account_status !== 'ACTIVE' && is_active !== true) {
            throw new ValidationError('Cannot assign coordinator role to an inactive staff account.');
          }
          const hasFaculty = await tx.select().from(staffAccountRoles)
            .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
            .where(and(
              eq(staffAccountRoles.staff_account_id, idNum),
              eq(staffRoles.role_code, 'FACULTY')
            ));
          if (hasFaculty.length === 0) {
            throw new ValidationError('Only active faculty members are eligible for First Year Coordinator assignment.');
          }

          if (existingCoord.length === 0) {
            const startD = coordinator_start_date || todayStr;
            const endD = coordinator_end_date || null;
            if (endD && startD && endD < startD) {
              throw new ValidationError('End date cannot be earlier than start date');
            }
            await tx.insert(facultyCoordinatorAssignments).values({
              staff_account_id: idNum,
              coordinator_type: 'FIRST_YEAR',
              academic_year: currentAcademicYear,
              start_date: startD,
              end_date: endD,
              is_active: true,
              assigned_by: user.id
            });
            await tx.insert(auditLogs).values({
              user_id: user.id,
              user_type: 'admin',
              action: 'COORDINATOR_ASSIGNED',
              target_type: 'faculty_coordinator_assignments',
              target_id: String(idNum),
              payload_after: { coordinator_type: 'FIRST_YEAR', academic_year: currentAcademicYear, start_date: startD, end_date: endD },
              ip_address: clientIp,
              user_agent: userAgent
            });
          } else if (coordinator_start_date || coordinator_end_date !== undefined) {
            const startD = coordinator_start_date || existingCoord[0].start_date;
            const endD = coordinator_end_date !== undefined ? coordinator_end_date : existingCoord[0].end_date;
            if (endD && startD && endD < startD) {
              throw new ValidationError('End date cannot be earlier than start date');
            }
            await tx.update(facultyCoordinatorAssignments).set({
              start_date: startD,
              end_date: endD,
            }).where(eq(facultyCoordinatorAssignments.id, existingCoord[0].id));
          }
        } else if (is_first_year_coordinator === false && existingCoord.length > 0) {
          await tx.update(facultyCoordinatorAssignments).set({
            is_active: false,
            end_date: todayStr
          }).where(and(
            eq(facultyCoordinatorAssignments.staff_account_id, idNum),
            eq(facultyCoordinatorAssignments.coordinator_type, 'FIRST_YEAR'),
            eq(facultyCoordinatorAssignments.is_active, true)
          ));
          await tx.insert(auditLogs).values({
            user_id: user.id,
            user_type: 'admin',
            action: 'COORDINATOR_REVOKED',
            target_type: 'faculty_coordinator_assignments',
            target_id: String(idNum),
            payload_after: { is_active: false, end_date: todayStr },
            ip_address: clientIp,
            user_agent: userAgent
          });
        }
      }
    });

    // Audit Log for overall update
    await logAudit(req, {
      userId: user.id,
      userType: 'admin',
      action: 'UPDATE_STAFF',
      targetId: idNum,
      targetType: 'staff_accounts',
      before: sanitizeStaffForAudit(staffBefore),
      after: { name, email, employee_id, is_hod, hod_branches, is_principal, branches, is_active }
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
        is_hod: hod_branches ? hod_branches.length > 0 : is_hod,
        hod_branches: hod_branches,
        is_principal: is_principal,
        branches: branches,
        updated_at: new Date().toISOString()
      });
    } catch (_e) {
      // Non-blocking
    }

    const updatedStaff = {
      id: idNum,
      name: name !== undefined ? name : staffBefore.name,
      email: email !== undefined ? email.toLowerCase() : staffBefore.email,
      employee_id: employee_id !== undefined ? employee_id : staffBefore.employee_id,
      is_active: is_active !== undefined ? is_active : (staffBefore.account_status === 'ACTIVE'),
      branches: branches !== undefined ? branches : (staffBefore.branches || []),
      is_hod: hod_branches ? hod_branches.length > 0 : (is_hod !== undefined ? is_hod : false),
      hod_branches: hod_branches !== undefined ? hod_branches : [],
      is_principal: is_principal !== undefined ? is_principal : false,
      is_first_year_coordinator: is_first_year_coordinator !== undefined ? is_first_year_coordinator : false,
    };

    return apiResponse({ 
      success: true, 
      message: 'Staff record and assignments updated successfully',
      data: updatedStaff
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    if (error.statusCode === 400 || error.name === 'ValidationError') {
      return apiError(error.message, 400);
    }
    const clientValidationMessages = [
      'Teaching roles (faculty) cannot be shifted to non-teaching roles',
      'Non-teaching roles cannot be shifted to teaching roles',
      'Cannot enable HOD access for an inactive staff account',
      'Staff must have the FACULTY role to be assigned as HOD',
      'Cannot assign coordinator role to an inactive staff account',
      'Only active faculty members are eligible for First Year Coordinator assignment',
      'End date cannot be earlier than start date',
      'Invalid branch',
      'Invalid HOD branch'
    ];
    if (clientValidationMessages.some(msg => error.message?.includes(msg))) {
      return apiError(error.message, 400);
    }
    if (error.conflictDetails) {
      return NextResponse.json({
        error: error.message,
        conflictDetails: error.conflictDetails,
        details: error.conflictDetails
      }, {
        status: 409,
        headers: {
          'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });
    }
    if (error.message && error.message.startsWith('Conflict:')) {
      return apiError(error.message, 409);
    }
    if (error && error.code === 'ER_DUP_ENTRY') {
      return apiError('Email or Employee ID already exists', 409);
    }
    logger.error('Error updating staff:', error);
    return apiError('Internal Server Error', 500);
  }
}
