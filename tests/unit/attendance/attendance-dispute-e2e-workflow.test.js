import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateStreakFromSequence } from '@/services/attendance/StreakService';
import { REALTIME_EVENTS, resolveEventRooms, normalizeEventName } from '@/lib/events/realtime-events';

// --- Stateful in-memory DB simulation for E2E dispute approval -> attendance update -> streak recalculation ---
const {
  mockAuthUser,
  mockDbState,
  mockBroadcast,
  mockInvalidateTag,
  mockInvalidateKey,
} = vi.hoisted(() => ({
  mockAuthUser: { current: { id: 77, staffId: 77, role: 'faculty', branch: 'CSE' } },
  mockDbState: {
    disputes: [],
    attendanceRows: [],
    sessions: [],
    assignments: [],
    students: [],
    auditLogs: [],
  },
  mockBroadcast: vi.fn(async () => {}),
  mockInvalidateTag: vi.fn(async () => true),
  mockInvalidateKey: vi.fn(async () => true),
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

vi.mock('@/lib/cache', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    invalidateTag: mockInvalidateTag,
    invalidateKey: mockInvalidateKey,
  };
});

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

// Helper to inspect Drizzle conditions/values isn't needed if we mock db cleanly for the dispute route + StreakService
vi.mock('@/db', async () => {
  const schema = await vi.importActual('@/db/schema');
  const {
    studentAttendanceDisputes,
    studentAttendance,
    attendanceAuditLogs,
    students,
  } = schema;

  const makeSelectChain = () => ({
    from: vi.fn((table) => ({
      innerJoin: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            if (table === studentAttendanceDisputes) {
              const d = mockDbState.activeDispute;
              return d ? [d] : [];
            }
            return [];
          }),
        })),
      })),
      where: vi.fn(() => ({
        limit: vi.fn(async () => {
          if (table === students) {
            return mockDbState.students;
          }
          if (table === studentAttendance) {
            return mockDbState.attendanceRows.filter(
              (r) =>
                r.student_id === mockDbState.activeDispute?.student_id &&
                r.assignment_id === mockDbState.activeDispute?.assignment_id &&
                String(r.date).slice(0, 10) ===
                  (mockDbState.activeDispute?.attendance_date instanceof Date
                    ? mockDbState.activeDispute.attendance_date.toISOString().split('T')[0]
                    : String(mockDbState.activeDispute?.attendance_date).slice(0, 10)) &&
                r.session === mockDbState.activeDispute?.session
            );
          }
          return [];
        }),
        then: undefined,
      })),
    })),
  });

  const makeTx = () => ({
    select: vi.fn(() => ({
      from: vi.fn((table) => ({
        where: vi.fn(async () => {
          if (table === studentAttendance) {
            const d = mockDbState.activeDispute;
            const dDate =
              d.attendance_date instanceof Date
                ? d.attendance_date.toISOString().split('T')[0]
                : String(d.attendance_date).slice(0, 10);
            return mockDbState.attendanceRows.filter(
              (r) =>
                r.student_id === d.student_id &&
                r.assignment_id === d.assignment_id &&
                String(r.date).slice(0, 10) === dDate &&
                r.session === d.session
            );
          }
          return [];
        }),
      })),
    })),
    update: vi.fn((table) => ({
      set: vi.fn((values) => ({
        where: vi.fn(async () => {
          if (table === studentAttendanceDisputes && mockDbState.activeDispute) {
            Object.assign(mockDbState.activeDispute, values);
          }
          if (table === studentAttendance && mockDbState.activeDispute) {
            const d = mockDbState.activeDispute;
            const dDate =
              d.attendance_date instanceof Date
                ? d.attendance_date.toISOString().split('T')[0]
                : String(d.attendance_date).slice(0, 10);
            // Update ALL matching rows for this exact slot (student_id, assignment_id, date, session)
            for (const r of mockDbState.attendanceRows) {
              if (
                r.student_id === d.student_id &&
                r.assignment_id === d.assignment_id &&
                String(r.date).slice(0, 10) === dDate &&
                r.session === d.session
              ) {
                Object.assign(r, values);
              }
            }
          }
          return [{ affectedRows: 1 }];
        }),
      })),
    })),
    insert: vi.fn((table) => ({
      values: vi.fn(async (val) => {
        if (table === attendanceAuditLogs) {
          mockDbState.auditLogs.push(val);
        }
        return [{ insertId: mockDbState.auditLogs.length }];
      }),
    })),
  });

  return {
    db: {
      select: vi.fn(() => makeSelectChain()),
      transaction: vi.fn(async (cb) => cb(makeTx())),
    },
  };
});

vi.mock('@/services/attendance/StreakService', async (importOriginal) => {
  const actual = await importOriginal();
  const computeFromMockState = async ({ studentId }) => {
    const records = mockDbState.attendanceRows
      .filter((r) => r.student_id === studentId)
      .sort((a, b) => a.id - b.id);
    const res = actual.calculateStreakFromSequence(mockDbState.sessions, records);
    return {
      ...res,
      selectedEmoji: { char: '🔥', code: 'fire' },
      unlockedMilestones: [],
      lockedMilestones: [],
      allMilestones: [],
    };
  };

  return {
    ...actual,
    StreakService: {
      ...actual.StreakService,
      calculateStudentStreak: vi.fn(computeFromMockState),
      reconcileStudentAfterCorrection: vi.fn(async (params) => {
        const streakData = await computeFromMockState(params);
        return { success: true, streakData };
      }),
    },
  };
});

import { PUT as reviewDisputePUT } from '@/app/api/staff/faculty/attendance/disputes/[id]/route';

describe('Attendance Dispute Approval -> Official Attendance -> Streak Reconciliation E2E Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.current = { id: 77, staffId: 77, role: 'faculty', branch: 'CSE' };
    mockDbState.students = [{ roll_no: '23B81A0501' }];
    mockDbState.auditLogs = [];
    mockDbState.sessions = [
      { id: 1020066, assignment_id: 450014, attendance_date: '2026-10-28', session_number: 1, subject_code: 'PE4102CS', subject_name: 'Software Testing' },
      { id: 1020067, assignment_id: 450014, attendance_date: '2026-10-28', session_number: 2, subject_code: 'PE4102CS', subject_name: 'Software Testing' },
      { id: 1050066, assignment_id: 450014, attendance_date: '2026-11-26', session_number: 1, subject_code: 'PE4102CS', subject_name: 'Software Testing' },
    ];
    // Simulate duplicate rows for the disputed session (the exact bug observed in college_db!)
    mockDbState.attendanceRows = [
      { id: 40, session_id: 1020066, student_id: 40, assignment_id: 450014, date: '2026-10-28', session: 1, status: 'PRESENT' },
      { id: 108, session_id: 1020067, student_id: 40, assignment_id: 450014, date: '2026-10-28', session: 2, status: 'PRESENT' },
      { id: 30040, session_id: 1050066, student_id: 40, assignment_id: 450014, date: '2026-11-26', session: 1, status: 'ABSENT' },
      { id: 30108, session_id: 1050066, student_id: 40, assignment_id: 450014, date: '2026-11-26', session: 1, status: 'ABSENT' },
    ];
    mockDbState.activeDispute = {
      id: 60001,
      student_id: 40,
      assignment_id: 450014,
      attendance_date: new Date('2026-11-26T00:00:00.000Z'), // Date object from mysql2
      session: 1,
      original_status: 'ABSENT',
      requested_status: 'PRESENT',
      reason: 'Was present in class',
      reviewer_comments: null,
      status: 'PENDING',
      faculty_id: 77,
      subject_code: 'PE4102CS',
      branch: 'CSE',
      course_semester: 7,
      academic_year: '2026-2027',
    };
  });

  it('Scenario A: Approved dispute updates all matching attendance rows (even with Date objects & duplicate rows) and recalculates streak from 0 to 3', async () => {
    // Before approval: streak is 0, personal best is 2, attended is 2/3
    const before = calculateStreakFromSequence(mockDbState.sessions, mockDbState.attendanceRows);
    expect(before.currentStreak).toBe(0);
    expect(before.longestStreak).toBe(2);
    expect(before.totalAttendedClasses).toBe(2);

    const req = new Request('http://localhost:3000/api/staff/faculty/attendance/disputes/60001', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    const res = await reviewDisputePUT(req, { params: Promise.resolve({ id: '60001' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.streakRecalculated).toBe(true);

    // Official attendance rows MUST ALL be PRESENT
    expect(mockDbState.attendanceRows.find((r) => r.id === 30040).status).toBe('PRESENT');
    expect(mockDbState.attendanceRows.find((r) => r.id === 30108).status).toBe('PRESENT');

    // Recalculated streak must now be 3, personal best 3, attended 3/3
    expect(json.streakData.currentStreak).toBe(3);
    expect(json.streakData.longestStreak).toBe(3);
    expect(json.streakData.totalAttendedClasses).toBe(3);
    expect(json.streakData.timeline.every((t) => t.status === 'PRESENT' && t.isAttended)).toBe(true);

    // Audit log recorded
    expect(mockDbState.auditLogs).toHaveLength(1);
    expect(mockDbState.auditLogs[0]).toEqual(
      expect.objectContaining({
        dispute_id: 60001,
        previous_status: 'ABSENT',
        new_status: 'PRESENT',
      })
    );

    // Cache invalidated and realtime broadcast sent
    expect(mockInvalidateTag).toHaveBeenCalledWith('attendance:40');
    expect(mockInvalidateKey).toHaveBeenCalledWith('academic_info:40:CSE:7:2026-2027');
    expect(mockBroadcast).toHaveBeenCalledWith(
      'ATTENDANCE_DISPUTE_APPROVED',
      expect.objectContaining({
        student_id: 40,
        roll_no: '23B81A0501',
        dispute_id: 60001,
        status: 'APPROVED',
      })
    );
  });

  it('Scenario B: Rejected dispute keeps official attendance ABSENT and streak at 0', async () => {
    const req = new Request('http://localhost:3000/api/staff/faculty/attendance/disputes/60001', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'REJECTED', rejection_reason: 'Student was absent' }),
    });
    const res = await reviewDisputePUT(req, { params: Promise.resolve({ id: '60001' }) });
    expect(res.status).toBe(200);

    expect(mockDbState.activeDispute.status).toBe('REJECTED');
    expect(mockDbState.attendanceRows.find((r) => r.id === 30040).status).toBe('ABSENT');
    expect(mockDbState.attendanceRows.find((r) => r.id === 30108).status).toBe('ABSENT');
    expect(mockDbState.auditLogs).toHaveLength(0);

    const after = calculateStreakFromSequence(mockDbState.sessions, mockDbState.attendanceRows);
    expect(after.currentStreak).toBe(0);
  });

  it('Scenario C: Multiple sessions on same date — only disputed session changes, other sessions untouched', async () => {
    // Add another session on 2026-11-26 (Period 2) marked ABSENT
    mockDbState.sessions.push({
      id: 1050067,
      assignment_id: 450014,
      attendance_date: '2026-11-26',
      session_number: 2,
      subject_code: 'PE4102CS',
      subject_name: 'Software Testing',
    });
    mockDbState.attendanceRows.push({
      id: 30109,
      session_id: 1050067,
      student_id: 40,
      assignment_id: 450014,
      date: '2026-11-26',
      session: 2,
      status: 'ABSENT',
    });

    const req = new Request('http://localhost:3000/api/staff/faculty/attendance/disputes/60001', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    const res = await reviewDisputePUT(req, { params: Promise.resolve({ id: '60001' }) });
    expect(res.status).toBe(200);

    // Period 1 updated to PRESENT; Period 2 remains ABSENT
    expect(mockDbState.attendanceRows.find((r) => r.id === 30040).status).toBe('PRESENT');
    expect(mockDbState.attendanceRows.find((r) => r.id === 30109).status).toBe('ABSENT');
  });

  it('Scenario D: Duplicate approval returns 409 Conflict and creates no duplicate audit logs', async () => {
    mockDbState.activeDispute.status = 'APPROVED';
    const req = new Request('http://localhost:3000/api/staff/faculty/attendance/disputes/60001', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    const res = await reviewDisputePUT(req, { params: Promise.resolve({ id: '60001' }) });
    expect(res.status).toBe(409);
    expect(mockDbState.auditLogs).toHaveLength(0);
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it('Scenario E: Real-time event taxonomy & room resolution delivers ATTENDANCE_DISPUTE_APPROVED to student rooms', () => {
    expect(REALTIME_EVENTS.ATTENDANCE_DISPUTE_APPROVED).toBe('ATTENDANCE_DISPUTE_APPROVED');
    expect(normalizeEventName('ATTENDANCE_DISPUTE_APPROVED')).toBe('ATTENDANCE_DISPUTE_APPROVED');

    const rooms = resolveEventRooms('ATTENDANCE_DISPUTE_APPROVED', {
      student_id: 40,
      roll_no: '23B81A0501',
    });
    expect(rooms).toContain('user:student:40');
    expect(rooms).toContain('student:23B81A0501');
  });
});
