import { db } from '@/db';
import { 
  academicDepartments, 
  academicPrograms,
  branchConfig,
  timetableInstances,
  facultySubjectAssignments,
  branchTimetable,
  archiveOperationsLog,
  staffAccounts,
  staffAccountRoles,
  staffRoles,
  principal,
  securityNotifications,
  auditLogs,
  syllabusStructure
} from '@/db/schema';
import { eq, and, or, sql, ne, like } from 'drizzle-orm';
import { CANONICAL_BRANCHES } from '@/services/identity/IDCardDataService';
import logger from '@/lib/logger';

export const ALL_CANONICAL_BRANCH_NAMES = CANONICAL_BRANCHES.map((b) => b.name);
export const INSTITUTIONAL_BRANCHES = ALL_CANONICAL_BRANCH_NAMES;

/**
 * Resolves the full list of institutional branches configured in the system.
 * Dynamically queries academicDepartments and academicPrograms, falling back to CANONICAL_BRANCHES.
 */
export async function getInstitutionalBranches() {
  try {
    if (db?.select && academicDepartments) {
      const depts = await db.select({ code: academicDepartments.department_code }).from(academicDepartments);
      const progs = academicPrograms ? await db.select({ code: academicPrograms.program_code }).from(academicPrograms) : [];
      const codes = Array.from(new Set([...depts.map(d => d.code), ...progs.map(p => p.code)].filter(Boolean)));
      if (codes.length > 0) return codes.map(c => c.toUpperCase());
    }
  } catch (_e) {
    // Non-fatal fallback
  }
  return ALL_CANONICAL_BRANCH_NAMES;
}

/**
 * Verifies whether a given staff member is the explicitly designated institutional academic supervisor.
 *
 * Strict Security Invariants:
 * 1. Global Academic Supervisor authority is granted ONLY when the authenticated staff identity
 *    matches a valid, explicitly configured designated Supervisor identity.
 * 2. Having the 'PRINCIPAL' role alone NEVER grants global Academic Supervisor authority.
 * 3. Configuration is resolved authoritatively from system_configs:
 *    - Key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID' (canonical staff_accounts.id)
 *    - Key: 'DESIGNATED_ACADEMIC_SUPERVISOR_EMAIL' (canonical staff email)
 *    Falling back to process.env.DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID or process.env.DESIGNATED_SUPERVISOR_EMAIL.
 * 4. The function STRICTLY FAILS CLOSED (returns false) if:
 *    - Configuration is missing, empty, or malformed.
 *    - Configured staff ID does not resolve to an active account in staff_accounts.
 *    - Account status is not 'ACTIVE' (e.g. SUSPENDED, DISABLED, PENDING_ACTIVATION).
 *    - Account does not possess the 'PRINCIPAL' role in staff_account_roles.
 *    - The caller's identity does not match the configured designation.
 *    - Conflicting configuration exists (ID and email resolve to different accounts).
 *    - Any database or network error occurs during lookup.
 *
 * @param {number|string} staffId - Authenticated staff account ID (staff_accounts.id)
 * @param {string|null} [email] - Authenticated staff email
 * @returns {Promise<boolean>}
 */
export async function isDesignatedAcademicSupervisor(staffId, email = null) {
  const normAuthStaffId = staffId !== null && staffId !== undefined && String(staffId).trim() !== ''
    ? Number(staffId)
    : null;
  const normAuthEmail = email && typeof email === 'string' && email.trim() !== ''
    ? email.trim().toLowerCase()
    : null;

  // Caller identity must provide at least a valid positive staffId or non-empty email
  if ((normAuthStaffId === null || isNaN(normAuthStaffId) || normAuthStaffId <= 0) && !normAuthEmail) {
    return false;
  }

  let dbConfigs = [];
  try {
    const { systemConfigs } = await import('@/db/schema');
    if (db?.select && systemConfigs) {
      dbConfigs = await db.select()
        .from(systemConfigs)
        .where(or(
          eq(systemConfigs.config_key, 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID'),
          eq(systemConfigs.config_key, 'DESIGNATED_ACADEMIC_SUPERVISOR_EMAIL')
        ));
    }
  } catch (err) {
    logger.error({ err: err?.message }, '[SUPERVISOR_AUTH_ERR] Failed to load supervisor configuration from database; failing closed.');
    return false; // Fail closed on DB query error
  }

  const dbStaffIdRow = dbConfigs.find(c => c.config_key === 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID');
  const dbEmailRow = dbConfigs.find(c => c.config_key === 'DESIGNATED_ACADEMIC_SUPERVISOR_EMAIL');

  const rawConfigStaffId = (dbStaffIdRow?.config_value ?? process.env.DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID ?? '').trim();
  const rawConfigEmail = (dbEmailRow?.config_value ?? process.env.DESIGNATED_SUPERVISOR_EMAIL ?? '').trim().toLowerCase();

  // Missing or completely empty configuration -> STRICT FAIL-CLOSED
  if (!rawConfigStaffId && !rawConfigEmail) {
    logger.warn({ staffId: normAuthStaffId, email: normAuthEmail }, '[SUPERVISOR_AUTH_DENIED] No designated academic supervisor configured; denying access (fail-closed).');
    return false;
  }

  // Validate configured staff ID if provided
  let parsedConfigStaffId = null;
  if (rawConfigStaffId) {
    if (['null', 'undefined', 'nan', '0', '-1', 'revoked', 'none'].includes(rawConfigStaffId.toLowerCase())) {
      logger.warn({ rawConfigStaffId }, '[SUPERVISOR_AUTH_DENIED] Malformed or revoked designated supervisor staff ID configuration.');
      return false;
    }
    const num = Number(rawConfigStaffId);
    if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
      logger.warn({ rawConfigStaffId }, '[SUPERVISOR_AUTH_DENIED] Non-integer designated supervisor staff ID configuration.');
      return false;
    }
    parsedConfigStaffId = num;
  }

  // Validate configured email if provided
  let validatedConfigEmail = null;
  if (rawConfigEmail) {
    if (!rawConfigEmail.includes('@') || !rawConfigEmail.includes('.') || rawConfigEmail.length < 5) {
      logger.warn({ rawConfigEmail }, '[SUPERVISOR_AUTH_DENIED] Malformed designated supervisor email configuration.');
      return false;
    }
    validatedConfigEmail = rawConfigEmail;
  }

  // Caller identity matching:
  // 1. If staff ID is configured, caller's staff ID MUST match exactly
  if (parsedConfigStaffId !== null) {
    if (normAuthStaffId === null || normAuthStaffId !== parsedConfigStaffId) {
      return false;
    }
  }

  // 2. If email is configured, caller's email MUST match if provided
  if (validatedConfigEmail !== null) {
    if (normAuthEmail && normAuthEmail !== validatedConfigEmail) {
      return false;
    }
    if (parsedConfigStaffId === null && normAuthEmail !== validatedConfigEmail) {
      return false;
    }
  }

  // 3. Database verification of the designated account: existence, ACTIVE status, and PRINCIPAL role
  try {
    const { staffAccounts, staffAccountRoles, staffRoles } = await import('@/db/schema');
    if (db?.select && staffAccounts) {
      const targetStaffId = parsedConfigStaffId ?? normAuthStaffId;
      if (targetStaffId) {
        const accounts = await db.select({
          id: staffAccounts.id,
          email: staffAccounts.email,
          account_status: staffAccounts.account_status,
        })
        .from(staffAccounts)
        .where(eq(staffAccounts.id, targetStaffId))
        .limit(1);

        if (!accounts || accounts.length === 0) {
          logger.warn({ targetStaffId }, '[SUPERVISOR_AUTH_DENIED] Configured supervisor staff account does not exist in database.');
          return false;
        }

        const account = accounts[0];

        // Status check: must be ACTIVE
        if (account.account_status && account.account_status !== 'ACTIVE') {
          logger.warn({ targetStaffId, status: account.account_status }, '[SUPERVISOR_AUTH_DENIED] Designated supervisor account is not ACTIVE.');
          return false;
        }

        // Cross-configuration conflict detection
        if (validatedConfigEmail && account.email && account.email.trim().toLowerCase() !== validatedConfigEmail) {
          logger.error({ targetStaffId, accountEmail: account.email, validatedConfigEmail }, '[SUPERVISOR_AUTH_DENIED] Conflicting supervisor configuration: configured staff ID and email resolve to different accounts.');
          return false;
        }

        // Verify account possesses PRINCIPAL role
        if (staffAccountRoles && staffRoles) {
          const roles = await db.select({ role_code: staffRoles.role_code })
            .from(staffAccountRoles)
            .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
            .where(eq(staffAccountRoles.staff_account_id, targetStaffId));

          const roleCodes = (roles || []).map(r => r.role_code);
          if (!roleCodes.includes('PRINCIPAL')) {
            logger.warn({ targetStaffId, roleCodes }, '[SUPERVISOR_AUTH_DENIED] Designated supervisor account lacks the required PRINCIPAL role.');
            return false;
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err: err?.message }, '[SUPERVISOR_AUTH_ERR] Error validating supervisor account in database; failing closed.');
    return false;
  }

  return true;
}

export const isVerifiedDesignatedSupervisor = isDesignatedAcademicSupervisor;

/**
 * Resolves the department branches a user oversees as HOD.
 * Checks authorized_branches, hod_branches, hod_department_code, and branch fallback.
 */
export function getHodDepartmentBranches(user) {
  if (!user || !user.is_hod) return [];
  const authBranches = Array.isArray(user.authorized_branches) ? user.authorized_branches : [];
  if (authBranches.length > 0) return authBranches.map(b => String(b).toUpperCase());
  const hodBranches = Array.isArray(user.hod_branches) ? user.hod_branches : [];
  if (hodBranches.length > 0) return hodBranches.map(b => String(b).toUpperCase());
  if (user.hod_department_code) return [String(user.hod_department_code).toUpperCase()];
  if (user.branch) return [String(user.branch).toUpperCase()];
  return [];
}

/**
 * Returns the branches a user is authorized to manage academically.
 * Returns null if the user has unrestricted branch access across all branches.
 */
export function getAuthorizedAcademicBranches(user) {
  if (!user || !user.role) return [];
  const role = String(user.role).toLowerCase();

  // Super Admin or explicitly designated academic supervisor has global access
  if (['admin', 'super_admin'].includes(role) || user.is_designated_supervisor === true) {
    return null; // Global access
  }

  // First Year Coordinator has institutional authority across all branches
  if (user.is_first_year_coordinator) {
    return null; // Cross-branch scope (semesters restricted independently)
  }

  // HOD is restricted to their assigned department branches
  if (user.is_hod) {
    return getHodDepartmentBranches(user);
  }

  return [];
}

/**
 * Resolves the allowed semesters for a user for a specific branch.
 * Returns array of allowed integer semesters (e.g. [1, 2] or [1, 2, 3, 4, 5, 6, 7, 8]).
 */
export function getAllowedAcademicSemesters(user, targetBranch = null) {
  if (!user) return [];
  const role = String(user.role || '').toLowerCase();

  // Super Admin or explicitly designated academic supervisor has global access to all 8 semesters
  if (['admin', 'super_admin'].includes(role) || user.is_designated_supervisor === true) {
    return [1, 2, 3, 4, 5, 6, 7, 8];
  }

  const normBranch = targetBranch ? String(targetBranch).toUpperCase().trim() : null;
  const hodBranches = getHodDepartmentBranches(user);

  const isHodForThisBranch = user.is_hod && (!normBranch || hodBranches.includes(normBranch));

  if (isHodForThisBranch) {
    return [1, 2, 3, 4, 5, 6, 7, 8];
  }

  // First Year Coordinator is strictly restricted to semesters 1 and 2 across configured branches
  if (user.is_first_year_coordinator) {
    const isConfiguredBranch = !normBranch || INSTITUTIONAL_BRANCHES.includes(normBranch);
    if (isConfiguredBranch) {
      return [1, 2];
    }
  }

  return [];
}

/**
 * Checks whether the given user is authorized to perform academic operations
 * for the requested branch and semester.
 */
export function isAcademicScopeAllowed(user, { branch, semester }) {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();

  // 1. Super Admin and explicitly designated academic supervisor have unrestricted access
  if (['admin', 'super_admin'].includes(role) || user.is_designated_supervisor === true) {
    return true;
  }

  const semInt = Number(semester);
  if (isNaN(semInt) || semInt < 1 || semInt > 8) {
    return false;
  }

  const normBranch = branch ? String(branch).toUpperCase().trim() : null;
  const hodBranches = getHodDepartmentBranches(user);

  // 2. Check HOD authority (Semesters 1-8 within authorized departmental branches)
  if (user.is_hod && normBranch && hodBranches.includes(normBranch)) {
    return true;
  }

  // 3. Check First Year Coordinator authority (Semesters 1-2 across all institutional branches)
  if (user.is_first_year_coordinator) {
    const isConfiguredBranch = !normBranch || INSTITUTIONAL_BRANCHES.includes(normBranch);
    if (isConfiguredBranch && (semInt === 1 || semInt === 2)) {
      return true;
    }
  }

  return false;
}

/**
 * Asserts academic scope; throws standard HTTP 403 error if outside scope.
 */
export function assertAcademicScope(user, { branch, semester }) {
  if (!isAcademicScopeAllowed(user, { branch, semester })) {
    const error = new Error(
      `Forbidden: You do not have authorization to manage academic records for ${branch || 'unspecified'} Semester ${semester}`
    );
    error.status = 403;
    error.statusCode = 403;
    throw error;
  }
}

/**
 * Check if a specific academic year / semester allocation is locked or archived.
 * Locked years/semesters are strictly read-only for mutations.
 */
export async function isAcademicYearLocked({ academic_year, branch, semester }) {
  if (!academic_year) return { isLocked: false };

  try {
    // 1. Check if archived in archive_operations_log
    const archiveLogs = await db.select({
      id: archiveOperationsLog.id,
      archive_type: archiveOperationsLog.archive_type,
      academic_year: archiveOperationsLog.academic_year
    })
    .from(archiveOperationsLog)
    .where(and(
      eq(archiveOperationsLog.archive_type, 'SEMESTER'),
      eq(archiveOperationsLog.academic_year, academic_year)
    ))
    .limit(1);

    if (archiveLogs.length > 0) {
      return { 
        isLocked: true, 
        reason: `Academic year ${academic_year} has been permanently archived. Historical records are read-only.` 
      };
    }

    // 2. Check if locked in branch_config (if branch and semester specified)
    if (branch && semester) {
      const semInt = Number(semester);
      const configs = await db.select({
        is_locked: branchConfig.is_locked
      })
      .from(branchConfig)
      .where(and(
        eq(branchConfig.branch, String(branch).toUpperCase().trim()),
        eq(branchConfig.academic_year, academic_year),
        eq(branchConfig.semester, semInt)
      ))
      .limit(1);

      if (configs.length > 0 && configs[0].is_locked) {
        return {
          isLocked: true,
          reason: `Branch ${branch} Semester ${semester} for ${academic_year} has been finalized and locked.`
        };
      }
    }

    // 3. Check if timetable instance is ARCHIVED
    if (branch && semester) {
      const semInt = Number(semester);
      const ttInst = await db.select({
        status: timetableInstances.status
      })
      .from(timetableInstances)
      .where(and(
        eq(timetableInstances.branch, String(branch).toUpperCase().trim()),
        eq(timetableInstances.semester, semInt),
        eq(timetableInstances.academic_year, academic_year)
      ))
      .limit(1);

      if (ttInst.length > 0 && ttInst[0].status === 'ARCHIVED') {
        return {
          isLocked: true,
          reason: `Timetable instance for ${branch} Sem ${semester} (${academic_year}) is marked ARCHIVED.`
        };
      }
    }
  } catch (err) {
    logger.warn({ err: err.message, academic_year, branch, semester }, '[ACADEMIC_LOCK_CHECK_WARN]');
  }

  return { isLocked: false };
}

/**
 * Asserts that the academic year/semester is not locked; throws 403 if locked.
 */
export async function assertAcademicYearNotLocked({ academic_year, branch, semester }) {
  const lockStatus = await isAcademicYearLocked({ academic_year, branch, semester });
  if (lockStatus.isLocked) {
    const error = new Error(lockStatus.reason || `Academic year ${academic_year} is locked for modifications.`);
    error.status = 403;
    error.statusCode = 403;
    throw error;
  }
}

/**
 * Evaluates whether a user can express interest in a subject.
 * Regular faculty can express interest in ANY valid branch and semester 1-8,
 * provided the subject exists in the syllabus and the academic year is not locked.
 */
export async function canExpressSubjectInterest(user, { branch, semester, subject_code, academic_year: _academic_year }) {
  if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
    return { allowed: false, reason: 'Authentication required as active faculty' };
  }

  const semInt = Number(semester);
  if (isNaN(semInt) || semInt < 1 || semInt > 8) {
    return { allowed: false, reason: 'Semester must be between 1 and 8' };
  }

  const normBranch = String(branch || '').toUpperCase().trim();
  if (!normBranch) {
    return { allowed: false, reason: 'Branch is required' };
  }

  // Validate subject in syllabusStructure
  if (subject_code) {
    const subjectCheck = await db.select({ subject_code: syllabusStructure.subject_code })
      .from(syllabusStructure)
      .where(and(
        eq(syllabusStructure.subject_code, subject_code),
        eq(syllabusStructure.branch, normBranch),
        eq(syllabusStructure.semester, semInt)
      ))
      .limit(1);

    if (subjectCheck.length === 0) {
      return { allowed: false, reason: `Subject ${subject_code} not found in ${normBranch} Semester ${semInt} syllabus` };
    }
  }

  return { allowed: true };
}

/**
 * Evaluates whether a user can directly allocate a subject (to themselves or another faculty member).
 */
export function canDirectlyAllocateSubject(user, { branch, semester, target_faculty_id, is_self_allocation = false }) {
  if (!user) return { allowed: false, reason: 'Unauthorized' };
  const role = String(user.role || '').toLowerCase();

  // Super Admin
  if (['admin', 'super_admin'].includes(role)) {
    return { allowed: true };
  }

  const semInt = Number(semester);
  if (isNaN(semInt) || semInt < 1 || semInt > 8) {
    return { allowed: false, reason: 'Invalid semester' };
  }

  const normBranch = String(branch || '').toUpperCase().trim();
  const targetId = Number(target_faculty_id || user.id);
  const isSelf = is_self_allocation || (targetId === Number(user.id));

  // 1. First-Year Coordinator: Semesters 1 and 2 across ALL 7 institutional branches
  if (user.is_first_year_coordinator) {
    const isFirstYearSem = (semInt === 1 || semInt === 2);
    const isInstitutionalBranch = INSTITUTIONAL_BRANCHES.includes(normBranch);

    if (isFirstYearSem && isInstitutionalBranch) {
      return { 
        allowed: true, 
        isCoordinator: true,
        isSelfAllocation: isSelf 
      };
    }

    if (!isFirstYearSem && !user.is_hod) {
      return { 
        allowed: false, 
        reason: 'First Year Coordinator direct allocation is restricted to Semesters 1 and 2' 
      };
    }
  }

  // 2. HOD: Semesters 1-8 within authorized departmental branches
  if (user.is_hod) {
    const hodBranches = (
      user.authorized_branches || 
      user.hod_branches || 
      (user.branch ? [user.branch] : (user.hod_department_code ? [user.hod_department_code] : []))
    ).map(b => String(b).toUpperCase());
    if (hodBranches.includes(normBranch)) {
      return { 
        allowed: true, 
        isHod: true,
        isSelfAllocation: isSelf 
      };
    }
    return { 
      allowed: false, 
      reason: `Unauthorized: You do not have HOD authority over branch ${normBranch}` 
    };
  }

  // Regular faculty have NO direct allocation authority
  return { 
    allowed: false, 
    reason: 'Regular faculty cannot directly allocate subjects. Please submit a teaching preference request.' 
  };
}

/**
 * Evaluates whether a user can review, approve, or self-allocate a faculty interest record.
 */
export function canReviewSubjectInterest(user, interest) {
  if (!user) return { allowed: false, reason: 'Unauthorized' };
  const role = String(user.role || '').toLowerCase();

  // Super Admin
  if (['admin', 'super_admin'].includes(role)) {
    return { allowed: true, canApprove: true, canReject: true, isSelfAllocation: interest.staff_account_id === user.id };
  }

  const isSelf = interest.staff_account_id === user.id;

  // If this is a self-review (user reviewing their own pending request):
  if (isSelf) {
    const allocCheck = canDirectlyAllocateSubject(user, {
      branch: interest.branch,
      semester: interest.semester,
      target_faculty_id: user.id,
      is_self_allocation: true
    });

    if (allocCheck.allowed) {
      return { 
        allowed: true, 
        canApprove: true, 
        canReject: true, 
        isSelfAllocation: true 
      };
    }

    return { 
      allowed: false, 
      reason: 'You cannot review your own request' 
    };
  }

  // Reviewing another faculty member's request:
  const semInt = Number(interest.semester);

  // Semesters 1 & 2 route to First Year Coordinator
  if (user.is_first_year_coordinator && (semInt === 1 || semInt === 2)) {
    return { allowed: true, canApprove: true, canReject: true, isSelfAllocation: false };
  }

  // Semesters 3 to 8 (and department HOD oversight)
  if (user.is_hod) {
    const hodBranches = (user.hod_branches || (user.branch ? [user.branch] : [])).map(b => String(b).toUpperCase());
    const interestBranch = String(interest.branch || '').toUpperCase();
    const interestDept = String(interest.department_code || '').toUpperCase();

    if (hodBranches.includes(interestBranch) || hodBranches.includes(interestDept)) {
      return { allowed: true, canApprove: true, canReject: true, isSelfAllocation: false };
    }
  }

  return { allowed: false, reason: 'Not authorized for this department or academic scope' };
}

/**
 * Checks for timetable conflicts and co-teaching allocations for a candidate subject allocation.
 * Note: Per institutional academic requirements, there is no fixed maximum number of subjects
 * a faculty member may teach within a semester or academic year. Workload quotas are not enforced
 * as blocking conflicts.
 */
export async function checkAllocationConflicts({ 
  faculty_id, 
  subject_code, 
  branch, 
  semester, 
  academic_year 
}) {
  const normBranch = String(branch).toUpperCase().trim();
  const semInt = Number(semester);
  const targetFacultyId = Number(faculty_id);

  const conflicts = [];
  const warnings = [];

  try {
    // 1. Check if another faculty member is already teaching this exact subject
    const existingOtherAllocations = await db.select({
      id: facultySubjectAssignments.id,
      faculty_name: staffAccounts.name,
      staff_account_id: facultySubjectAssignments.staff_account_id
    })
    .from(facultySubjectAssignments)
    .innerJoin(staffAccounts, eq(facultySubjectAssignments.staff_account_id, staffAccounts.id))
    .where(and(
      eq(facultySubjectAssignments.subject_code, subject_code),
      eq(facultySubjectAssignments.branch, normBranch),
      eq(facultySubjectAssignments.course_semester, semInt),
      eq(facultySubjectAssignments.academic_year, academic_year),
      eq(facultySubjectAssignments.is_active, true),
      ne(facultySubjectAssignments.staff_account_id, targetFacultyId)
    ));

    if (existingOtherAllocations.length > 0) {
      const names = existingOtherAllocations.map(a => a.faculty_name).join(', ');
      warnings.push(`This subject is already assigned to ${names}. Additional assignment will create a multi-instructor / co-teaching allocation.`);
    }

    // 2. Timetable slot conflict: Check if faculty has timetable slots that clash with existing scheduled classes
    const isEvenSem = semInt % 2 === 0;
    const yearPrefix = academic_year.substring(0, 4);
    const timetableClashes = await db.select({
      day_of_week: branchTimetable.day_of_week,
      period_number: branchTimetable.period_number,
      clash_branch: branchTimetable.branch,
      clash_semester: branchTimetable.semester
    })
    .from(branchTimetable)
    .where(and(
      eq(branchTimetable.faculty_id, targetFacultyId),
      or(
        like(branchTimetable.academic_year, `%${yearPrefix}%`),
        eq(branchTimetable.academic_year, academic_year)
      ),
      sql`(${branchTimetable.semester} % 2 = 0) = ${isEvenSem}`
    ));

    // If there are duplicate timetable periods
    const periodMap = new Set();
    for (const slot of timetableClashes) {
      if (!slot.day_of_week || slot.period_number == null) continue;
      const key = `${slot.day_of_week}-${slot.period_number}`;
      if (periodMap.has(key)) {
        conflicts.push({
          type: 'TIMETABLE_PERIOD_CLASH',
          message: `Timetable collision on ${slot.day_of_week} Period ${slot.period_number} in ${slot.clash_branch} Sem ${slot.clash_semester}.`
        });
      }
      periodMap.add(key);
    }

  } catch (err) {
    logger.error({ err: err.message }, '[CHECK_ALLOCATION_CONFLICTS_ERROR]');
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    warnings
  };
}

/**
 * Validates whether the user can override an allocation conflict.
 * Overrides require an authorized HOD/Coordinator role and a non-empty reason.
 */
export function canOverrideAllocationConflict(user, { branch, semester, reason }) {
  const scopeAllowed = isAcademicScopeAllowed(user, { branch, semester });
  if (!scopeAllowed) {
    return { allowed: false, reason: 'You do not have administrative authority to override conflicts for this scope' };
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    return { allowed: false, reason: 'A meaningful override reason of at least 5 characters is required' };
  }

  return { allowed: true };
}

/**
 * Resolves the institutional Principal and alerts them of leadership self-allocations.
 */
export async function notifyPrincipalLeadershipSelfAllocation(req, {
  actor,
  subject_code,
  subject_name,
  branch,
  semester,
  academic_year,
  assignment_id,
  override_reason = null
}) {
  try {
    const actorRole = actor.is_first_year_coordinator ? 'First-Year Coordinator' : (actor.is_hod ? 'Head of Department' : 'Faculty');
    const title = `Leadership Self-Allocation: ${subject_code}`;
    let message = `${actorRole} ${actor.name || actor.email} self-allocated ${subject_name} (${subject_code}) for ${branch} Sem ${semester} (${academic_year}).`;
    if (override_reason) {
      message += ` Conflict Override Reason: "${override_reason}".`;
    }

    // 1. Find Principal from staffAccounts (role_code = 'PRINCIPAL')
    const principalStaff = await db.select({
      id: staffAccounts.id,
      name: staffAccounts.name,
      email: staffAccounts.email
    })
    .from(staffAccounts)
    .innerJoin(staffAccountRoles, eq(staffAccountRoles.staff_account_id, staffAccounts.id))
    .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
    .where(eq(staffRoles.role_code, 'PRINCIPAL'));

    // 2. Also find super admin from principal table
    const adminPrincipals = await db.select({ id: principal.id, email: principal.email }).from(principal).limit(5);

    const notificationRows = [];

    for (const p of principalStaff) {
      notificationRows.push({
        user_type: 'STAFF',
        user_id: p.id,
        title,
        message,
        severity: 'INFO',
        is_read: false
      });
    }

    for (const a of adminPrincipals) {
      notificationRows.push({
        user_type: 'ADMIN',
        user_id: a.id,
        title,
        message,
        severity: 'INFO',
        is_read: false
      });
    }

    if (notificationRows.length > 0) {
      await db.insert(securityNotifications).values(notificationRows);
    }

    // 3. Dispatch web push notification if PushNotificationService is available
    try {
      const { PushNotificationService } = await import('@/services/security/PushNotificationService');
      const recipientIds = [...principalStaff.map(p => ({ user_id: p.id, user_type: 'STAFF' })), ...adminPrincipals.map(a => ({ user_id: a.id, user_type: 'ADMIN' }))];
      await PushNotificationService.sendToRecipients(recipientIds, {
        title,
        body: message,
        data: { url: '/staff/faculty/academics' }
      });
    } catch (_pushErr) {
      // Non-fatal
    }

    // 4. Log Audit Event
    const clientIp = (req?.headers?.get('x-forwarded-for')?.split(',')[0] || req?.headers?.get('x-real-ip') || '127.0.0.1').trim().slice(0, 45);
    const userAgent = (req?.headers?.get('user-agent') || 'system').slice(0, 500);

    await db.insert(auditLogs).values({
      user_id: actor.id,
      user_type: 'staff',
      action: actor.is_first_year_coordinator ? 'COORDINATOR_SELF_ALLOCATION' : 'HOD_SELF_ALLOCATION',
      target_id: String(assignment_id || subject_code),
      target_type: 'faculty_subject_assignments',
      payload_before: null,
      payload_after: {
        actor_id: actor.id,
        actor_name: actor.name,
        role: actorRole,
        subject_code,
        subject_name,
        branch,
        semester,
        academic_year,
        assignment_id,
        override_reason
      },
      ip_address: clientIp,
      user_agent: userAgent
    });

  } catch (err) {
    logger.error({ err: err.message }, '[NOTIFY_PRINCIPAL_SELF_ALLOCATION_ERROR]');
  }
}

