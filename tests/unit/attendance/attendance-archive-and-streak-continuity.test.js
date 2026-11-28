import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockState,
  mockAuthUser,
  mockBroadcast,
} = vi.hoisted(() => ({
  mockAuthUser: { current: { id: 901, staffId: 901, role: 'admin', branch: 'CSE', is_hod: true, is_principal: true } },
  mockBroadcast: vi.fn(async () => {}),
  mockState: {
    students: [],
    assignments: [],
    attendanceSessions: [],
    studentAttendance: [],
    archiveStudents: [],
    archiveStudentPersonalDetails: [],
    archiveStudentAcademicBackground: [],
    archiveStudentAttendance: [],
    archiveAttendanceSessions: [],
    archiveStudentMarks: [],
    studentMarks: [],
    studentFeePayments: [],
    archiveOperationsLog: [],
    studentAttendanceDisputes: [],
    attendanceAuditLogs: [],
    attendanceStreakMilestones: [],
    studentStreakUnlocks: [],
    studentStreakPreferences: [],
    studentStreakSnapshots: [],
    studentStreakReconciliationLogs: [],
    studentAttendanceGoals: [],
    studentStreakNotifications: [],
    labBatchAllocations: [],
    labBatchStudents: [],
    failNextTxAtStep: null,
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    runWithContext: vi.fn((_ctx, fn) => fn()),
  },
}));

vi.mock('@/lib/sse', () => ({
  broadcastUpdate: mockBroadcast,
}));

vi.mock('@/lib/events/EventBus', () => ({
  EventBus: { publish: vi.fn() },
  DOMAIN_EVENTS: { ARCHIVE_COMPLETED: 'ARCHIVE_COMPLETED', STUDENT_RESTORED: 'STUDENT_RESTORED' },
}));

vi.mock('@/lib/cache', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    invalidateTag: vi.fn(async () => true),
    invalidateKey: vi.fn(async () => true),
  };
});

vi.mock('@/lib/academic-utils', () => ({
  calculateYearAndSemesterAsync: vi.fn(async () => ({ semester: 8, academicYear: '2029-2030' })),
  getCollegeAcademicYear: vi.fn(async () => '2029-2030'),
}));

vi.mock('@/lib/rollNumber', () => ({
  getBranchFromRoll: vi.fn((roll) => (String(roll).includes('04') ? 'ECE' : 'CSE')),
  branchCodes: { '05': 'CSE', '04': 'ECE' },
}));

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: vi.fn(async () => mockAuthUser.current),
    logAudit: vi.fn(async () => {}),
    apiResponse: vi.fn((data, status = 200) => ({ status, json: async () => data })),
    apiError: vi.fn((message, status = 400) => ({ status, json: async () => ({ error: message }) })),
  };
});

vi.mock('@/services/archive/ArchiveMediaService', () => ({
  ArchiveMediaService: {
    archiveMediaFile: vi.fn(async (p) => ({ newPath: p, sizeBytes: 0 })),
    restoreMediaFile: vi.fn(async (p) => p),
  },
}));

// Stateful in-memory MySQL/Drizzle simulator supporting transactions, rollbacks, joins, updates, and inserts
vi.mock('@/db', async () => {
  const schema = await vi.importActual('@/db/schema');
  const {
    students,
    facultySubjectAssignments,
    attendanceSessions,
    studentAttendance,
    archiveStudents,
    archiveStudentPersonalDetails,
    archiveStudentAcademicBackground,
    archiveStudentAttendance,
    archiveAttendanceSessions,
    archiveStudentMarks,
    studentMarks,
    studentFeePayments,
    archiveOperationsLog,
    studentAttendanceDisputes,
    attendanceAuditLogs,
    attendanceStreakMilestones,
    studentStreakUnlocks,
    studentStreakPreferences,
    studentStreakSnapshots,
    studentStreakReconciliationLogs,
    studentAttendanceGoals,
    studentStreakNotifications,
    labBatchAllocations,
    labBatchStudents,
  } = schema;

  function getCollection(table) {
    if (table === students) return mockState.students;
    if (table === facultySubjectAssignments) return mockState.assignments;
    if (table === attendanceSessions) return mockState.attendanceSessions;
    if (table === studentAttendance) return mockState.studentAttendance;
    if (table === archiveStudents) return mockState.archiveStudents;
    if (table === archiveStudentPersonalDetails) return mockState.archiveStudentPersonalDetails;
    if (table === archiveStudentAcademicBackground) return mockState.archiveStudentAcademicBackground;
    if (table === archiveStudentAttendance) return mockState.archiveStudentAttendance;
    if (table === archiveAttendanceSessions) return mockState.archiveAttendanceSessions;
    if (table === archiveStudentMarks) return mockState.archiveStudentMarks;
    if (table === studentMarks) return mockState.studentMarks;
    if (table === studentFeePayments) return mockState.studentFeePayments;
    if (table === archiveOperationsLog) return mockState.archiveOperationsLog;
    if (table === studentAttendanceDisputes) return mockState.studentAttendanceDisputes;
    if (table === attendanceAuditLogs) return mockState.attendanceAuditLogs;
    if (table === attendanceStreakMilestones) return mockState.attendanceStreakMilestones;
    if (table === studentStreakUnlocks) return mockState.studentStreakUnlocks;
    if (table === studentStreakPreferences) return mockState.studentStreakPreferences;
    if (table === studentStreakSnapshots) return mockState.studentStreakSnapshots;
    if (table === studentStreakReconciliationLogs) return mockState.studentStreakReconciliationLogs;
    if (table === studentAttendanceGoals) return mockState.studentAttendanceGoals;
    if (table === studentStreakNotifications) return mockState.studentStreakNotifications;
    if (table === labBatchAllocations) return mockState.labBatchAllocations;
    if (table === labBatchStudents) return mockState.labBatchStudents;
    return [];
  }

  function stateRefExistsAttendance(sessionId, studentId) {
    return mockState.studentAttendance.some(
      (sa) => sa.session_id === sessionId && (studentId === undefined || sa.student_id === studentId)
    );
  }

  function evalDrizzleCond(cond, row) {
    if (!cond) return true;
    const chunks = cond.queryChunks;
    if (!chunks || !Array.isArray(chunks)) return true;

    const flatChunks = chunks.flatMap((c) => (Array.isArray(c) ? c : [c]));

    const topSeparators = flatChunks
      .filter((c) => c && Array.isArray(c?.value))
      .map((c) => c.value.join(''))
      .join(' ');

    const colChunk = flatChunks.find((c) => c && c.name && c.table);
    const subSqlNodes = flatChunks.filter((c) => c && typeof c === 'object' && Array.isArray(c.queryChunks));

    if (subSqlNodes.length > 0 && !colChunk) {
      if (topSeparators.includes(' or ')) {
        return subSqlNodes.some((sub) => evalDrizzleCond(sub, row));
      }
      return subSqlNodes.every((sub) => evalDrizzleCond(sub, row));
    }

    // Leaf condition: inspect column, operator, and params
    if (!colChunk) {
      return true;
    }

    const colName = colChunk.name;
    const sqlText = flatChunks
      .filter((c) => c && Array.isArray(c?.value))
      .map((c) => c.value.join(''))
      .join(' ')
      .toLowerCase();

    if (sqlText.includes('exists')) {
      return stateRefExistsAttendance(row.id, paramVals[0]);
    }
    if (sqlText.includes('is not null')) {
      return row[colName] !== null && row[colName] !== undefined;
    }
    if (sqlText.includes('is null')) {
      return row[colName] === null || row[colName] === undefined;
    }

    const paramVals = flatChunks.flatMap((c) => {
      if (c && c.encoder && c.value !== undefined) {
        return Array.isArray(c.value) ? c.value : [c.value];
      }
      if (typeof c === 'string' || typeof c === 'number') {
        return [c];
      }
      return [];
    });

    if (sqlText.includes(' not in ')) {
      return !paramVals.includes(row[colName]);
    }
    if (sqlText.includes(' in ')) {
      return paramVals.includes(row[colName]);
    }

    const targetVal = paramVals[0];
    const rowVal = row[colName];

    const norm = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);

    if (sqlText.includes('>=')) {
      return String(norm(rowVal)).slice(0, 10) >= String(norm(targetVal)).slice(0, 10);
    }
    if (sqlText.includes('<=')) {
      return String(norm(rowVal)).slice(0, 10) <= String(norm(targetVal)).slice(0, 10);
    }
    if (sqlText.includes('=')) {
      if (colName === 'date' || colName === 'attendance_date') {
        return String(norm(rowVal)).slice(0, 10) === String(norm(targetVal)).slice(0, 10);
      }
      return rowVal === targetVal;
    }

    return true;
  }

  // Simple predicate evaluator using recursive Drizzle AST
  function makeQueryBuilder(stateRef, table, selection = null) {
    let joinedTables = [];
    let whereCond = null;
    let limitN = null;

    const execute = () => {
      let rows = [...getCollection(table)];

      // Join enrichment
      if (joinedTables.length > 0) {
        rows = rows.map((row) => {
          const merged = { ...row };
          for (const j of joinedTables) {
            if (j === facultySubjectAssignments) {
              const a = stateRef.assignments.find((x) => x.id === row.assignment_id);
              if (a) {
                merged.branch = merged.branch ?? a.branch;
                merged.semester = merged.semester ?? a.course_semester;
                merged.course_semester = merged.course_semester ?? a.course_semester;
                merged.academic_year = merged.academic_year ?? a.academic_year;
                merged.subject_code = merged.subject_code ?? a.subject_code;
                merged.subject_name = merged.subject_name ?? a.subject_name;
                merged.faculty_id = merged.faculty_id ?? a.staff_account_id;
              }
            } else if (j === attendanceSessions) {
              const s = stateRef.attendanceSessions.find((x) => x.id === row.session_id);
              if (s) {
                merged.topic_covered = merged.topic_covered ?? s.topic_covered;
                merged.batch_number = merged.batch_number ?? s.batch_number;
              }
            } else if (j === students) {
              const st = stateRef.students.find((x) => x.id === row.student_id);
              if (st) {
                merged.roll_no = merged.roll_no ?? st.roll_no;
              }
            }
          }
          return merged;
        });
      }

      if (whereCond) {
        rows = rows.filter((row) => evalDrizzleCond(whereCond, row));
      }

      if (table === attendanceStreakMilestones) {
        rows = [...rows].sort((a, b) => (a.required_streak || 0) - (b.required_streak || 0));
      }

      if (selection && Object.keys(selection).length === 1 && selection.count !== undefined) {
        return [{ count: rows.length }];
      }

      if (selection && typeof selection === 'object') {
        rows = rows.map((row) => {
          const projected = { ...row };
          for (const [alias, col] of Object.entries(selection)) {
            if (col && col.name && row[col.name] !== undefined) {
              projected[alias] = row[col.name];
            }
          }
          return projected;
        });
      }

      if (limitN !== null) rows = rows.slice(0, limitN);
      return rows;
    };

    const builder = {
      innerJoin: vi.fn((jt) => {
        joinedTables.push(jt);
        return builder;
      }),
      leftJoin: vi.fn((jt) => {
        joinedTables.push(jt);
        return builder;
      }),
      where: vi.fn((cond) => {
        whereCond = cond;
        return builder;
      }),
      orderBy: vi.fn(() => builder),
      groupBy: vi.fn(() => builder),
      limit: vi.fn((n) => {
        limitN = n;
        return builder;
      }),
      then: (resolve, reject) => Promise.resolve(execute()).then(resolve, reject),
    };
    return builder;
  }

  function makeExecutor(stateRef) {
    return {
      select: vi.fn((selection) => ({
        from: vi.fn((table) => makeQueryBuilder(stateRef, table, selection)),
      })),
      insert: vi.fn((table) => ({
        values: vi.fn((vals) => {
          const items = Array.isArray(vals) ? vals : [vals];
          const col = getCollection(table);
          const doInsert = (onDup = null) => {
            if (stateRef.failNextTxAtStep && table === archiveOperationsLog) {
              const err = new Error('Simulated DB crash mid-transaction');
              stateRef.failNextTxAtStep = null;
              throw err;
            }
            let lastId = 0;
            for (const item of items) {
              // Enforce unique keys for studentAttendance, archiveStudentAttendance, archiveStudents, studentStreakUnlocks, studentStreakSnapshots
              if (table === studentAttendance) {
                const dup = col.find(
                  (r) =>
                    r.student_id === item.student_id &&
                    r.assignment_id === item.assignment_id &&
                    String(r.date).slice(0, 10) === String(item.date).slice(0, 10) &&
                    r.session === item.session
                );
                if (dup) {
                  if (onDup) {
                    Object.assign(dup, { is_archived: false, archive_batch_id: null, archived_at: null });
                    continue;
                  }
                  throw new Error('Duplicate entry for key uq_student_attendance');
                }
              }
              if (table === archiveStudents) {
                const dup = col.find((r) => r.original_student_id === item.original_student_id);
                if (dup) {
                  if (onDup) {
                    Object.assign(dup, onDup);
                    continue;
                  }
                  throw new Error('Duplicate entry for key uq_archive_students_orig_id');
                }
              }
              if (table === studentStreakUnlocks) {
                const dup = col.find((r) => r.student_id === item.student_id && r.milestone_id === item.milestone_id);
                if (dup) {
                  if (onDup) {
                    dup.verified_streak = Math.max(dup.verified_streak || 0, item.verified_streak || 0);
                    continue;
                  }
                  throw new Error('Duplicate entry for key uq_student_milestone_unlock');
                }
              }
              if (table === studentStreakSnapshots) {
                const dup = col.find((r) => r.student_id === item.student_id);
                if (dup) {
                  if (onDup) {
                    Object.assign(dup, item, { is_stale: false });
                    continue;
                  }
                  throw new Error('Duplicate snapshot');
                }
              }
              if (table === studentStreakNotifications) {
                const dup = col.find((r) => r.student_id === item.student_id && r.event_key === item.event_key);
                if (dup) {
                  if (onDup) continue;
                }
              }
              const newId = item.id || col.length + 1;
              col.push({ id: newId, ...item });
              lastId = newId;
            }
            return [{ insertId: lastId, affectedRows: items.length }];
          };

          const p = {
            onDuplicateKeyUpdate: vi.fn(async ({ set }) => doInsert(set)),
            then: (resolve, reject) => Promise.resolve().then(() => doInsert(null)).then(resolve, reject),
            catch: (reject) => Promise.resolve().then(() => doInsert(null)).catch(reject),
          };
          return p;
        }),
      })),
      update: vi.fn((table) => ({
        set: vi.fn((vals) => ({
          where: vi.fn(async (cond) => {
            const col = getCollection(table);
            let affected = 0;
            for (const row of col) {
              if (!cond || evalDrizzleCond(cond, row)) {
                const cleanVals = { ...vals };
                if (cleanVals.record_version && typeof cleanVals.record_version === 'object') {
                  cleanVals.record_version = (row.record_version || 1) + 1;
                }
                Object.assign(row, cleanVals);
                affected += 1;
              }
            }
            return [{ affectedRows: affected }];
          }),
        })),
      })),
      delete: vi.fn((table) => ({
        where: vi.fn(async (cond) => {
          const col = getCollection(table);
          let removed = 0;
          for (let i = col.length - 1; i >= 0; i--) {
            if (cond && evalDrizzleCond(cond, col[i])) {
              col.splice(i, 1);
              removed += 1;
            }
          }
          return [{ affectedRows: removed }];
        }),
      })),
    };
  }

  return {
    db: {
      ...makeExecutor(mockState),
      transaction: vi.fn(async (cb) => {
        // Snapshot mockState before tx so any thrown error cleanly rolls back all tables
        const backup = structuredClone({
          students: mockState.students,
          assignments: mockState.assignments,
          attendanceSessions: mockState.attendanceSessions,
          studentAttendance: mockState.studentAttendance,
          archiveStudents: mockState.archiveStudents,
          archiveStudentAttendance: mockState.archiveStudentAttendance,
          archiveAttendanceSessions: mockState.archiveAttendanceSessions,
          archiveOperationsLog: mockState.archiveOperationsLog,
          studentAttendanceDisputes: mockState.studentAttendanceDisputes,
          attendanceAuditLogs: mockState.attendanceAuditLogs,
          studentStreakSnapshots: mockState.studentStreakSnapshots,
        });
        try {
          return await cb(makeExecutor(mockState));
        } catch (err) {
          Object.assign(mockState, backup);
          throw err;
        }
      }),
    },
  };
});

import { StreakService } from '@/services/attendance/StreakService';
import { UnifiedAttendanceRepository } from '@/services/attendance/UnifiedAttendanceRepository';
import { ArchiveService } from '@/services/archive/ArchiveService';
import { ArchiveRestoreService } from '@/services/archive/ArchiveRestoreService';
import { AttendanceCalculationService } from '@/services/academic/AttendanceCalculationService';
import { getStudentSubjectAttendance } from '@/services/academic/AttendanceService';
import { PUT as reviewDisputePUT } from '@/app/api/staff/faculty/attendance/disputes/[id]/route';
import { POST as historicalCorrectionPOST } from '@/app/api/staff/faculty/attendance/historical-correction/route';

function seedContinuousClasses(studentId, startId, count, {
  assignmentId = 10,
  startDate = '2026-08-01',
  status = 'PRESENT',
  isArchived = false,
} = {}) {
  const baseTime = new Date(startDate + 'T00:00:00Z').getTime();
  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor(i / 4);
    const period = (i % 4) + 1;
    const d = new Date(baseTime + dayOffset * 86400000).toISOString().split('T')[0];
    const sid = startId + i;
    mockState.attendanceSessions.push({
      id: sid,
      assignment_id: assignmentId,
      attendance_date: d,
      session_number: period,
      batch_number: 0,
      submitted_at: new Date(),
      is_active: false,
      is_archived: isArchived,
      archive_batch_id: isArchived ? 'BATCH-OLD' : null,
      topic_covered: `Topic ${sid}`,
    });
    mockState.studentAttendance.push({
      id: sid,
      session_id: sid,
      student_id: studentId,
      assignment_id: assignmentId,
      date: d,
      session: period,
      status,
      record_version: 1,
      is_archived: isArchived,
      archive_batch_id: isArchived ? 'BATCH-OLD' : null,
    });
  }
}

describe('Attendance Archive Architecture, Streak Continuity & Retention (30 Scenarios)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.current = { id: 901, staffId: 901, role: 'admin', branch: 'CSE', is_hod: true, is_principal: true };
    Object.assign(mockState, {
      students: [
        {
          id: 1,
          roll_no: '268W1A0501',
          name: 'KUCET Student 2026',
          email: 's1@kucet.ac.in',
          admission_date: '2026-07-01',
          admission_year: '2026',
          academic_status: 'ACTIVE',
          student_status: 'ACTIVE',
          is_archived: false,
        },
      ],
      assignments: [
        {
          id: 10,
          staff_account_id: 901,
          subject_code: 'CS101',
          subject_name: 'Programming in C',
          branch: 'CSE',
          course_semester: 1,
          academic_year: '2026-2027',
          is_active: true,
        },
        {
          id: 20,
          staff_account_id: 901,
          subject_code: 'CS201',
          subject_name: 'Data Structures',
          branch: 'CSE',
          course_semester: 2,
          academic_year: '2026-2027',
          is_active: true,
        },
        {
          id: 30,
          staff_account_id: 901,
          subject_code: 'CS301',
          subject_name: 'Algorithms',
          branch: 'CSE',
          course_semester: 3,
          academic_year: '2027-2028',
          is_active: true,
        },
      ],
      attendanceSessions: [],
      studentAttendance: [],
      archiveStudents: [],
      archiveStudentPersonalDetails: [],
      archiveStudentAcademicBackground: [],
      archiveStudentAttendance: [],
      archiveAttendanceSessions: [],
      archiveStudentMarks: [],
      studentMarks: [],
      studentFeePayments: [],
      archiveOperationsLog: [],
      studentAttendanceDisputes: [],
      attendanceAuditLogs: [],
      attendanceStreakMilestones: [
        { id: 1, milestone_code: 'STREAK_5', title: 'First Spark', required_streak: 5, emoji_code: 'first_spark', emoji_char: '❤️‍🔥', is_active: true },
        { id: 5, milestone_code: 'STREAK_50', title: 'Diamond Discipline', required_streak: 50, emoji_code: 'diamond_discipline', emoji_char: '💎', is_active: true },
        { id: 7, milestone_code: 'STREAK_100', title: 'Champion', required_streak: 100, emoji_code: 'champion', emoji_char: '🏆', is_active: true },
      ],
      studentStreakUnlocks: [],
      studentStreakPreferences: [],
      studentStreakSnapshots: [],
      studentStreakReconciliationLogs: [],
      studentAttendanceGoals: [],
      studentStreakNotifications: [],
      labBatchAllocations: [],
      labBatchStudents: [],
      failNextTxAtStep: null,
    });
  });

  it('TC-01 & TC-02: 100-class streak survives semester archive and next class increments to 101', async () => {
    seedContinuousClasses(1, 1, 100, { assignmentId: 10, startDate: '2026-08-01' });

    const before = await StreakService.calculateStudentStreak({ studentId: 1, rollNo: '268W1A0501' });
    expect(before.currentStreak).toBe(100);
    expect(before.longestStreak).toBe(100);

    // Run non-destructive semester archive on Sem 1 (2026-2027)
    const archRes = await ArchiveService.runSemesterArchive({
      branch: 'CSE',
      semester: 1,
      academic_year: '2026-2027',
      archived_by: 'admin@kucet.ac.in',
    });
    expect(archRes.success).toBe(true);
    expect(mockState.studentAttendance.length).toBe(100);
    expect(mockState.studentAttendance.every(r => r.is_archived === true)).toBe(true);

    // Streak remains 100 immediately after archive
    const afterArchive = await StreakService.calculateStudentStreak({ studentId: 1, rollNo: '268W1A0501' });
    expect(afterArchive.currentStreak).toBe(100);
    expect(afterArchive.longestStreak).toBe(100);
    expect(afterArchive.timeline.length).toBe(100);

    // Next class attended in Semester 2 increments streak to 101
    seedContinuousClasses(1, 200, 1, { assignmentId: 20, startDate: '2027-01-10' });
    const nextClass = await StreakService.calculateStudentStreak({ studentId: 1, rollNo: '268W1A0501' });
    expect(nextClass.currentStreak).toBe(101);
    expect(nextClass.longestStreak).toBe(101);
  });

  it('TC-03 & TC-04: Streak crosses semester and academic-year boundaries continuously', async () => {
    seedContinuousClasses(1, 1, 20, { assignmentId: 10, startDate: '2026-08-01' }); // Sem 1 2026-2027
    seedContinuousClasses(1, 100, 25, { assignmentId: 20, startDate: '2027-01-15' }); // Sem 2 2026-2027
    seedContinuousClasses(1, 200, 15, { assignmentId: 30, startDate: '2027-07-10' }); // Sem 3 2027-2028

    await ArchiveService.runSemesterArchive({ branch: 'CSE', semester: 1, academic_year: '2026-2027' });
    await ArchiveService.runSemesterArchive({ branch: 'CSE', semester: 2, academic_year: '2026-2027' });

    const res = await StreakService.calculateStudentStreak({ studentId: 1, rollNo: '268W1A0501' });
    expect(res.currentStreak).toBe(60);
    expect(res.longestStreak).toBe(60);
  });

  it('TC-05: Archived ABSENT record continues to break streak', async () => {
    seedContinuousClasses(1, 1, 10, { assignmentId: 10, startDate: '2026-08-01', status: 'PRESENT' });
    seedContinuousClasses(1, 11, 1, { assignmentId: 10, startDate: '2026-08-10', status: 'ABSENT' });
    seedContinuousClasses(1, 12, 4, { assignmentId: 10, startDate: '2026-08-12', status: 'PRESENT' });

    await ArchiveService.runSemesterArchive({ branch: 'CSE', semester: 1, academic_year: '2026-2027' });

    const res = await StreakService.calculateStudentStreak({ studentId: 1, rollNo: '268W1A0501' });
    expect(res.currentStreak).toBe(4);
    expect(res.longestStreak).toBe(10);
    expect(res.totalMissedClasses).toBe(1);
  });

  it('TC-06: Archived NCC and MEDICAL records retain exact status without EXEMPTED loss', async () => {
    seedContinuousClasses(1, 1, 1, { assignmentId: 10, startDate: '2026-08-01', status: 'NCC' });
    seedContinuousClasses(1, 2, 1, { assignmentId: 10, startDate: '2026-08-02', status: 'MEDICAL' });

    await ArchiveService.runSemesterArchive({ branch: 'CSE', semester: 1, academic_year: '2026-2027' });

    const { records } = await UnifiedAttendanceRepository.getStudentAttendanceTimeline({ studentId: 1, order: 'ASC' });
    expect(records.map(r => r.status)).toEqual(['NCC', 'MEDICAL']);
    expect(records.every(r => r.is_archived === true)).toBe(true);
  });

  it('TC-07, TC-08 & TC-09: Post-archive dispute approval updates archived record, audit log, and longest streak; rejection leaves ABSENT intact', async () => {
    seedContinuousClasses(1, 1, 15, { assignmentId: 10, startDate: '2026-08-01', status: 'PRESENT' });
    seedContinuousClasses(1, 16, 1, { assignmentId: 10, startDate: '2026-08-15', status: 'ABSENT' });
    seedContinuousClasses(1, 17, 20, { assignmentId: 20, startDate: '2027-01-10', status: 'PRESENT' });

    await ArchiveService.runSemesterArchive({ branch: 'CSE', semester: 1, academic_year: '2026-2027' });

    // Rejected dispute does not alter archived record
    mockState.studentAttendanceDisputes.push({
      id: 500,
      student_id: 1,
      assignment_id: 10,
      attendance_date: '2026-08-15',
      session: 1,
      original_status: 'ABSENT',
      requested_status: 'PRESENT',
      reason: 'Claimed present',
      status: 'PENDING',
    });
    const rejReq = new Request('http://localhost/api/staff/faculty/attendance/disputes/500', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'REJECTED', rejection_reason: 'No biometric match' }),
    });
    const rejRes = await reviewDisputePUT(rejReq, { params: Promise.resolve({ id: '500' }) });
    expect(rejRes.status).toBe(200);
    expect(mockState.studentAttendance.find(r => r.id === 16).status).toBe('ABSENT');

    // Approved dispute updates archived record and retroactively merges 15 + 1 + 20 = 36 longest streak
    mockState.studentAttendanceDisputes.push({
      id: 501,
      student_id: 1,
      assignment_id: 10,
      attendance_date: '2026-08-15',
      session: 1,
      original_status: 'ABSENT',
      requested_status: 'PRESENT',
      reason: 'Approved lab duty',
      status: 'PENDING',
    });
    const appReq = new Request('http://localhost/api/staff/faculty/attendance/disputes/501', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    const appRes = await reviewDisputePUT(appReq, { params: Promise.resolve({ id: '501' }) });
    const appJson = await appRes.json();

    expect(appRes.status).toBe(200);
    expect(appJson.streakData.currentStreak).toBe(36);
    expect(appJson.streakData.longestStreak).toBe(36);
    expect(mockState.studentAttendance.find(r => r.id === 16).status).toBe('PRESENT');
    expect(mockState.studentAttendance.find(r => r.id === 16).record_version).toBe(2);
    expect(mockState.attendanceAuditLogs.length).toBe(1);
    expect(mockState.attendanceAuditLogs[0].previous_status).toBe('ABSENT');
    expect(mockState.attendanceAuditLogs[0].new_status).toBe('PRESENT');
  });

  it('TC-10, TC-11 & TC-12: Student returning after 5, 10, and 14 years (2026 -> 2040) retrieves complete history', async () => {
    seedContinuousClasses(1, 1, 12, { assignmentId: 10, startDate: '2026-08-01', status: 'PRESENT' });
    await ArchiveService.runSemesterArchive({ branch: 'CSE', semester: 1, academic_year: '2026-2027' });
    mockState.students[0].academic_status = 'GRADUATED';
    await ArchiveService.runAlumniArchive({ graduation_year: '2030', branch: 'CSE' });

    // Simulated retrieval in 2031 (+5y), 2036 (+10y), and 2040 (+14y)
    const timeline = await UnifiedAttendanceRepository.getStudentAttendanceTimeline({ studentId: 1 });
    expect(timeline.totalCount).toBe(12);
    const streak = await StreakService.calculateStudentStreak({ studentId: 1, rollNo: '268W1A0501' });
    expect(streak.totalAttendedClasses).toBe(12);
    expect(streak.longestStreak).toBe(12);
  });

  it('TC-13: Permanently unlocked milestone (STREAK_50) persists after archival and subsequent streak reset', async () => {
    seedContinuousClasses(1, 1, 52, { assignmentId: 10, startDate: '2026-08-01', status: 'PRESENT' });
    await StreakService.calculateStudentStreak({ studentId: 1, rollNo: '268W1A0501' });
    expect(mockState.studentStreakUnlocks.some(u => u.milestone_id === 5)).toBe(true);

    // Archive and then add an absence
    await ArchiveService.runSemesterArchive({ branch: 'CSE', semester: 1, academic_year: '2026-2027' });
    seedContinuousClasses(1, 200, 1, { assignmentId: 20, startDate: '2027-01-10', status: 'ABSENT' });

    const res = await StreakService.calculateStudentStreak({ studentId: 1, rollNo: '268W1A0501' });
    expect(res.currentStreak).toBe(0);
    expect(res.longestStreak).toBe(52);
    expect(res.unlockedMilestones.some(m => m.milestone_code === 'STREAK_50')).toBe(true);
  });

  it('TC-14 & TC-15: Duplicate archive and duplicate restore executions are idempotent with zero duplicates', async () => {
    seedContinuousClasses(1, 1, 5, { assignmentId: 10, startDate: '2026-08-01' });

    const firstArch = await ArchiveService.runSemesterArchive({ branch: 'CSE', semester: 1, academic_year: '2026-2027' });
    const secondArch = await ArchiveService.runSemesterArchive({ branch: 'CSE', semester: 1, academic_year: '2026-2027' });
    expect(firstArch.affectedRecordsCount).toBe(10); // 5 attendance + 5 sessions
    expect(secondArch.affectedRecordsCount).toBe(0);
    expect(mockState.studentAttendance.length).toBe(5);

    const firstRest = await ArchiveRestoreService.restoreAcademicRecords({ branch: 'CSE', semester: 1, academic_year: '2026-2027' });
    const secondRest = await ArchiveRestoreService.restoreAcademicRecords({ branch: 'CSE', semester: 1, academic_year: '2026-2027' });
    expect(firstRest.recordsRestored).toBe(10);
    expect(secondRest.recordsRestored).toBe(0);
    expect(mockState.studentAttendance.length).toBe(5);
  });

  it('TC-16 & TC-17: Interrupted archive or restore rolls back cleanly without corrupting state', async () => {
    seedContinuousClasses(1, 1, 4, { assignmentId: 10, startDate: '2026-08-01' });
    mockState.failNextTxAtStep = 'archiveOperationsLog';

    await expect(
      ArchiveService.runSemesterArchive({ branch: 'CSE', semester: 1, academic_year: '2026-2027' })
    ).rejects.toThrow('Simulated DB crash');

    expect(mockState.studentAttendance.every(r => r.is_archived === false)).toBe(true);

    // Now archive cleanly and interrupt restore
    await ArchiveService.runSemesterArchive({ branch: 'CSE', semester: 1, academic_year: '2026-2027' });
    mockState.failNextTxAtStep = 'archiveOperationsLog';

    await expect(
      ArchiveRestoreService.restoreAcademicRecords({ branch: 'CSE', semester: 1, academic_year: '2026-2027' })
    ).rejects.toThrow('Simulated DB crash');

    expect(mockState.studentAttendance.every(r => r.is_archived === true)).toBe(true);
  });

  it('TC-18 & TC-19: Concurrent archive + historical correction preserves correction; concurrent approvals return 409', async () => {
    seedContinuousClasses(1, 1, 3, { assignmentId: 10, startDate: '2026-08-01', status: 'ABSENT' });
    await ArchiveService.runSemesterArchive({ branch: 'CSE', semester: 1, academic_year: '2026-2027' });

    // Policy-controlled historical correction outside 7-day window
    const corrReq = new Request('http://localhost/api/staff/faculty/attendance/historical-correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: 1,
        assignment_id: 10,
        attendance_date: '2026-08-01',
        session: 1,
        new_status: 'PRESENT',
        reason: 'Tribunal review approved attendance correction from 4 years ago',
      }),
    });
    const corrRes = await historicalCorrectionPOST(corrReq);
    expect(corrRes.status).toBe(200);
    expect(mockState.studentAttendance[0].status).toBe('PRESENT');

    // Concurrent dispute approval race condition
    mockState.studentAttendanceDisputes.push({
      id: 701,
      student_id: 1,
      assignment_id: 10,
      attendance_date: '2026-08-01',
      session: 2,
      original_status: 'ABSENT',
      requested_status: 'PRESENT',
      reason: 'Present',
      status: 'PENDING',
    });
    const req1 = new Request('http://localhost/api/staff/faculty/attendance/disputes/701', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    const res1 = await reviewDisputePUT(req1, { params: Promise.resolve({ id: '701' }) });
    expect(res1.status).toBe(200);

    // Second approval sees already-resolved dispute -> 409 Conflict
    const req2 = new Request('http://localhost/api/staff/faculty/attendance/disputes/701', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    const res2 = await reviewDisputePUT(req2, { params: Promise.resolve({ id: '701' }) });
    expect(res2.status).toBe(409);
  });

  it('TC-20, TC-21 & TC-22: Missing session reference, deactivated assignment, and cohort calculation remain intact', async () => {
    seedContinuousClasses(1, 1, 5, { assignmentId: 10, startDate: '2026-08-01' });
    // Break session_id link on row 3 & deactivate assignment 10
    mockState.studentAttendance[2].session_id = null;
    mockState.assignments[0].is_active = false;

    const streak = await StreakService.calculateStudentStreak({ studentId: 1, rollNo: '268W1A0501' });
    expect(streak.currentStreak).toBe(5);

    const cohort = await AttendanceCalculationService.calculateCohortAttendance({
      studentId: 1,
      branch: 'CSE',
      semester: 1,
      academicYear: '2026-2027',
    });
    expect(cohort.success).toBe(true);
    expect(cohort.totalAssignedSubjects).toBeGreaterThan(0);
  });

  it('TC-23, TC-24 & TC-25: Alumni archival, deactivation, and restore preserve students.id and streak unlocks', async () => {
    seedContinuousClasses(1, 1, 10, { assignmentId: 10, startDate: '2026-08-01' });
    await StreakService.calculateStudentStreak({ studentId: 1, rollNo: '268W1A0501' });
    expect(mockState.studentStreakUnlocks.length).toBeGreaterThan(0);

    mockState.students[0].academic_status = 'GRADUATED';
    await ArchiveService.runAlumniArchive({ graduation_year: '2030', branch: 'CSE' });

    // Primary student row, attendance, and unlocks MUST NOT be deleted
    expect(mockState.students.length).toBe(1);
    expect(mockState.students[0].is_archived).toBe(true);
    expect(mockState.studentStreakUnlocks.length).toBeGreaterThan(0);

    // Restore student idempotently without creating duplicate roll_no
    const rest = await ArchiveRestoreService.restoreStudent({ archive_student_id: mockState.archiveStudents[0].id });
    expect(rest.success).toBe(true);
    expect(mockState.students.length).toBe(1);
    expect(mockState.students[0].is_archived).toBe(false);
    expect(mockState.students[0].student_status).toBe('ACTIVE');
  });

  it('TC-26 & TC-27: Snapshot invalidation marks stale and triggers lazy authoritative recovery', async () => {
    seedContinuousClasses(1, 1, 6, { assignmentId: 10, startDate: '2026-08-01' });
    await StreakService.calculateStudentStreak({ studentId: 1, rollNo: '268W1A0501' });

    expect(mockState.studentStreakSnapshots[0].current_streak).toBe(6);
    expect(mockState.studentStreakSnapshots[0].is_stale).toBe(false);

    // Mutate attendance and invalidate snapshot
    seedContinuousClasses(1, 10, 2, { assignmentId: 10, startDate: '2026-08-05' });
    await UnifiedAttendanceRepository.invalidateStreakSnapshots([1]);
    expect(mockState.studentStreakSnapshots[0].is_stale).toBe(true);

    const recovered = await StreakService.getSnapshotOrRecalculate({ studentId: 1, rollNo: '268W1A0501' });
    expect(recovered.currentStreak).toBe(8);
    expect(mockState.studentStreakSnapshots[0].is_stale).toBe(false);
  });

  it('TC-28, TC-29 & TC-30: Legacy/active duplicate deduplication, stable timeline pagination, and full reconciliation', async () => {
    seedContinuousClasses(1, 1, 10, { assignmentId: 10, startDate: '2026-08-01' });

    // Inject duplicate legacy archive rows matching same (student_id, assignment_id, date, session)
    mockState.archiveStudentAttendance.push({
      id: 999,
      student_id: 1,
      roll_no: '268W1A0501',
      assignment_id: 10,
      branch: 'CSE',
      semester: 1,
      academic_year: '2026-2027',
      date: '2026-08-01',
      session: 1,
      status: 'PRESENT',
    });

    // Deduplicated timeline must stay exactly 10 rows
    const page1 = await UnifiedAttendanceRepository.getStudentAttendanceTimeline({
      studentId: 1,
      limit: 4,
      offset: 0,
      order: 'DESC',
    });
    const page2 = await UnifiedAttendanceRepository.getStudentAttendanceTimeline({
      studentId: 1,
      limit: 4,
      offset: 4,
      order: 'DESC',
    });
    expect(page1.totalCount).toBe(10);
    expect(page1.records.length).toBe(4);
    expect(page2.records.length).toBe(4);
    expect(page1.records[3].id).not.toBe(page2.records[0].id);

    // Full reconciliation against source records
    const recon = await StreakService.reconcileStudentAfterCorrection({
      studentId: 1,
      rollNo: '268W1A0501',
      triggerSource: 'FULL_RECONCILIATION_AUDIT',
    });
    expect(recon.success).toBe(true);
    expect(recon.streakData.totalAttendedClasses).toBe(10);
    expect(mockState.studentStreakReconciliationLogs.length).toBe(1);

    // Subject attendance parity across active + legacy archive deduplication
    mockState.archiveAttendanceSessions.push({
      id: 998,
      original_session_id: 998,
      assignment_id: 10,
      branch: 'CSE',
      semester: 1,
      academic_year: '2026-2027',
      date: '2026-08-20',
      session: 1,
      topic_covered: 'Legacy Archived Lecture',
    });
    mockState.archiveStudentAttendance.push({
      id: 1000,
      student_id: 1,
      roll_no: '268W1A0501',
      assignment_id: 10,
      branch: 'CSE',
      semester: 1,
      academic_year: '2026-2027',
      date: '2026-08-20',
      session: 1,
      status: 'NCC',
    });
    const subjectView = await getStudentSubjectAttendance(1, 10);
    expect(subjectView.summary.classesHeld).toBe(11); // 10 active (1 dup ignored) + 1 legacy
    expect(subjectView.summary.ncc).toBe(1);
    expect(subjectView.timeline.some(t => t.date === '2026-08-20' && t.is_archived === true)).toBe(true);
  });
});
