import { db } from '@/db';
import {
  studentAttendance,
  attendanceSessions,
  students as studentsTable,
  facultySubjectAssignments,
  labBatchAllocations,
  labBatchStudents,
  attendanceStreakMilestones,
  studentStreakUnlocks,
  studentStreakPreferences
} from '@/db/schema';
import { eq, and, asc, gte, inArray, sql } from 'drizzle-orm';
import { calculateYearAndSemesterAsync, getCollegeAcademicYear } from '@/lib/academic-utils';
import { getBranchFromRoll } from '@/lib/rollNumber';
import {
  DEFAULT_STREAK_EMOJI,
  getServerStreakPolicy,
  evaluateAttendanceStatus,
  evaluateMilestoneProgress
} from '@/lib/streak-config';

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
      const rows = await executor
        .select()
        .from(attendanceStreakMilestones)
        .where(eq(attendanceStreakMilestones.is_active, true))
        .orderBy(asc(attendanceStreakMilestones.required_streak));
      return rows || [];
    } catch (_err) {
      // Table may not yet be migrated in development/test
      return [];
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
        .select()
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
   *
   * @param {Object} params
   * @param {number} params.studentId
   * @param {string} params.rollNo
   * @param {number} [params.semester]
   * @param {string} [params.academicYear]
   * @param {string} [params.branch]
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
    policy = getServerStreakPolicy(),
    dbClient = null,
  }) {
    const executor = dbClient || db;

    // 1. Resolve student context
    let semester = inputSemester;
    let academicYear = inputAcademicYear;
    let branch = inputBranch;

    if (!semester || !academicYear || !branch) {
      const session = await calculateYearAndSemesterAsync(rollNo, 0);
      semester = semester || session.semester;
      academicYear = academicYear || session.academicYear || await getCollegeAcademicYear();
      branch = branch || getBranchFromRoll(rollNo);
    }

    if (!studentId || !semester || !academicYear || !branch) {
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
        timeline: [],
      };
    }

    // 2. Fetch admission date
    const [studentData] = await executor
      .select({ admission_date: studentsTable.admission_date })
      .from(studentsTable)
      .where(eq(studentsTable.id, studentId))
      .limit(1);

    const admissionDate = studentData?.admission_date || new Date('1900-01-01');

    // 3. Resolve lab batch allocations for this student in this cohort
    const allocRows = await executor
      .select({
        subject_code: labBatchAllocations.subject_code,
        batch_number: labBatchStudents.batch_number,
      })
      .from(labBatchStudents)
      .innerJoin(labBatchAllocations, eq(labBatchStudents.allocation_id, labBatchAllocations.id))
      .where(and(
        eq(labBatchStudents.student_id, studentId),
        eq(labBatchAllocations.academic_year, academicYear),
        eq(labBatchAllocations.branch, branch),
        eq(labBatchAllocations.semester, semester)
      ));

    const studentBatchBySubject = new Map();
    for (const alloc of allocRows) {
      studentBatchBySubject.set(alloc.subject_code, alloc.batch_number);
    }

    // 4. Resolve all active canonical subject assignments for this cohort
    const assignments = await executor
      .select({
        id: facultySubjectAssignments.id,
        subject_code: facultySubjectAssignments.subject_code,
        subject_name: facultySubjectAssignments.subject_name,
      })
      .from(facultySubjectAssignments)
      .where(and(
        eq(facultySubjectAssignments.branch, branch),
        eq(facultySubjectAssignments.course_semester, Number(semester)),
        eq(facultySubjectAssignments.academic_year, academicYear),
        eq(facultySubjectAssignments.is_active, true)
      ));

    if (assignments.length === 0) {
      const selectedEmoji = await this.getStudentSelectedEmoji(studentId, executor);
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
        selectedEmoji,
        unlockedMilestones: [],
        timeline: [],
      };
    }

    const assignmentMap = new Map();
    const assignmentIds = [];
    for (const a of assignments) {
      assignmentMap.set(a.id, a);
      assignmentIds.push(a.id);
    }

    // 5. Query all finalized sessions conducted for these assignments
    // Authoritative Invariants:
    // - submitted_at IS NOT NULL (only finalized attendance sessions)
    // - attendance_date >= admission_date
    const sessionConditions = [
      inArray(attendanceSessions.assignment_id, assignmentIds),
      gte(attendanceSessions.attendance_date, admissionDate),
      sql`${attendanceSessions.submitted_at} IS NOT NULL`
    ];

    const allSessions = await executor
      .select({
        id: attendanceSessions.id,
        assignment_id: attendanceSessions.assignment_id,
        attendance_date: attendanceSessions.attendance_date,
        session_number: attendanceSessions.session_number,
        batch_number: attendanceSessions.batch_number,
        topic_covered: attendanceSessions.topic_covered,
      })
      .from(attendanceSessions)
      .where(and(...sessionConditions))
      .orderBy(
        asc(attendanceSessions.attendance_date),
        asc(attendanceSessions.session_number),
        asc(attendanceSessions.id)
      );

    // 6. Query student's recorded attendance records for these assignments
    const studentRecords = await executor
      .select({
        session_id: studentAttendance.session_id,
        assignment_id: studentAttendance.assignment_id,
        date: studentAttendance.date,
        session: studentAttendance.session,
        status: studentAttendance.status,
      })
      .from(studentAttendance)
      .where(and(
        eq(studentAttendance.student_id, studentId),
        inArray(studentAttendance.assignment_id, assignmentIds),
        gte(studentAttendance.date, admissionDate)
      ));

    const studentRecordSessionIds = new Set(studentRecords.map(r => r.session_id).filter(Boolean));

    // 7. Filter eligible sessions for this specific student:
    // - Whole-class session (batch_number = 0 or NULL): eligible for all students
    // - Batch-specific session (batch_number = 1 or 2): eligible ONLY IF:
    //     a) Student's allocated batch for that subject matches session.batch_number, OR
    //     b) Student has an actual record in student_attendance for this session
    const eligibleSessions = [];
    for (const session of allSessions) {
      const assignment = assignmentMap.get(session.assignment_id);
      if (!assignment) continue;

      const subCode = assignment.subject_code;
      const allocatedBatch = studentBatchBySubject.get(subCode) || null;
      const batchNum = session.batch_number || 0;

      let isEligible = false;
      if (batchNum === 0) {
        isEligible = true;
      } else if (allocatedBatch !== null && allocatedBatch === batchNum) {
        isEligible = true;
      } else if (studentRecordSessionIds.has(session.id)) {
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

    // 8. Deterministic chronological streak calculation
    const streakResult = calculateStreakFromSequence(eligibleSessions, studentRecords, { policy });

    // 9. Milestone and Custom Emoji Evaluation
    const milestones = await this.getActiveMilestones(executor);
    const { nextMilestone, unlockedMilestones, milestoneProgress } = evaluateMilestoneProgress(
      streakResult.currentStreak,
      milestones
    );

    const selectedEmoji = await this.getStudentSelectedEmoji(studentId, executor);

    // 10. Record new unlocks idempotently if supported
    if (unlockedMilestones.length > 0) {
      try {
        for (const m of unlockedMilestones) {
          await executor
            .insert(studentStreakUnlocks)
            .values({
              student_id: studentId,
              milestone_id: m.id,
              verified_streak: streakResult.currentStreak,
              is_notified: false,
            })
            .onDuplicateKeyUpdate({
              set: { verified_streak: streakResult.currentStreak }
            });
        }
      } catch (_unlockErr) {
        // Handled gracefully if table is not yet migrated
      }
    }

    return {
      ...streakResult,
      nextMilestone,
      milestoneProgress,
      policyApplied: policy,
      selectedEmoji,
      unlockedMilestones,
    };
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
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  static async updateSelectedEmoji({ studentId, emojiChar, emojiCode, milestoneId = null }) {
    if (!studentId || !emojiChar) {
      throw new Error('Student ID and emoji character are required.');
    }

    // Always permit the default flame emoji
    if (emojiChar === DEFAULT_STREAK_EMOJI.char || emojiCode === DEFAULT_STREAK_EMOJI.code) {
      await db
        .insert(studentStreakPreferences)
        .values({
          student_id: studentId,
          selected_emoji_char: DEFAULT_STREAK_EMOJI.char,
          selected_emoji_code: DEFAULT_STREAK_EMOJI.code,
          selected_milestone_id: null,
        })
        .onDuplicateKeyUpdate({
          set: {
            selected_emoji_char: DEFAULT_STREAK_EMOJI.char,
            selected_emoji_code: DEFAULT_STREAK_EMOJI.code,
            selected_milestone_id: null,
          }
        });

      return { success: true, message: 'Default streak emoji restored.' };
    }

    // If a custom milestone emoji is requested, verify student ownership
    if (milestoneId) {
      const unlocks = await db
        .select()
        .from(studentStreakUnlocks)
        .where(and(
          eq(studentStreakUnlocks.student_id, studentId),
          eq(studentStreakUnlocks.milestone_id, Number(milestoneId))
        ))
        .limit(1);

      if (unlocks.length === 0) {
        throw new Error('Unauthorized: You have not yet unlocked this milestone emoji.');
      }
    }

    await db
      .insert(studentStreakPreferences)
      .values({
        student_id: studentId,
        selected_emoji_char: emojiChar,
        selected_emoji_code: emojiCode || 'custom',
        selected_milestone_id: milestoneId ? Number(milestoneId) : null,
      })
      .onDuplicateKeyUpdate({
        set: {
          selected_emoji_char: emojiChar,
          selected_emoji_code: emojiCode || 'custom',
          selected_milestone_id: milestoneId ? Number(milestoneId) : null,
        }
      });

    return { success: true, message: 'Active streak emoji updated successfully.' };
  }
}
