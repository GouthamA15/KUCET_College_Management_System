import { db } from '@/db';
import { 
  facultyCoordinatorAssignments, 
  staffAccounts, 
  staffAccountRoles, 
  staffRoles, 
  staffAcademicAffiliations, 
  academicDepartments, 
  principal, 
  auditLogs 
} from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import logger from '@/lib/logger';

export class CoordinatorAssignmentService {
  /**
   * Assigns a faculty member as an academic coordinator (e.g. First Year Coordinator).
   */
  static async assignCoordinator({
    staffAccountId,
    coordinatorType = 'FIRST_YEAR',
    academicYear,
    startDate,
    endDate = null,
    assignedBy = null,
    ip = null,
    userAgent = null,
  }) {
    if (!staffAccountId) {
      const err = new Error('Staff account ID is required');
      err.status = 400;
      throw err;
    }

    if (!academicYear || !/^(\d{4}-\d{2}|\d{4}-\d{4})$/.test(academicYear)) {
      const err = new Error('Valid academic year in format YYYY-YY or YYYY-YYYY is required');
      err.status = 400;
      throw err;
    }

    if (!startDate) {
      const err = new Error('Start date is required');
      err.status = 400;
      throw err;
    }

    if (endDate && endDate < startDate) {
      const err = new Error('End date cannot be earlier than start date');
      err.status = 400;
      throw err;
    }

    return await db.transaction(async (tx) => {
      // 1. Verify staff account exists and is ACTIVE
      const [staff] = await tx
        .select({
          id: staffAccounts.id,
          name: staffAccounts.name,
          email: staffAccounts.email,
          employee_id: staffAccounts.employee_id,
          account_status: staffAccounts.account_status,
        })
        .from(staffAccounts)
        .where(eq(staffAccounts.id, Number(staffAccountId)))
        .limit(1);

      if (!staff) {
        const err = new Error('Staff account not found');
        err.status = 404;
        throw err;
      }

      if (staff.account_status !== 'ACTIVE') {
        const err = new Error('Cannot assign coordinator role to an inactive or disabled staff account');
        err.status = 400;
        throw err;
      }

      // 2. Verify staff member has the Faculty role
      const roles = await tx
        .select({ role_code: staffRoles.role_code })
        .from(staffAccountRoles)
        .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
        .where(eq(staffAccountRoles.staff_account_id, staff.id));

      const hasFacultyRole = roles.some((r) => r.role_code === 'FACULTY');
      if (!hasFacultyRole) {
        const err = new Error('Only active faculty members are eligible for coordinator assignments');
        err.status = 400;
        throw err;
      }

      // 3. Prevent duplicate active assignment for the same person, coordinator type, and academic year
      const existingActive = await tx
        .select({ id: facultyCoordinatorAssignments.id })
        .from(facultyCoordinatorAssignments)
        .where(
          and(
            eq(facultyCoordinatorAssignments.staff_account_id, staff.id),
            eq(facultyCoordinatorAssignments.coordinator_type, coordinatorType),
            eq(facultyCoordinatorAssignments.academic_year, academicYear),
            eq(facultyCoordinatorAssignments.is_active, true)
          )
        )
        .limit(1);

      if (existingActive.length > 0) {
        const err = new Error(
          `Staff member ${staff.name} already has an active ${coordinatorType} assignment for academic year ${academicYear}`
        );
        err.status = 409;
        throw err;
      }

      // 4. Insert assignment record
      const insertResult = await tx.insert(facultyCoordinatorAssignments).values({
        staff_account_id: staff.id,
        coordinator_type: coordinatorType,
        academic_year: academicYear,
        start_date: startDate,
        end_date: endDate || null,
        is_active: true,
        assigned_by: assignedBy ? Number(assignedBy) : null,
      });

      const header = Array.isArray(insertResult) ? insertResult[0] : insertResult;
      const newAssignmentId = header?.insertId ? Number(header.insertId) : null;

      if (!newAssignmentId) {
        const err = new Error(
          'Failed to create coordinator assignment: database did not return a valid inserted assignment ID'
        );
        err.status = 500;
        throw err;
      }

      // 5. Audit Log
      await tx.insert(auditLogs).values({
        user_id: assignedBy || staff.id,
        user_type: assignedBy ? 'admin' : 'system',
        action: 'COORDINATOR_ASSIGNED',
        target_type: 'faculty_coordinator_assignments',
        target_id: String(newAssignmentId),
        payload_after: {
          assignment_id: newAssignmentId,
          staff_account_id: staff.id,
          staff_name: staff.name,
          employee_id: staff.employee_id,
          coordinator_type: coordinatorType,
          academic_year: academicYear,
          start_date: startDate,
          end_date: endDate,
        },
        ip_address: ip || '127.0.0.1',
        user_agent: userAgent || 'internal',
      });

      logger.info(
        {
          assignmentId: newAssignmentId,
          staffId: staff.id,
          coordinatorType,
          academicYear,
        },
        '[COORDINATOR_ASSIGNED]'
      );

      return {
        id: newAssignmentId,
        staff_account_id: staff.id,
        coordinator_type: coordinatorType,
        academic_year: academicYear,
        start_date: startDate,
        end_date: endDate,
        is_active: true,
        assigned_by: assignedBy,
        staff_name: staff.name,
        employee_id: staff.employee_id,
      };
    });
  }

  /**
   * Revokes an active coordinator assignment.
   * Preserves historical appointment records by marking is_active = false and setting end_date = today.
   */
  static async revokeCoordinator(assignmentId, { revokedBy = null, reason = null, ip = null, userAgent = null } = {}) {
    const idNum = Number(assignmentId);
    if (!idNum) {
      const err = new Error('Valid assignment ID is required');
      err.status = 400;
      throw err;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    return await db.transaction(async (tx) => {
      const [assignment] = await tx
        .select({
          id: facultyCoordinatorAssignments.id,
          staff_account_id: facultyCoordinatorAssignments.staff_account_id,
          coordinator_type: facultyCoordinatorAssignments.coordinator_type,
          academic_year: facultyCoordinatorAssignments.academic_year,
          is_active: facultyCoordinatorAssignments.is_active,
          start_date: facultyCoordinatorAssignments.start_date,
          end_date: facultyCoordinatorAssignments.end_date,
          staff_name: staffAccounts.name,
        })
        .from(facultyCoordinatorAssignments)
        .innerJoin(staffAccounts, eq(facultyCoordinatorAssignments.staff_account_id, staffAccounts.id))
        .where(eq(facultyCoordinatorAssignments.id, idNum))
        .limit(1);

      if (!assignment) {
        const err = new Error('Coordinator assignment not found');
        err.status = 404;
        throw err;
      }

      if (!assignment.is_active) {
        const err = new Error('This coordinator assignment is already inactive or revoked');
        err.status = 400;
        throw err;
      }

      await tx
        .update(facultyCoordinatorAssignments)
        .set({
          is_active: false,
          end_date: todayStr,
        })
        .where(eq(facultyCoordinatorAssignments.id, idNum));

      await tx.insert(auditLogs).values({
        user_id: revokedBy || assignment.staff_account_id,
        user_type: revokedBy ? 'admin' : 'system',
        action: 'COORDINATOR_REVOKED',
        target_type: 'faculty_coordinator_assignments',
        target_id: String(idNum),
        payload_before: {
          is_active: true,
          end_date: assignment.end_date,
        },
        payload_after: {
          is_active: false,
          end_date: todayStr,
          revoked_by: revokedBy,
          reason: reason || null,
        },
        ip_address: ip || '127.0.0.1',
        user_agent: userAgent || 'internal',
      });

      logger.info(
        {
          assignmentId: idNum,
          staffId: assignment.staff_account_id,
          coordinatorType: assignment.coordinator_type,
        },
        '[COORDINATOR_REVOKED]'
      );

      return {
        id: idNum,
        is_active: false,
        end_date: todayStr,
        message: 'Coordinator assignment successfully revoked',
      };
    });
  }

  /**
   * Updates effective appointment dates for an assignment.
   */
  static async updateCoordinatorDates(assignmentId, { startDate, endDate = null, updatedBy = null, ip = null, userAgent = null }) {
    const idNum = Number(assignmentId);
    if (!idNum) {
      const err = new Error('Valid assignment ID is required');
      err.status = 400;
      throw err;
    }

    if (!startDate) {
      const err = new Error('Start date is required');
      err.status = 400;
      throw err;
    }

    if (endDate && endDate < startDate) {
      const err = new Error('End date cannot be earlier than start date');
      err.status = 400;
      throw err;
    }

    return await db.transaction(async (tx) => {
      const [assignment] = await tx
        .select()
        .from(facultyCoordinatorAssignments)
        .where(eq(facultyCoordinatorAssignments.id, idNum))
        .limit(1);

      if (!assignment) {
        const err = new Error('Coordinator assignment not found');
        err.status = 404;
        throw err;
      }

      await tx
        .update(facultyCoordinatorAssignments)
        .set({
          start_date: startDate,
          end_date: endDate || null,
        })
        .where(eq(facultyCoordinatorAssignments.id, idNum));

      await tx.insert(auditLogs).values({
        user_id: updatedBy || assignment.staff_account_id,
        user_type: updatedBy ? 'admin' : 'system',
        action: 'COORDINATOR_DATES_UPDATED',
        target_type: 'faculty_coordinator_assignments',
        target_id: String(idNum),
        payload_before: {
          start_date: assignment.start_date,
          end_date: assignment.end_date,
        },
        payload_after: {
          start_date: startDate,
          end_date: endDate,
        },
        ip_address: ip || '127.0.0.1',
        user_agent: userAgent || 'internal',
      });

      return {
        id: idNum,
        start_date: startDate,
        end_date: endDate,
        message: 'Appointment dates successfully updated',
      };
    });
  }

  /**
   * Renews or reappoints a coordinator for a new academic year or term.
   */
  static async renewCoordinator(assignmentId, { academicYear, startDate, endDate = null, renewedBy = null, ip = null, userAgent = null }) {
    const idNum = Number(assignmentId);
    if (!idNum) {
      const err = new Error('Valid assignment ID is required');
      err.status = 400;
      throw err;
    }

    const [oldAssignment] = await db
      .select()
      .from(facultyCoordinatorAssignments)
      .where(eq(facultyCoordinatorAssignments.id, idNum))
      .limit(1);

    if (!oldAssignment) {
      const err = new Error('Original coordinator assignment not found');
      err.status = 404;
      throw err;
    }

    return await this.assignCoordinator({
      staffAccountId: oldAssignment.staff_account_id,
      coordinatorType: oldAssignment.coordinator_type,
      academicYear: academicYear || oldAssignment.academic_year,
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate,
      assignedBy: renewedBy,
      ip,
      userAgent,
    });
  }

  /**
   * Authoritatively computes assignment status.
   */
  static computeStatus(row, todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })) {
    if (!row.is_active) return 'REVOKED';

    const toDateStr = (val) => {
      if (!val) return null;
      if (val instanceof Date) return val.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      return String(val).split('T')[0];
    };

    const sStr = toDateStr(row.start_date);
    const eStr = toDateStr(row.end_date);

    if (sStr && todayStr < sStr) return 'SCHEDULED';
    if (eStr && todayStr > eStr) return 'EXPIRED';
    if (row.staff_status && row.staff_status !== 'ACTIVE') return 'DISABLED';
    return 'ACTIVE';
  }

  /**
   * Retrieves all coordinator assignments with complete appointment history and resolved status.
   */
  static async getCoordinatorAssignments({ coordinatorType = 'FIRST_YEAR', includeInactive = true } = {}) {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    const rows = await db
      .select({
        id: facultyCoordinatorAssignments.id,
        staff_account_id: facultyCoordinatorAssignments.staff_account_id,
        coordinator_type: facultyCoordinatorAssignments.coordinator_type,
        academic_year: facultyCoordinatorAssignments.academic_year,
        start_date: facultyCoordinatorAssignments.start_date,
        end_date: facultyCoordinatorAssignments.end_date,
        is_active: facultyCoordinatorAssignments.is_active,
        assigned_by: facultyCoordinatorAssignments.assigned_by,
        created_at: facultyCoordinatorAssignments.created_at,
        updated_at: facultyCoordinatorAssignments.updated_at,
        staff_name: staffAccounts.name,
        staff_email: staffAccounts.email,
        employee_id: staffAccounts.employee_id,
        staff_status: staffAccounts.account_status,
        department_code: academicDepartments.department_code,
        department_name: academicDepartments.department_name,
        assigned_by_name: principal.email,
      })
      .from(facultyCoordinatorAssignments)
      .innerJoin(staffAccounts, eq(facultyCoordinatorAssignments.staff_account_id, staffAccounts.id))
      .leftJoin(
        staffAcademicAffiliations,
        eq(facultyCoordinatorAssignments.staff_account_id, staffAcademicAffiliations.staff_account_id)
      )
      .leftJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
      .leftJoin(principal, eq(facultyCoordinatorAssignments.assigned_by, principal.id))
      .where(
        coordinatorType
          ? eq(facultyCoordinatorAssignments.coordinator_type, coordinatorType)
          : undefined
      )
      .orderBy(desc(facultyCoordinatorAssignments.created_at));

    const result = [];
    const seenIds = new Set();

    for (const row of rows) {
      if (seenIds.has(row.id)) continue;
      seenIds.add(row.id);

      const computedStatus = this.computeStatus(row, todayStr);

      if (!includeInactive && computedStatus !== 'ACTIVE') {
        continue;
      }

      result.push({
        id: row.id,
        staff_account_id: row.staff_account_id,
        staff_name: row.staff_name,
        staff_email: row.staff_email,
        employee_id: row.employee_id,
        department_code: row.department_code || 'FACULTY',
        department_name: row.department_name || 'Faculty of Engineering',
        coordinator_type: row.coordinator_type,
        academic_year: row.academic_year,
        start_date: row.start_date,
        end_date: row.end_date,
        is_active: row.is_active,
        status: computedStatus,
        assigned_by: row.assigned_by,
        assigned_by_name: row.assigned_by_name || 'Administrator',
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }

    return result;
  }

  /**
   * Authoritative lookup: Returns active coordinator assignment for a staff member if currently active and within valid dates.
   */
  static async getActiveCoordinatorForStaff(staffAccountId, coordinatorType = 'FIRST_YEAR') {
    if (!staffAccountId) return null;
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    const rows = await db
      .select()
      .from(facultyCoordinatorAssignments)
      .where(
        and(
          eq(facultyCoordinatorAssignments.staff_account_id, Number(staffAccountId)),
          eq(facultyCoordinatorAssignments.coordinator_type, coordinatorType),
          eq(facultyCoordinatorAssignments.is_active, true)
        )
      )
      .limit(5);

    const toDateStr = (val) => {
      if (!val) return null;
      if (val instanceof Date) return val.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      return String(val).split('T')[0];
    };

    const activeRow = rows.find((r) => {
      const sStr = toDateStr(r.start_date);
      const eStr = toDateStr(r.end_date);
      if (sStr && todayStr < sStr) return false;
      if (eStr && todayStr > eStr) return false;
      return true;
    });

    return activeRow || null;
  }
}
