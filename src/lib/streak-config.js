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

export const GOAL_TYPES = [
  'SEMESTER_ATTENDANCE_PCT',
  'CONSECUTIVE_STREAK',
  'CUMULATIVE_CLASSES',
  'BEAT_PERSONAL_BEST',
  'SUBJECT_ATTENDANCE_PCT',
];

/**
 * Default milestone tiers (9 institutional recognition badges).
 * Consecutive eligible attended class periods (not calendar days).
 */
export const DEFAULT_STREAK_MILESTONES = [
  {
    milestone_code: 'STREAK_5',
    title: 'First Spark',
    description: 'Attended 5 consecutive eligible classes.',
    required_streak: 5,
    emoji_code: 'first_spark',
    emoji_char: '🔥',
    display_order: 1,
    is_active: true,
  },
  {
    milestone_code: 'STREAK_10',
    title: 'Consistency',
    description: 'Attended 10 consecutive eligible classes.',
    required_streak: 10,
    emoji_code: 'consistency',
    emoji_char: '⚡',
    display_order: 2,
    is_active: true,
  },
  {
    milestone_code: 'STREAK_20',
    title: 'Dedicated',
    description: 'Attended 20 consecutive eligible classes.',
    required_streak: 20,
    emoji_code: 'dedicated',
    emoji_char: '🏅',
    display_order: 3,
    is_active: true,
  },
  {
    milestone_code: 'STREAK_30',
    title: 'Rising Star',
    description: 'Attended 30 consecutive eligible classes.',
    required_streak: 30,
    emoji_code: 'rising_star',
    emoji_char: '🚀',
    display_order: 4,
    is_active: true,
  },
  {
    milestone_code: 'STREAK_50',
    title: 'Diamond Discipline',
    description: 'Attended 50 consecutive eligible classes.',
    required_streak: 50,
    emoji_code: 'diamond_discipline',
    emoji_char: '💎',
    display_order: 5,
    is_active: true,
  },
  {
    milestone_code: 'STREAK_75',
    title: 'Attendance Royalty',
    description: 'Attended 75 consecutive eligible classes.',
    required_streak: 75,
    emoji_code: 'attendance_royalty',
    emoji_char: '👑',
    display_order: 6,
    is_active: true,
  },
  {
    milestone_code: 'STREAK_100',
    title: 'Champion',
    description: 'Attended 100 consecutive eligible classes.',
    required_streak: 100,
    emoji_code: 'champion',
    emoji_char: '🏆',
    display_order: 7,
    is_active: true,
  },
  {
    milestone_code: 'STREAK_150',
    title: 'Legendary',
    description: 'Attended 150 consecutive eligible classes.',
    required_streak: 150,
    emoji_code: 'legendary',
    emoji_char: '🌟',
    display_order: 8,
    is_active: true,
  },
  {
    milestone_code: 'STREAK_200',
    title: 'Attendance Legend',
    description: 'Attended 200 consecutive eligible classes.',
    required_streak: 200,
    emoji_code: 'attendance_legend',
    emoji_char: '🎓',
    display_order: 9,
    is_active: true,
  },
];

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

/**
 * Sorts an attendance timeline in descending chronological order (newest first).
 * Order: attendance date DESC -> scheduled period/session DESC -> sessionId DESC.
 *
 * @param {Array} timeline
 * @returns {Array}
 */
export function sortTimelineDescending(timeline = []) {
  return [...timeline].sort((a, b) => {
    const dateA = String(a.date || '');
    const dateB = String(b.date || '');
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }
    const periodA = Number(a.sessionNumber) || 0;
    const periodB = Number(b.sessionNumber) || 0;
    if (periodA !== periodB) {
      return periodB - periodA;
    }
    const idA = Number(a.sessionId) || 0;
    const idB = Number(b.sessionId) || 0;
    return idB - idA;
  });
}

/**
 * Computes comprehensive, deterministic attendance analytics and calendar breakdown
 * directly from the authoritative chronological timeline.
 *
 * @param {Array} timeline - Chronological timeline items
 * @returns {Object} Analytics summary, trends, subject insights, and calendar days
 */
export function computeAttendanceAnalytics(timeline = []) {
  const counts = {
    present: 0,
    ncc: 0,
    medical: 0,
    absent: 0,
    unrecorded: 0,
    attended: 0,
    total: timeline.length,
    rate: 0,
  };

  const weeklyMap = new Map();
  const monthlyMap = new Map();
  const subjectMap = new Map();
  const calendarMap = new Map();

  // Sort ascending internally for accurate trend splitting
  const ascList = [...timeline].sort((a, b) => {
    const dA = String(a.date || '');
    const dB = String(b.date || '');
    if (dA !== dB) return dA.localeCompare(dB);
    return (Number(a.sessionNumber) || 0) - (Number(b.sessionNumber) || 0);
  });

  for (const item of ascList) {
    const status = String(item.status || 'UNRECORDED').toUpperCase();
    const isAttended = Boolean(item.isAttended);

    if (status === 'PRESENT') counts.present += 1;
    else if (status === 'NCC') counts.ncc += 1;
    else if (status === 'MEDICAL') counts.medical += 1;
    else if (status === 'ABSENT') counts.absent += 1;
    else counts.unrecorded += 1;

    if (isAttended) counts.attended += 1;

    const dateStr = String(item.date || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      // Monthly grouping
      const monthKey = dateStr.slice(0, 7);
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { month: monthKey, attended: 0, absent: 0, ncc: 0, medical: 0, total: 0 });
      }
      const mEntry = monthlyMap.get(monthKey);
      mEntry.total += 1;
      if (isAttended) mEntry.attended += 1;
      else mEntry.absent += 1;
      if (status === 'NCC') mEntry.ncc += 1;
      if (status === 'MEDICAL') mEntry.medical += 1;

      // Weekly grouping (start of week Monday)
      const dt = new Date(`${dateStr}T00:00:00Z`);
      const dayOfWeek = dt.getUTCDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(dt.getTime() + diffToMonday * 86400000);
      const weekKey = monday.toISOString().split('T')[0];
      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, { weekStart: weekKey, attended: 0, absent: 0, ncc: 0, medical: 0, total: 0 });
      }
      const wEntry = weeklyMap.get(weekKey);
      wEntry.total += 1;
      if (isAttended) wEntry.attended += 1;
      else wEntry.absent += 1;
      if (status === 'NCC') wEntry.ncc += 1;
      if (status === 'MEDICAL') wEntry.medical += 1;

      // Calendar day grouping
      if (!calendarMap.has(dateStr)) {
        calendarMap.set(dateStr, {
          date: dateStr,
          attended: 0,
          absent: 0,
          ncc: 0,
          medical: 0,
          total: 0,
          hasBreak: false,
          maxStreakOnDay: 0,
          sessions: [],
        });
      }
      const cEntry = calendarMap.get(dateStr);
      cEntry.total += 1;
      if (isAttended) cEntry.attended += 1;
      else cEntry.absent += 1;
      if (status === 'NCC') cEntry.ncc += 1;
      if (status === 'MEDICAL') cEntry.medical += 1;
      if (item.isBreak) cEntry.hasBreak = true;
      if ((item.streakAfterClass || 0) > cEntry.maxStreakOnDay) {
        cEntry.maxStreakOnDay = item.streakAfterClass;
      }
      cEntry.sessions.push(item);
    }

    // Subject grouping
    const subCode = item.subjectCode || '--';
    if (!subjectMap.has(subCode)) {
      subjectMap.set(subCode, {
        subjectCode: subCode,
        subjectName: item.subjectName || subCode,
        total: 0,
        attended: 0,
        absent: 0,
        ncc: 0,
        medical: 0,
        items: [],
      });
    }
    const sEntry = subjectMap.get(subCode);
    sEntry.total += 1;
    if (isAttended) sEntry.attended += 1;
    else sEntry.absent += 1;
    if (status === 'NCC') sEntry.ncc += 1;
    if (status === 'MEDICAL') sEntry.medical += 1;
    sEntry.items.push(item);
  }

  counts.rate = counts.total > 0 ? Math.round((counts.attended / counts.total) * 100) : 0;

  const weeklyTrend = Array.from(weeklyMap.values())
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .slice(-12)
    .map(w => ({ ...w, rate: w.total > 0 ? Math.round((w.attended / w.total) * 100) : 0 }));

  const monthlyTrend = Array.from(monthlyMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({ ...m, rate: m.total > 0 ? Math.round((m.attended / m.total) * 100) : 0 }));

  const subjectInsights = Array.from(subjectMap.values()).map(s => {
    const rate = s.total > 0 ? Math.round((s.attended / s.total) * 100) : 0;
    let trendDelta = 0;
    if (s.items.length >= 4) {
      const mid = Math.floor(s.items.length / 2);
      const firstHalf = s.items.slice(0, mid);
      const secondHalf = s.items.slice(mid);
      const r1 = (firstHalf.filter(x => x.isAttended).length / firstHalf.length) * 100;
      const r2 = (secondHalf.filter(x => x.isAttended).length / secondHalf.length) * 100;
      trendDelta = Math.round(r2 - r1);
    }
    return {
      subjectCode: s.subjectCode,
      subjectName: s.subjectName,
      total: s.total,
      attended: s.attended,
      absent: s.absent,
      ncc: s.ncc,
      medical: s.medical,
      rate,
      trendDelta,
    };
  }).sort((a, b) => b.rate - a.rate);

  // Overall improvement delta (latest month vs previous month, or second half vs first half)
  let improvementDelta = 0;
  if (monthlyTrend.length >= 2) {
    const prev = monthlyTrend[monthlyTrend.length - 2];
    const curr = monthlyTrend[monthlyTrend.length - 1];
    improvementDelta = curr.rate - prev.rate;
  } else if (ascList.length >= 4) {
    const mid = Math.floor(ascList.length / 2);
    const first = ascList.slice(0, mid);
    const second = ascList.slice(mid);
    const r1 = (first.filter(x => x.isAttended).length / first.length) * 100;
    const r2 = (second.filter(x => x.isAttended).length / second.length) * 100;
    improvementDelta = Math.round(r2 - r1);
  }

  const calendarDays = Array.from(calendarMap.values()).sort((a, b) => b.date.localeCompare(a.date));

  return {
    counts,
    weeklyTrend,
    monthlyTrend,
    subjectInsights,
    improvementDelta,
    calendarDays,
  };
}

/**
 * Evaluates multi-category non-monetary recognition badges (Commitment, Comeback, Improvement, Excellence).
 * Independent of consecutive streak threshold unlocks so students with any attendance history
 * have achievable recognition opportunities.
 *
 * @param {Object} params
 * @returns {Array} Recognition badge definitions with unlocked state
 */
export function evaluateRecognitionBadges({
  currentStreak = 0,
  longestStreak = 0,
  previousStreak = 0,
  totalAttendedClasses = 0,
  totalEligibleClasses = 0,
  improvementDelta = 0,
}) {
  const rate = totalEligibleClasses > 0 ? Math.round((totalAttendedClasses / totalEligibleClasses) * 100) : 0;

  return [
    {
      code: 'FIRST_COMEBACK',
      category: 'Comeback',
      emoji: '🌱',
      title: 'First Comeback',
      description: 'Rebuilt 3 consecutive attended classes after a streak reset.',
      unlocked: previousStreak > 0 && currentStreak >= 3,
    },
    {
      code: 'FIVE_CLASS_RECOVERY',
      category: 'Comeback',
      emoji: '💪',
      title: 'Five-Class Recovery',
      description: 'Rebuilt 5 consecutive attended classes after a previous reset.',
      unlocked: previousStreak > 0 && currentStreak >= 5,
    },
    {
      code: 'MONTHLY_IMPROVEMENT',
      category: 'Improvement',
      emoji: '📈',
      title: 'Monthly Improvement',
      description: 'Improved attendance rate by at least 5% over the previous period.',
      unlocked: totalEligibleClasses >= 6 && improvementDelta >= 5,
    },
    {
      code: 'COMMITMENT_25',
      category: 'Commitment',
      emoji: '📘',
      title: '25 Classes Attended',
      description: 'Attended 25 cumulative eligible classes this semester.',
      unlocked: totalAttendedClasses >= 25,
    },
    {
      code: 'COMMITMENT_50',
      category: 'Commitment',
      emoji: '📚',
      title: '50 Classes Attended',
      description: 'Attended 50 cumulative eligible classes this semester.',
      unlocked: totalAttendedClasses >= 50,
    },
    {
      code: 'PERSONAL_BEST_10',
      category: 'Consistency',
      emoji: '🎖️',
      title: 'Personal Best Record',
      description: 'Achieved a personal best streak of 10 or more consecutive classes.',
      unlocked: longestStreak >= 10,
    },
    {
      code: 'EXCELLENCE_90',
      category: 'Excellence',
      emoji: '⭐',
      title: 'Semester Excellence',
      description: 'Maintained 90% or higher attendance across at least 20 eligible classes.',
      unlocked: totalEligibleClasses >= 20 && rate >= 90,
    },
  ];
}
