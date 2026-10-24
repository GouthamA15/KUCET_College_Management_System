import { db } from '@/db';
import { academicDepartments, academicPrograms } from '@/db/schema';
import { CANONICAL_BRANCHES } from '@/services/identity/IDCardDataService';

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
 * Returns the branches a user is authorized to manage academically.
 * Returns null if the user has unrestricted branch access across all branches.
 */
export function getAuthorizedAcademicBranches(user) {
  if (!user || !user.role) return [];
  const role = String(user.role).toLowerCase();

  if (['admin', 'super_admin', 'principal'].includes(role) || user.is_principal) {
    return null; // Global access
  }

  // First Year Coordinator has institutional authority across all branches
  if (user.is_first_year_coordinator) {
    return null; // Cross-branch scope (semesters restricted independently)
  }

  // HOD is restricted to their assigned department branches
  if (user.is_hod) {
    const hodBranches = Array.isArray(user.hod_branches) ? user.hod_branches : [];
    if (hodBranches.length > 0) return hodBranches.map(b => String(b).toUpperCase());
    if (user.branch) return [String(user.branch).toUpperCase()];
    if (user.hod_department_code) return [String(user.hod_department_code).toUpperCase()];
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

  if (['admin', 'super_admin', 'principal'].includes(role) || user.is_principal) {
    return [1, 2, 3, 4, 5, 6, 7, 8];
  }

  const normBranch = targetBranch ? String(targetBranch).toUpperCase().trim() : null;
  const hodBranches = (user.hod_branches || (user.branch ? [user.branch] : [])).map(b => String(b).toUpperCase());

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

  // 1. Admins and Principal have unrestricted access
  if (['admin', 'super_admin', 'principal'].includes(role) || user.is_principal) {
    return true;
  }

  const semInt = Number(semester);
  if (isNaN(semInt) || semInt < 1 || semInt > 8) {
    return false;
  }

  const normBranch = branch ? String(branch).toUpperCase().trim() : null;
  const hodBranches = (user.hod_branches || (user.branch ? [user.branch] : [])).map(b => String(b).toUpperCase());

  // 2. Check HOD authority
  if (user.is_hod && normBranch && hodBranches.includes(normBranch)) {
    return true; // HOD has semesters 1-8 for their branch
  }

  // 3. Check First Year Coordinator authority
  if (user.is_first_year_coordinator) {
    const isConfiguredBranch = !normBranch || INSTITUTIONAL_BRANCHES.includes(normBranch);
    if (isConfiguredBranch && (semInt === 1 || semInt === 2)) {
      return true; // Allowed for all configured institutional branches, semesters 1 & 2
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
