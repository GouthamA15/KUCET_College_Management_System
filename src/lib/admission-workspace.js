import { z } from 'zod';
import { COLLEGE_CONFIG } from './college-config';
import { getIntakeYear } from './rollNumber';
import { eq, like } from 'drizzle-orm';

export const ADMISSION_EXAM_OPTIONS = ['TG EAPCET', 'TG ECET'];
export const DEFAULT_ADMISSION_EXAM = 'TG EAPCET';
export const DEFAULT_ADMISSION_BRANCH = 'CSE';

/**
 * Returns list of canonical uppercase branch codes/names from institutional config.
 */
export function getBranchNames() {
  return COLLEGE_CONFIG.branches.map(b => b.name.toUpperCase());
}

/**
 * Returns canonical default workspace values: TG EAPCET, CSE, and current intake year.
 */
export function getDefaultAdmissionWorkspace() {
  return {
    intakeExam: DEFAULT_ADMISSION_EXAM,
    targetBranch: DEFAULT_ADMISSION_BRANCH,
    entryYear: getIntakeYear(),
  };
}

/**
 * Strict Zod validation schema for admission workspaces.
 */
export const admissionWorkspaceSchema = z.object({
  intakeExam: z.string().trim().refine(
    val => ADMISSION_EXAM_OPTIONS.some(opt => opt.toUpperCase() === val.toUpperCase()),
    { message: 'Invalid intake examination' }
  ).transform(val => {
    const match = ADMISSION_EXAM_OPTIONS.find(opt => opt.toUpperCase() === val.toUpperCase());
    return match || val;
  }),
  targetBranch: z.string().trim().refine(
    val => COLLEGE_CONFIG.branches.some(b => b.name.toUpperCase() === val.toUpperCase()),
    { message: 'Invalid target branch' }
  ).transform(val => {
    const match = COLLEGE_CONFIG.branches.find(b => b.name.toUpperCase() === val.toUpperCase());
    return match ? match.name.toUpperCase() : val.toUpperCase();
  }),
  entryYear: z.preprocess(
    v => (typeof v === 'string' && v.trim() !== '' ? parseInt(v.trim(), 10) : Number(v)),
    z.number().int().min(2000).max(2100)
  ),
});

/**
 * Normalizes parameters from query string, state, or payload into a valid workspace object or null.
 */
export function normalizeAdmissionWorkspace(rawParams = {}) {
  if (!rawParams || typeof rawParams !== 'object') return null;

  const intakeExamRaw = rawParams.intakeExam || rawParams.entrance_exam || rawParams.entranceExam || rawParams.exam || '';
  const targetBranchRaw = rawParams.targetBranch || rawParams.target_branch || rawParams.branch || '';
  const entryYearRaw = rawParams.entryYear || rawParams.entry_year || rawParams.joiningYear || rawParams.admission_year || rawParams.year || '';

  const parsed = admissionWorkspaceSchema.safeParse({
    intakeExam: String(intakeExamRaw || '').trim(),
    targetBranch: String(targetBranchRaw || '').trim(),
    entryYear: entryYearRaw,
  });

  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

/**
 * Validates a workspace object.
 */
export function validateAdmissionWorkspace(workspace) {
  return admissionWorkspaceSchema.safeParse(workspace);
}

/**
 * Compares two workspace definitions for exact equality.
 */
export function isSameAdmissionWorkspace(ws1, ws2) {
  if (!ws1 || !ws2) return false;
  return (
    String(ws1.intakeExam || '').toUpperCase() === String(ws2.intakeExam || '').toUpperCase() &&
    String(ws1.targetBranch || '').toUpperCase() === String(ws2.targetBranch || '').toUpperCase() &&
    Number(ws1.entryYear) === Number(ws2.entryYear)
  );
}

/**
 * Verifies whether a database record or realtime payload matches an admission workspace.
 */
export function matchesAdmissionWorkspace(record, workspace) {
  if (!record || !workspace) return false;
  const exam = record.entrance_exam || record.entranceExam || record.intakeExam;
  const branch = record.branch || record.targetBranch;
  const year = record.admission_year || record.entryYear || record.joiningYear || record.year;

  if (exam && String(exam).toUpperCase() !== String(workspace.intakeExam).toUpperCase()) {
    return false;
  }
  if (branch && String(branch).toUpperCase() !== String(workspace.targetBranch).toUpperCase()) {
    return false;
  }
  if (year && !String(year).startsWith(String(workspace.entryYear))) {
    return false;
  }
  return true;
}

/**
 * Builds Drizzle ORM query conditions for filtering student admission drafts by workspace and status.
 */
export function buildAdmissionWorkspaceConditions(table, workspace, status = null) {
  const conditions = [];
  if (status) {
    conditions.push(eq(table.status, status));
  }
  if (workspace?.targetBranch) {
    conditions.push(eq(table.branch, workspace.targetBranch));
  }
  if (workspace?.intakeExam) {
    conditions.push(eq(table.entrance_exam, workspace.intakeExam));
  }
  if (workspace?.entryYear) {
    conditions.push(like(table.admission_year, `${workspace.entryYear}%`));
  }
  return conditions;
}
