import { db } from '@/db';
import {
  students as studentsTable,
  attendanceStreakMilestones,
  studentStreakUnlocks,
  studentStreakPreferences,
  studentStreakReconciliationLogs,
  studentStreakSnapshots
} from '@/db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { calculateYearAndSemesterAsync, getCollegeAcademicYear } from '@/lib/academic-utils';
import { getBranchFromRoll } from '@/lib/rollNumber';
import { UnifiedAttendanceRepository, normalizeDateStr } from './UnifiedAttendanceRepository';
import {
  DEFAULT_STREAK_EMOJI,
  DEFAULT_STREAK_MILESTONES,
  SNAPSHOT_CALCULATION_VERSION,
  getServerStreakPolicy,
  evaluateAttendanceStatus,
  evaluateMilestoneProgress,
  computeAttendanceAnalytics,
  evaluateRecognitionBadges,
  sortTimelineDescending
} from '@/lib/streak-config';

export { sortTimelineDescending };

/**
 * Pure calculation helper: deterministic calculation of streaks from memory records.
 * Can be used in unit tests and production logic alike.
 *
 * @param {Array} eligibleSessions - Sorted ascending by date and period
 * @param {Array} studentRecords - Raw rows from student_attendance
 * @param {Object} [options] - Optional calculation parameters
 * @param {string} [options.policy] - Attendance status evaluation policy (defaults to server policy)
 * @returns {Object} Deterministic streak metrics and timeline
 */
export function calculateStreakFromSequence(eligibleSessions = [], studentRecords = [], options = {}) {
  const policy = options.policy || getServerStreakPolicy();
  let currentStreak = 0;
  let longestStreak = 0;
  let previousStreak = 0;
  let lastAttendedClass = null;
  let lastStreakBreak = null;
  let totalAttended = 0;
  let totalMissed = 0;

  // Multi-tier lookup maps for robust matching across legacy and new attendance schemas
  // Tier 1: By sessionId: session_id -> record
  // Tier 2: By composite slot: `${assignment_id}_${dateStr}_${session}` -> record
  // Tier 3 Collision Analysis: grouped by date & session
  const recordBySessionId = new Map();
  const recordByAssignmentSlot = new Map();
  const recordsByDateSession = new Map();

  for (const r of studentRecords) {
    const dateStr = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date);
    if (r.session_id) {
      recordBySessionId.set(Number(r.session_id), r);
    }
    if (r.assignment_id && r.session) {
      recordByAssignmentSlot.set(`${r.assignment_id}_${dateStr}_${r.session}`, r);
    }
    if (r.session) {
      const dsKey = `${dateStr}_${r.session}`;
      if (!recordsByDateSession.has(dsKey)) {
        recordsByDateSession.set(dsKey, []);
      }
      recordsByDateSession.get(dsKey).push(r);
    }
  }

  const timeline = [];

  for (const session of eligibleSessions) {
    const sessionDateStr = session.attendance_date instanceof Date
      ? session.attendance_date.toISOString().split('T')[0]
      : String(session.attendance_date);

    // Multi-tier resolution with defensive collision rejection:
    // 1. Tier 1: Exact session_id match (canonical)
    // 2. Tier 2: Exact assignment slot match (assignment_id + date + session_number)
    // 3. Fallback: Only permit if unassigned AND unambiguous (single record with no assignment_id)
    let matchedRecord = null;
    if (session.id && recordBySessionId.has(Number(session.id))) {
      matchedRecord = recordBySessionId.get(Number(session.id));
    } else if (session.assignment_id && session.session_number) {
      const assignmentSlotKey = `${session.assignment_id}_${sessionDateStr}_${session.session_number}`;
      if (recordByAssignmentSlot.has(assignmentSlotKey)) {
        matchedRecord = recordByAssignmentSlot.get(assignmentSlotKey);
      }
    }

    if (!matchedRecord && session.session_number) {
      const dateSessionKey = `${sessionDateStr}_${session.session_number}`;
      const candidates = recordsByDateSession.get(dateSessionKey) || [];

      // Collision guard: if a record exists for this slot but belongs to a different assignment
      const conflictingAssignments = candidates.filter(r => r.assignment_id && r.assignment_id !== session.assignment_id);
      const unassignedCandidates = candidates.filter(r => !r.assignment_id);

      if (conflictingAssignments.length > 0) {
        // Colliding slot: Record belongs to a different subject. Reject match.
        matchedRecord = null;
      } else if (unassignedCandidates.length === 1) {
        // Exactly one unassigned candidate (legacy or test fixture without assignment_id)
        matchedRecord = unassignedCandidates[0];
      } else if (unassignedCandidates.length > 1) {
        // Ambiguous match: multiple unassigned records for the same slot. Reject safely.
        matchedRecord = null;
      }
    }

    const sessionInfo = {
      sessionId: session.id,
      assignmentId: session.assignment_id,
      date: sessionDateStr,
      sessionNumber: session.session_number,
      batchNumber: session.batch_number || 0,
      subjectCode: session.subject_code || '--',
      subjectName: session.subject_name || 'Class Session',
      topic: session.topic_covered || null,
    };

    let status = 'UNRECORDED';
    if (matchedRecord) {
      status = matchedRecord.status;
    }

    const evaluation = evaluateAttendanceStatus(status, policy);

    if (evaluation.action === 'INCREMENT') {
      currentStreak += 1;
      totalAttended += 1;
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }
      lastAttendedClass = {
        ...sessionInfo,
        status,
        streakAfterClass: currentStreak,
      };
      timeline.push({
        ...sessionInfo,
        status,
        isAttended: true,
        isExcused: evaluation.isExcused,
        isBreak: false,
        streakAfterClass: currentStreak,
      });
    } else if (evaluation.action === 'PRESERVE') {
      // Excused under PRESERVE policy: counts as attended / authorized duty, streak is preserved (neither reset nor incremented)
      totalAttended += 1;
      lastAttendedClass = {
        ...sessionInfo,
        status,
        streakAfterClass: currentStreak,
      };
      timeline.push({
        ...sessionInfo,
        status,
        isAttended: true,
        isExcused: true,
        isBreak: false,
        streakAfterClass: currentStreak,
      });
    } else {
      // BREAK: Missed class (ABSENT, UNRECORDED in a finalized session, or excused under STRICT policy)
      if (currentStreak > 0) {
        previousStreak = currentStreak;
      }
      currentStreak = 0;
      totalMissed += 1;
      lastStreakBreak = {
        ...sessionInfo,
        status: status === 'UNRECORDED' ? 'ABSENT (UNRECORDED)' : status,
        streakAfterClass: 0,
      };
      timeline.push({
        ...sessionInfo,
        status: status === 'UNRECORDED' ? 'UNRECORDED' : status,
        isAttended: false,
        isExcused: evaluation.isExcused,
        isBreak: true,
        streakAfterClass: 0,
      });
    }
  }

  return {
    currentStreak,
    longestStreak,
    previousStreak,
    totalEligibleClasses: eligibleSessions.length,
    totalAttendedClasses: totalAttended,
    totalMissedClasses: totalMissed,
    lastAttendedClass,
    lastStreakBreak,
    timeline,
  };
}

export class StreakService {
  /**
   * Retrieves active milestone definitions from database or config.
   * @param {Object} [dbClient]
   * @returns {Promise<Array>}
   */
  static async getActiveMilestones(dbClient = null) {
    const executor = dbClient || db;
    try {
      let rows = await executor
        .select()
        .from(attendanceStreakMilestones)
        .where(eq(attendanceStreakMilestones.is_active, true))
        .orderBy(asc(attendanceStreakMilestones.required_streak));

      if (!rows || rows.length === 0) {
        const [totalRow] = await executor
          .select({ count: sql`COUNT(*)` })
          .from(attendanceStreakMilestones);
        const totalCount = Number(totalRow?.count || 0);
        if (totalCount === 0 && DEFAULT_STREAK_MILESTONES.length > 0) {
          for (const m of DEFAULT_STREAK_MILESTONES) {
            await executor
              .insert(attendanceStreakMilestones)
              .values(m)
              .onDuplicateKeyUpdate({ set: { milestone_code: m.milestone_code } });
          }
          rows = await executor
            .select()
            .from(attendanceStreakMilestones)
            .where(eq(attendanceStreakMilestones.is_active, true))
            .orderBy(asc(attendanceStreakMilestones.required_streak));
        }
      }
      return rows || [];
    } catch (_err) {
      // Table may not yet be migrated in development/test
      return DEFAULT_STREAK_MILESTONES;
    }
  }

  /**
   * Retrieves the student's selected streak emoji.
   * @param {number} studentId
   * @param {Object} [dbClient]
   * @returns {Promise<{ char: string, code: string }>}
   */
  static async getStudentSelectedEmoji(studentId, dbClient = null) {
    const executor = dbClient || db;
    try {
      const rows = await executor
        .select({
          selected_emoji_char: studentStreakPreferences.selected_emoji_char,
          selected_emoji_code: studentStreakPreferences.selected_emoji_code,
        })
        .from(studentStreakPreferences)
        .where(eq(studentStreakPreferences.student_id, studentId))
        .limit(1);

      if (rows && rows.length > 0) {
        return {
          char: rows[0].selected_emoji_char || DEFAULT_STREAK_EMOJI.char,
          code: rows[0].selected_emoji_code || DEFAULT_STREAK_EMOJI.code,
        };
      }
    } catch (_err) {
      // Graceful fallback to default flame
    }

    return {
      char: DEFAULT_STREAK_EMOJI.char,
      code: DEFAULT_STREAK_EMOJI.code,
    };
  }

  /**
   * Calculates comprehensive streak metrics for an authenticated student.
   * By default (when no explicit semester/academicYear filter is provided or when
   * `includeAllSemesters: true` is passed), evaluates seamlessly across ALL semesters,
   * academic years, and archived records using UnifiedAttendanceRepository.
   *
   * @param {Object} params
   * @param {number} params.studentId
   * @param {string} params.rollNo
   * @param {number} [params.semester]
   * @param {string} [params.academicYear]
   * @param {string} [params.branch]
   * @param {boolean} [params.includeAllSemesters]
   * @param {string} [params.policy]
   * @param {Object} [params.dbClient]
   * @returns {Promise<Object>} Streak summary, progress, milestones, and recent timeline
   */
  static async calculateStudentStreak({
    studentId,
    rollNo,
    semester: inputSemester,
    academicYear: inputAcademicYear,
    branch: inputBranch,
    includeAllSemesters,
    policy = getServerStreakPolicy(),
    dbClient = null,
  }) {
    const executor = dbClient || db;
    const resolveAllSemesters =
      includeAllSemesters !== undefined
        ? Boolean(includeAllSemesters)
        : !inputSemester && !inputAcademicYear;

    // 1. Resolve student context
    let semester = inputSemester;
    let academicYear = inputAcademicYear;
    let branch = inputBranch;

    if ((!semester || !academicYear || !branch) && rollNo) {
      try {
        const session = await calculateYearAndSemesterAsync(rollNo, 0);
        semester = semester || session.semester;
        academicYear = academicYear || session.academicYear || await getCollegeAcademicYear();
        branch = branch || getBranchFromRoll(rollNo);
      } catch (_ctxErr) {
        branch = branch || getBranchFromRoll(rollNo);
      }
    } else if (!branch && rollNo) {
      branch = getBranchFromRoll(rollNo);
    }

    if (!studentId || (!resolveAllSemesters && (!semester || !academicYear || !branch))) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        previousStreak: 0,
        totalEligibleClasses: 0,
        totalAttendedClasses: 0,
        totalMissedClasses: 0,
        lastAttendedClass: null,
        lastStreakBreak: null,
        nextMilestone: null,
        milestoneProgress: null,
        policyApplied: policy,
        selectedEmoji: { char: DEFAULT_STREAK_EMOJI.char, code: DEFAULT_STREAK_EMOJI.code },
        unlockedMilestones: [],
        lockedMilestones: [],
        allMilestones: [],
        timeline: [],
      };
    }

    // 2. Load authoritative dataset across active + archived cohorts via UnifiedAttendanceRepository
    const {
      assignments,
      assignmentMap,
      studentBatchByCohortSubject,
      studentBatchBySubject,
      allSessions,
      studentRecords,
    } = await UnifiedAttendanceRepository.getStreakCalculationDataset({
      studentId,
      semester,
      academicYear,
      branch,
      includeAllSemesters: resolveAllSemesters,
      dbClient: executor,
    });

    if (assignments.length === 0) {
      const selectedEmoji = await this.getStudentSelectedEmoji(studentId, executor);
      const milestones = await this.getActiveMilestones(executor);
      const { nextMilestone, milestoneProgress } = evaluateMilestoneProgress(0, milestones);
      const allMilestones = milestones.map(m => ({
        ...m,
        isUnlocked: false,
        unlockedAt: null,
        verifiedStreak: null,
        remainingClasses: m.required_streak,
      }));
      return {
        currentStreak: 0,
        longestStreak: 0,
        previousStreak: 0,
        totalEligibleClasses: 0,
        totalAttendedClasses: 0,
        totalMissedClasses: 0,
        lastAttendedClass: null,
        lastStreakBreak: null,
        nextMilestone,
        milestoneProgress,
        policyApplied: policy,
        selectedEmoji,
        unlockedMilestones: [],
        lockedMilestones: allMilestones,
        allMilestones,
        timeline: [],
      };
    }

    const studentRecordSessionIds = new Set(studentRecords.map(r => r.session_id).filter(Boolean));
    const studentRecordSlotKeys = new Set(
      studentRecords.map(r => `${r.assignment_id}_${normalizeDateStr(r.date)}_${r.session}`)
    );

    // 3. Filter eligible sessions for this specific student:
    // - Whole-class session (batch_number = 0 or NULL): eligible for all students
    // - Batch-specific session (batch_number = 1 or 2): eligible ONLY IF:
    //     a) Student's allocated batch for that subject matches session.batch_number, OR
    //     b) Student has an actual attendance record for this session
    const eligibleSessions = [];
    for (const session of allSessions) {
      const assignment = assignmentMap.get(Number(session.assignment_id));
      if (!assignment) continue;

      const cohortKey = `${assignment.academic_year}_${assignment.course_semester}_${assignment.subject_code}`;
      const allocatedBatch =
        studentBatchByCohortSubject.get(cohortKey) ??
        studentBatchBySubject.get(assignment.subject_code) ??
        null;
      const batchNum = session.batch_number || 0;
      const sessionSlotKey = `${session.assignment_id}_${normalizeDateStr(session.attendance_date)}_${session.session_number}`;

      let isEligible = false;
      if (batchNum === 0) {
        isEligible = true;
      } else if (allocatedBatch !== null && allocatedBatch === batchNum) {
        isEligible = true;
      } else if (studentRecordSessionIds.has(session.id) || studentRecordSlotKeys.has(sessionSlotKey)) {
        isEligible = true;
      }

      if (isEligible) {
        eligibleSessions.push({
          ...session,
          subject_code: assignment.subject_code,
          subject_name: assignment.subject_name,
        });
      }
    }

    // 4. Deterministic chronological streak calculation
    const streakResult = calculateStreakFromSequence(eligibleSessions, studentRecords, { policy });

    // 5. Milestone and Custom Emoji Evaluation
    const milestones = await this.getActiveMilestones(executor);
    const { nextMilestone, unlockedMilestones: newlyUnlocked, milestoneProgress } = evaluateMilestoneProgress(
      Math.max(streakResult.currentStreak, streakResult.longestStreak),
      milestones
    );

    const selectedEmoji = await this.getStudentSelectedEmoji(studentId, executor);

    // 6. Record new unlocks idempotently if supported
    if (newlyUnlocked.length > 0) {
      try {
        const achievedStreak = Math.max(streakResult.currentStreak, streakResult.longestStreak);
        for (const m of newlyUnlocked) {
          if (!m.id) continue;
          await executor
            .insert(studentStreakUnlocks)
            .values({
              student_id: studentId,
              milestone_id: m.id,
              verified_streak: achievedStreak,
              is_notified: false,
            })
            .onDuplicateKeyUpdate({
              set: {
                verified_streak: sql`GREATEST(${studentStreakUnlocks.verified_streak}, ${achievedStreak})`,
              }
            });
        }
      } catch (_unlockErr) {
        // Handled gracefully if table is not yet migrated
      }
    }

    // 7. Merge persisted unlocks so students retain previously unlocked achievements
    const persistedUnlockMap = new Map();
    try {
      const unlockRows = await executor
        .select()
        .from(studentStreakUnlocks)
        .where(eq(studentStreakUnlocks.student_id, studentId));
      for (const row of unlockRows || []) {
        persistedUnlockMap.set(Number(row.milestone_id), row);
      }
    } catch (_err) {
      // Graceful fallback when table is not yet migrated
    }

    const allMilestones = [];
    const resolvedUnlockedMilestones = [];
    const lockedMilestones = [];

    for (const m of milestones) {
      const persisted = m.id ? persistedUnlockMap.get(Number(m.id)) : null;
      const isUnlocked =
        Boolean(persisted) ||
        streakResult.currentStreak >= m.required_streak ||
        streakResult.longestStreak >= m.required_streak;
      const enriched = {
        ...m,
        isUnlocked,
        unlockedAt: persisted?.unlocked_at || null,
        verifiedStreak: persisted?.verified_streak || (isUnlocked ? Math.max(streakResult.currentStreak, streakResult.longestStreak) : null),
        remainingClasses: isUnlocked ? 0 : Math.max(0, m.required_streak - streakResult.currentStreak),
      };
      allMilestones.push(enriched);
      if (isUnlocked) {
        resolvedUnlockedMilestones.push(enriched);
      } else {
        lockedMilestones.push(enriched);
      }
    }

    // Recompute nextMilestone / progress based on currentStreak against unearned or next tier
    const nextProgress = evaluateMilestoneProgress(streakResult.currentStreak, milestones);

    // 8. Refresh derived streak snapshot when evaluating full lifetime scope
    if (resolveAllSemesters) {
      const lastSession = eligibleSessions[eligibleSessions.length - 1] || null;
      const snapshotPayload = {
        student_id: studentId,
        current_streak: streakResult.currentStreak,
        longest_streak: streakResult.longestStreak,
        previous_streak: streakResult.previousStreak,
        total_eligible_classes: streakResult.totalEligibleClasses,
        total_attended_classes: streakResult.totalAttendedClasses,
        total_missed_classes: streakResult.totalMissedClasses,
        last_evaluated_session_id: lastSession?.id && lastSession.id > 0 ? lastSession.id : null,
        last_evaluated_date: lastSession ? normalizeDateStr(lastSession.attendance_date) : null,
        last_attended_date: streakResult.lastAttendedClass ? normalizeDateStr(streakResult.lastAttendedClass.date) : null,
        last_break_date: streakResult.lastStreakBreak ? normalizeDateStr(streakResult.lastStreakBreak.date) : null,
        calculation_version: SNAPSHOT_CALCULATION_VERSION,
        policy_applied: policy,
        is_stale: false,
      };
      try {
        await executor
          .insert(studentStreakSnapshots)
          .values(snapshotPayload)
          .onDuplicateKeyUpdate({
            set: {
              current_streak: snapshotPayload.current_streak,
              longest_streak: snapshotPayload.longest_streak,
              previous_streak: snapshotPayload.previous_streak,
              total_eligible_classes: snapshotPayload.total_eligible_classes,
              total_attended_classes: snapshotPayload.total_attended_classes,
              total_missed_classes: snapshotPayload.total_missed_classes,
              last_evaluated_session_id: snapshotPayload.last_evaluated_session_id,
              last_evaluated_date: snapshotPayload.last_evaluated_date,
              last_attended_date: snapshotPayload.last_attended_date,
              last_break_date: snapshotPayload.last_break_date,
              calculation_version: snapshotPayload.calculation_version,
              policy_applied: snapshotPayload.policy_applied,
              is_stale: false,
            },
          });
      } catch (_snapErr) {
        // Non-fatal in pre-migration or mocked environments
      }
    }

    const analytics = computeAttendanceAnalytics(streakResult.timeline);
    const recognitionBadges = evaluateRecognitionBadges({
      currentStreak: streakResult.currentStreak,
      longestStreak: streakResult.longestStreak,
      previousStreak: streakResult.previousStreak,
      totalAttendedClasses: streakResult.totalAttendedClasses,
      totalEligibleClasses: streakResult.totalEligibleClasses,
      improvementDelta: analytics.improvementDelta,
    });
    const recentAchievement = resolvedUnlockedMilestones.length > 0
      ? resolvedUnlockedMilestones[resolvedUnlockedMilestones.length - 1]
      : null;

    return {
      ...streakResult,
      counts: analytics.counts,
      improvementDelta: analytics.improvementDelta,
      nextMilestone: nextProgress.nextMilestone || nextMilestone,
      milestoneProgress: nextProgress.milestoneProgress || milestoneProgress,
      policyApplied: policy,
      selectedEmoji,
      unlockedMilestones: resolvedUnlockedMilestones,
      lockedMilestones,
      allMilestones,
      recognitionBadges,
      recentAchievement,
    };
  }

  /**
   * Reads derived streak snapshot if fresh (`is_stale = false` and matching version/policy);
   * otherwise triggers full authoritative recalculation from source records.
   */
  static async getSnapshotOrRecalculate({ studentId, rollNo, policy = getServerStreakPolicy(), dbClient = null }) {
    const executor = dbClient || db;
    try {
      const [snapshot] = await executor
        .select()
        .from(studentStreakSnapshots)
        .where(eq(studentStreakSnapshots.student_id, studentId))
        .limit(1);

      if (
        snapshot &&
        !snapshot.is_stale &&
        Number(snapshot.calculation_version) === SNAPSHOT_CALCULATION_VERSION &&
        snapshot.policy_applied === policy
      ) {
        const [selectedEmoji, milestones, unlockRows] = await Promise.all([
          this.getStudentSelectedEmoji(studentId, executor),
          this.getActiveMilestones(executor),
          executor.select().from(studentStreakUnlocks).where(eq(studentStreakUnlocks.student_id, studentId)),
        ]);
        const unlockMap = new Map((unlockRows || []).map(r => [Number(r.milestone_id), r]));
        const { nextMilestone, milestoneProgress } = evaluateMilestoneProgress(snapshot.current_streak, milestones);
        const allMilestones = milestones.map(m => {
          const persisted = m.id ? unlockMap.get(Number(m.id)) : null;
          const isUnlocked = Boolean(persisted) || snapshot.current_streak >= m.required_streak || snapshot.longest_streak >= m.required_streak;
          return {
            ...m,
            isUnlocked,
            unlockedAt: persisted?.unlocked_at || null,
            verifiedStreak: persisted?.verified_streak || (isUnlocked ? snapshot.longest_streak : null),
            remainingClasses: isUnlocked ? 0 : Math.max(0, m.required_streak - snapshot.current_streak),
          };
        });
        const unlockedList = allMilestones.filter(m => m.isUnlocked);
        const recognitionBadges = evaluateRecognitionBadges({
          currentStreak: snapshot.current_streak,
          longestStreak: snapshot.longest_streak,
          previousStreak: snapshot.previous_streak,
          totalAttendedClasses: snapshot.total_attended_classes,
          totalEligibleClasses: snapshot.total_eligible_classes,
          improvementDelta: 0,
        });
        return {
          fromSnapshot: true,
          currentStreak: snapshot.current_streak,
          longestStreak: snapshot.longest_streak,
          previousStreak: snapshot.previous_streak,
          totalEligibleClasses: snapshot.total_eligible_classes,
          totalAttendedClasses: snapshot.total_attended_classes,
          totalMissedClasses: snapshot.total_missed_classes,
          lastAttendedClass: snapshot.last_attended_date ? { date: snapshot.last_attended_date } : null,
          lastStreakBreak: snapshot.last_break_date ? { date: snapshot.last_break_date } : null,
          nextMilestone,
          milestoneProgress,
          policyApplied: policy,
          selectedEmoji,
          unlockedMilestones: unlockedList,
          lockedMilestones: allMilestones.filter(m => !m.isUnlocked),
          allMilestones,
          recognitionBadges,
          recentAchievement: unlockedList.length > 0 ? unlockedList[unlockedList.length - 1] : null,
        };
      }
    } catch (_err) {
      // Fall back to authoritative recalculation
    }

    return await this.calculateStudentStreak({
      studentId,
      rollNo,
      includeAllSemesters: true,
      policy,
      dbClient: executor,
    });
  }

  /**
   * Authoritative reconciliation after a faculty-approved attendance dispute or manual correction.
   * Recalculates the full chronological sequence, awards newly earned milestones idempotently,
   * syncs personal goals, writes an auditable reconciliation log, and emits idempotent notifications.
   */
  static async reconcileStudentAfterCorrection({
    studentId,
    rollNo: inputRollNo = null,
    semester = null,
    academicYear = null,
    branch = null,
    triggerSource = 'DISPUTE_APPROVAL',
    referenceId = null,
    previousStreak = 0,
    previousLongest = 0,
    notes = null,
    dbClient = null,
  }) {
    const executor = dbClient || db;
    let rollNo = inputRollNo;

    if (!rollNo && studentId) {
      const [studentRow] = await executor
        .select({ roll_no: studentsTable.roll_no })
        .from(studentsTable)
        .where(eq(studentsTable.id, studentId))
        .limit(1);
      rollNo = studentRow?.roll_no || null;
    }

    if (!studentId || !rollNo) {
      return { success: false, reason: 'Missing student context for reconciliation' };
    }

    await UnifiedAttendanceRepository.invalidateStreakSnapshots([studentId], executor);

    const streakData = await this.calculateStudentStreak({
      studentId,
      rollNo,
      semester: semester || undefined,
      academicYear: academicYear || undefined,
      branch: branch || undefined,
      includeAllSemesters: true,
      dbClient: executor,
    });

    // Write auditable reconciliation log
    try {
      await executor.insert(studentStreakReconciliationLogs).values({
        student_id: studentId,
        trigger_source: triggerSource,
        reference_id: referenceId ? Number(referenceId) : null,
        previous_streak: Number(previousStreak) || 0,
        new_streak: streakData.currentStreak || 0,
        previous_longest: Number(previousLongest) || 0,
        new_longest: streakData.longestStreak || 0,
        notes: notes || `Recalculated via ${triggerSource}`,
      });
    } catch (_logErr) {
      // Non-fatal if reconciliation log table is not yet migrated
    }

    // Sync goals and emit idempotent notifications
    try {
      const { GoalAndNotificationService } = await import('./GoalAndNotificationService.js');
      await GoalAndNotificationService.syncGoalsWithStreakData(studentId, streakData, executor);

      if (triggerSource === 'DISPUTE_APPROVAL' && referenceId) {
        await GoalAndNotificationService.createIdempotentNotification(
          {
            studentId,
            rollNo,
            eventKey: `dispute_approved_${referenceId}`,
            category: 'DISPUTE_RESTORED',
            title: 'Attendance Dispute Approved & Streak Updated',
            message: `Your attendance correction was approved. Your current streak is now ${streakData.currentStreak} consecutive classes (Personal Best: ${streakData.longestStreak}).`,
            emojiChar: streakData.selectedEmoji?.char || '🔥',
          },
          executor
        );
      }

      if (streakData.longestStreak > (Number(previousLongest) || 0) && streakData.longestStreak >= 5) {
        await GoalAndNotificationService.createIdempotentNotification(
          {
            studentId,
            rollNo,
            eventKey: `personal_best_${streakData.longestStreak}`,
            category: 'PERSONAL_BEST_UPDATED',
            title: `New Personal Best: ${streakData.longestStreak} Classes!`,
            message: `You set a new personal record of ${streakData.longestStreak} consecutive attended classes.`,
            emojiChar: streakData.selectedEmoji?.char || '🏆',
          },
          executor
        );
      }

      for (const m of streakData.unlockedMilestones || []) {
        if (m.milestone_code) {
          await GoalAndNotificationService.createIdempotentNotification(
            {
              studentId,
              rollNo,
              eventKey: `milestone_${m.milestone_code}`,
              category: 'MILESTONE_UNLOCKED',
              title: `Achievement Unlocked: ${m.title}!`,
              message: `You reached ${m.required_streak} consecutive attended classes and unlocked the ${m.emoji_char} ${m.title} badge.`,
              emojiChar: m.emoji_char,
            },
            executor
          );
        }
      }

      if (streakData.milestoneProgress && streakData.milestoneProgress.remaining > 0 && streakData.milestoneProgress.remaining <= 2) {
        await GoalAndNotificationService.createIdempotentNotification(
          {
            studentId,
            rollNo,
            eventKey: `nearing_${streakData.nextMilestone?.milestone_code}_${streakData.currentStreak}`,
            category: 'NEARING_MILESTONE',
            title: `Almost There: ${streakData.nextMilestone?.title}!`,
            message: `Only ${streakData.milestoneProgress.remaining} more class(es) to unlock ${streakData.nextMilestone?.emoji_char} ${streakData.nextMilestone?.title}.`,
            emojiChar: streakData.nextMilestone?.emoji_char || '🔥',
          },
          executor
        );
      }
    } catch (_notifErr) {
      // Non-fatal notification failure must never break authoritative attendance recalculation
    }

    return { success: true, streakData };
  }

  /**
   * Updates a student's active streak emoji preference.
   * Only allows emojis that the student has verified as unlocked (or default flame).
   *
   * @param {Object} params
   * @param {number} params.studentId
   * @param {string} params.emojiChar
   * @param {string} params.emojiCode
   * @param {number} [params.milestoneId]
   * @param {Object} [params.dbClient]
   * @returns {Promise<{ success: boolean, message: string, selectedEmoji?: { char: string, code: string } }>}
   */
  static async _upsertEmojiPreference(executor, { studentId, emojiChar, emojiCode, milestoneId }) {
    try {
      await executor
        .insert(studentStreakPreferences)
        .values({
          student_id: studentId,
          selected_emoji_char: emojiChar,
          selected_emoji_code: emojiCode,
          selected_milestone_id: milestoneId,
        })
        .onDuplicateKeyUpdate({
          set: {
            selected_emoji_char: emojiChar,
            selected_emoji_code: emojiCode,
            selected_milestone_id: milestoneId,
          }
        });
    } catch (err) {
      const msg = String(err?.cause?.sqlMessage || err?.message || '');
      if (msg.includes('reminders_enabled')) {
        // Fallback when migration 0037 (adding reminders_enabled) has not yet been applied
        await executor.execute(sql`
          INSERT INTO student_streak_preferences
            (student_id, selected_emoji_char, selected_emoji_code, selected_milestone_id)
          VALUES
            (${studentId}, ${emojiChar}, ${emojiCode}, ${milestoneId})
          ON DUPLICATE KEY UPDATE
            selected_emoji_char = ${emojiChar},
            selected_emoji_code = ${emojiCode},
            selected_milestone_id = ${milestoneId}
        `);
      } else {
        throw err;
      }
    }
  }

  static async updateSelectedEmoji({ studentId, emojiChar, emojiCode, milestoneId = null, dbClient = null }) {
    const executor = dbClient || db;
    if (!studentId || !emojiChar) {
      throw new Error('Student ID and emoji character are required.');
    }

    // Always permit restoring the default flame emoji when no milestoneId is specified
    if (!milestoneId && emojiChar === DEFAULT_STREAK_EMOJI.char && emojiCode === DEFAULT_STREAK_EMOJI.code) {
      await this._upsertEmojiPreference(executor, {
        studentId,
        emojiChar: DEFAULT_STREAK_EMOJI.char,
        emojiCode: DEFAULT_STREAK_EMOJI.code,
        milestoneId: null,
      });

      return {
        success: true,
        message: 'Default streak emoji restored.',
        selectedEmoji: { char: DEFAULT_STREAK_EMOJI.char, code: DEFAULT_STREAK_EMOJI.code },
      };
    }

    // Any custom milestone emoji MUST specify a valid milestoneId and be verified against student_streak_unlocks
    const parsedMilestoneId = Number(milestoneId);
    if (!milestoneId || !Number.isInteger(parsedMilestoneId) || parsedMilestoneId <= 0) {
      throw new Error('Unauthorized: A valid unlocked milestone ID is required to select a custom emoji.');
    }

    const unlocks = await executor
      .select({
        unlockId: studentStreakUnlocks.id,
        milestoneId: attendanceStreakMilestones.id,
        emojiChar: attendanceStreakMilestones.emoji_char,
        emojiCode: attendanceStreakMilestones.emoji_code,
        isActive: attendanceStreakMilestones.is_active,
      })
      .from(studentStreakUnlocks)
      .innerJoin(attendanceStreakMilestones, eq(studentStreakUnlocks.milestone_id, attendanceStreakMilestones.id))
      .where(and(
        eq(studentStreakUnlocks.student_id, studentId),
        eq(studentStreakUnlocks.milestone_id, parsedMilestoneId),
        eq(attendanceStreakMilestones.is_active, true)
      ))
      .limit(1);

    if (unlocks.length === 0) {
      throw new Error('Unauthorized: You have not yet unlocked this milestone emoji.');
    }

    const authoritativeEmojiChar = unlocks[0].emojiChar;
    const authoritativeEmojiCode = unlocks[0].emojiCode;

    await this._upsertEmojiPreference(executor, {
      studentId,
      emojiChar: authoritativeEmojiChar,
      emojiCode: authoritativeEmojiCode,
      milestoneId: parsedMilestoneId,
    });

    return {
      success: true,
      message: 'Active streak emoji updated successfully.',
      selectedEmoji: { char: authoritativeEmojiChar, code: authoritativeEmojiCode },
    };
  }
}
