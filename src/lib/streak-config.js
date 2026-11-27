/**
 * Attendance Streak & Custom Emoji Configuration
 *
 * NOTE ON PRODUCTION INTEGRITY:
 * In accordance with engineering invariants, no fake or arbitrary milestone
 * thresholds (e.g. 50, 100) are hardcoded. The configuration is designed to be
 * populated when the institution supplies final milestone numbers and emoji assets.
 */

/**
 * Attendance status evaluation policies for excused absences (NCC, MEDICAL).
 * This isolates business policy decisions so they can be easily reconfigured
 * based on official institution academic council guidelines.
 */
export const STREAK_ATTENDANCE_POLICIES = {
  EXCUSED_INCREMENTS: 'EXCUSED_INCREMENTS', // PRESENT, NCC, and MEDICAL all increment streak
  EXCUSED_PRESERVES: 'EXCUSED_PRESERVES',   // PRESENT increments, NCC & MEDICAL preserve streak (no increment, no break)
  STRICT_PRESENT_ONLY: 'STRICT_PRESENT_ONLY', // Only PRESENT increments; NCC & MEDICAL break streak
};

/**
 * Default active policy.
 * Can be overridden via system configuration or per-evaluation options.
 */
export const DEFAULT_STREAK_POLICY = STREAK_ATTENDANCE_POLICIES.EXCUSED_INCREMENTS;

/**
 * Resolves the active institutional attendance streak policy strictly from trusted server configuration.
 * Client requests CANNOT select or override this policy.
 * @returns {string} One of STREAK_ATTENDANCE_POLICIES
 */
export function getServerStreakPolicy() {
  const envPolicy = process.env.STREAK_ATTENDANCE_POLICY;
  if (envPolicy && STREAK_ATTENDANCE_POLICIES[envPolicy]) {
    return STREAK_ATTENDANCE_POLICIES[envPolicy];
  }
  return DEFAULT_STREAK_POLICY;
}

/**
 * Evaluates how an attendance status affects streak calculation under a given policy.
 * @param {string} status - Attendance status ('PRESENT', 'ABSENT', 'NCC', 'MEDICAL', 'UNRECORDED')
 * @param {string} [policy=DEFAULT_STREAK_POLICY]
 * @returns {{ action: 'INCREMENT' | 'PRESERVE' | 'BREAK', isAttended: boolean, isExcused: boolean }}
 */
export function evaluateAttendanceStatus(status, policy = DEFAULT_STREAK_POLICY) {
  if (status === 'PRESENT') {
    return { action: 'INCREMENT', isAttended: true, isExcused: false };
  }

  if (status === 'NCC' || status === 'MEDICAL') {
    if (policy === STREAK_ATTENDANCE_POLICIES.EXCUSED_INCREMENTS) {
      return { action: 'INCREMENT', isAttended: true, isExcused: true };
    }
    if (policy === STREAK_ATTENDANCE_POLICIES.EXCUSED_PRESERVES) {
      return { action: 'PRESERVE', isAttended: true, isExcused: true };
    }
    // STRICT_PRESENT_ONLY
    return { action: 'BREAK', isAttended: false, isExcused: true };
  }

  // ABSENT, UNRECORDED, or unknown status breaks streak
  return { action: 'BREAK', isAttended: false, isExcused: false };
}

/**
 * Default milestone tiers.
 * Kept empty until official college milestone tiers are provided.
 */
export const DEFAULT_STREAK_MILESTONES = [];

/**
 * Default active emoji for all students.
 */
export const DEFAULT_STREAK_EMOJI = {
  char: '🔥',
  code: 'fire',
  name: 'Attendance Flame'
};

/**
 * Validates a milestone configuration list to prevent duplicates or corrupted thresholds.
 * @param {Array} milestones
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMilestonesConfig(milestones) {
  if (!Array.isArray(milestones)) {
    return { valid: false, errors: ['Milestones configuration must be an array'] };
  }

  const errors = [];
  const seenCodes = new Set();
  const seenStreaks = new Set();

  for (const m of milestones) {
    if (!m.milestone_code || typeof m.milestone_code !== 'string') {
      errors.push(`Invalid milestone code for milestone: ${JSON.stringify(m)}`);
    } else if (seenCodes.has(m.milestone_code)) {
      errors.push(`Duplicate milestone_code: ${m.milestone_code}`);
    } else {
      seenCodes.add(m.milestone_code);
    }

    if (!Number.isInteger(m.required_streak) || m.required_streak <= 0) {
      errors.push(`Milestone ${m.milestone_code || 'unknown'} must have a positive integer required_streak`);
    } else if (seenStreaks.has(m.required_streak)) {
      errors.push(`Duplicate required_streak threshold: ${m.required_streak}`);
    } else {
      seenStreaks.add(m.required_streak);
    }

    if (!m.emoji_char && !m.asset_url) {
      errors.push(`Milestone ${m.milestone_code || 'unknown'} must provide either emoji_char or asset_url`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Evaluates a student's verified streak against active milestone tiers.
 * @param {number} streak - Current verified consecutive class count
 * @param {Array} milestones - Active milestone configuration
 * @returns {{
 *   nextMilestone: Object|null,
 *   unlockedMilestones: Array,
 *   milestoneProgress: { current: number, target: number, remaining: number, percentage: number }|null
 * }}
 */
export function evaluateMilestoneProgress(streak, milestones = []) {
  const verifiedStreak = Math.max(0, Number(streak) || 0);

  if (!Array.isArray(milestones) || milestones.length === 0) {
    return {
      nextMilestone: null,
      unlockedMilestones: [],
      milestoneProgress: null
    };
  }

  // Filter active and sort ascending by required streak
  const activeSorted = [...milestones]
    .filter(m => m.is_active !== false)
    .sort((a, b) => a.required_streak - b.required_streak);

  const unlockedMilestones = activeSorted.filter(m => verifiedStreak >= m.required_streak);
  const nextMilestone = activeSorted.find(m => verifiedStreak < m.required_streak) || null;

  let milestoneProgress = null;
  if (nextMilestone) {
    const target = nextMilestone.required_streak;
    const remaining = Math.max(0, target - verifiedStreak);
    const percentage = Math.min(100, Math.max(0, Math.round((verifiedStreak / target) * 100)));

    milestoneProgress = {
      current: verifiedStreak,
      target,
      remaining,
      percentage
    };
  }

  return {
    nextMilestone,
    unlockedMilestones,
    milestoneProgress
  };
}
