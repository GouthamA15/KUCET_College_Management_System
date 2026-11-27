import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateStreakFromSequence,
} from '@/services/attendance/StreakService';
import {
  getServerStreakPolicy,
  STREAK_ATTENDANCE_POLICIES,
  computeAttendanceAnalytics,
  evaluateRecognitionBadges,
} from '@/lib/streak-config';
import { computeGoalCurrentValue, GoalAndNotificationService } from '@/services/attendance/GoalAndNotificationService';

// --- Mock setup for Dispute Approval Route & Goal API Route ---
const { mockReconcile, mockAuthUser, mockDisputeRow, mockTxUpdate, mockTxInsert, mockBroadcast } = vi.hoisted(() => ({
  mockReconcile: vi.fn(async () => ({ success: true, streakData: { currentStreak: 3, longestStreak: 3 } })),
  mockAuthUser: { current: { id: 77, staffId: 77, role: 'faculty', branch: 'CSE' } },
  mockDisputeRow: {
    current: {
      id: 42,
      student_id: 101,
      assignment_id: 10,
      attendance_date: '2026-10-28',
      session: 2,
      original_status: 'ABSENT',
      requested_status: 'PRESENT',
      reason: 'Present in lab but marked absent by mistake',
      reviewer_comments: null,
      status: 'PENDING',
      faculty_id: 77,
      subject_code: 'CS501',
      branch: 'CSE',
      course_semester: 5,
      academic_year: '2026-2027',
    },
  },
  mockTxUpdate: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => [{ affectedRows: 1 }]) })) })),
  mockTxInsert: vi.fn(() => ({ values: vi.fn(async () => [{ insertId: 1 }]) })),
  mockBroadcast: vi.fn(async () => {}),
}));

vi.mock('@/lib/sse', () => ({
  broadcastUpdate: mockBroadcast,
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

vi.mock('@/db', async () => {
  const { studentAttendanceDisputes } = await vi.importActual('@/db/schema/attendance');
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn((table) => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => (table === studentAttendanceDisputes && mockDisputeRow.current ? [mockDisputeRow.current] : [])),
            })),
          })),
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
      transaction: vi.fn(async (cb) => {
        const tx = {
          update: mockTxUpdate,
          insert: mockTxInsert,
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [{ id: 500, session_id: 90 }]),
              })),
            })),
          })),
        };
        return cb(tx);
      }),
    },
  };
});

vi.mock('@/services/attendance/StreakService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    StreakService: {
      ...actual.StreakService,
      reconcileStudentAfterCorrection: mockReconcile,
    },
  };
});

import { PUT as reviewDisputePUT } from '@/app/api/staff/faculty/attendance/disputes/[id]/route';

describe('Phase 1 + Phase 2 Combined Attendance Achievement System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.current = { id: 77, staffId: 77, role: 'faculty', branch: 'CSE' };
    mockDisputeRow.current = {
      id: 42,
      student_id: 101,
      assignment_id: 10,
      attendance_date: '2026-10-28',
      session: 2,
      original_status: 'ABSENT',
      requested_status: 'PRESENT',
      reason: 'Present in lab',
      reviewer_comments: null,
      status: 'PENDING',
      faculty_id: 77,
      subject_code: 'CS501',
      branch: 'CSE',
      course_semester: 5,
      academic_year: '2026-2027',
    };
  });

  describe('1. Centralized NCC & MEDICAL Policy', () => {
    it('always enforces EXCUSED_INCREMENTS on the server', () => {
      expect(getServerStreakPolicy()).toBe(STREAK_ATTENDANCE_POLICIES.EXCUSED_INCREMENTS);
    });

    it('counts PRESENT, NCC, and MEDICAL equally as attended and increments streak', () => {
      const sessions = [
        { id: 1, assignment_id: 10, attendance_date: '2026-10-27', session_number: 1, subject_code: 'CS501', subject_name: 'OS' },
        { id: 2, assignment_id: 10, attendance_date: '2026-10-27', session_number: 2, subject_code: 'CS501', subject_name: 'OS' },
        { id: 3, assignment_id: 10, attendance_date: '2026-10-28', session_number: 1, subject_code: 'CS501', subject_name: 'OS' },
      ];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'NCC' },
        { session_id: 3, status: 'MEDICAL' },
      ];

      const streak = calculateStreakFromSequence(sessions, records);
      expect(streak.currentStreak).toBe(3);
      expect(streak.longestStreak).toBe(3);
      expect(streak.totalAttendedClasses).toBe(3);
      expect(streak.timeline.map((t) => t.status)).toEqual(['PRESENT', 'NCC', 'MEDICAL']);

      const analytics = computeAttendanceAnalytics(streak.timeline);
      expect(analytics.counts).toEqual({
        present: 1,
        ncc: 1,
        medical: 1,
        absent: 0,
        unrecorded: 0,
        attended: 3,
        total: 3,
        rate: 100,
      });
    });
  });

  describe('2. Faculty-Approved Attendance Dispute & Streak Restoration', () => {
    it('demonstrates Present -> Absent -> Present reset and continuous restoration after accepted dispute', () => {
      const sessions = [
        { id: 1, assignment_id: 10, attendance_date: '2026-10-28', session_number: 1 },
        { id: 2, assignment_id: 10, attendance_date: '2026-10-28', session_number: 2 },
        { id: 3, assignment_id: 10, attendance_date: '2026-10-28', session_number: 3 },
      ];

      // Before approval (pending dispute must not alter streak)
      const beforeRecords = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'ABSENT' },
        { session_id: 3, status: 'PRESENT' },
      ];
      const beforeResult = calculateStreakFromSequence(sessions, beforeRecords);
      expect(beforeResult.currentStreak).toBe(1);
      expect(beforeResult.timeline.map((t) => t.streakAfterClass)).toEqual([1, 0, 1]);

      // After faculty accepts dispute (e.g. corrected to PRESENT or NCC)
      const afterRecords = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'NCC' },
        { session_id: 3, status: 'PRESENT' },
      ];
      const afterResult = calculateStreakFromSequence(sessions, afterRecords);
      expect(afterResult.currentStreak).toBe(3);
      expect(afterResult.longestStreak).toBe(3);
      expect(afterResult.timeline.map((t) => t.streakAfterClass)).toEqual([1, 2, 3]);
    });

    it('triggers StreakService.reconcileStudentAfterCorrection when authorized faculty approves dispute', async () => {
      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/disputes/42', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      });

      const res = await reviewDisputePUT(req, { params: Promise.resolve({ id: '42' }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.streakRecalculated).toBe(true);
      expect(json.streakData).toEqual(expect.objectContaining({ currentStreak: 3, longestStreak: 3 }));
      expect(mockTxUpdate).toHaveBeenCalled();
      expect(mockTxInsert).toHaveBeenCalled();
      expect(mockReconcile).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 101,
          triggerSource: 'DISPUTE_APPROVAL',
          referenceId: 42,
        })
      );
      expect(mockBroadcast).toHaveBeenCalledWith(
        'ATTENDANCE_DISPUTE_APPROVED',
        expect.objectContaining({
          student_id: 101,
          dispute_id: 42,
          assignment_id: 10,
          status: 'APPROVED',
        })
      );
    });

    it('does NOT trigger streak restoration when faculty rejects dispute', async () => {
      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/disputes/42', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED', rejection_reason: 'Not present in lab register' }),
      });

      const res = await reviewDisputePUT(req, { params: Promise.resolve({ id: '42' }) });
      expect(res.status).toBe(200);
      expect(mockReconcile).not.toHaveBeenCalled();
    });

    it('rejects repeated approval of an already resolved dispute with 409 Conflict', async () => {
      mockDisputeRow.current.status = 'APPROVED';
      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/disputes/42', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      });

      const res = await reviewDisputePUT(req, { params: Promise.resolve({ id: '42' }) });
      expect(res.status).toBe(409);
      expect(mockReconcile).not.toHaveBeenCalled();
    });

    it('blocks unauthorized faculty/student from approving another faculty dispute', async () => {
      mockAuthUser.current = { id: 999, staffId: 999, role: 'faculty', branch: 'ECE' };
      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/disputes/42', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      });

      const res = await reviewDisputePUT(req, { params: Promise.resolve({ id: '42' }) });
      expect(res.status).toBe(403);
      expect(mockReconcile).not.toHaveBeenCalled();
    });
  });

  describe('3. Analytics, Calendar & Recognition Categories', () => {
    it('computes weekly/monthly trends, subject insights, and calendar days accurately', () => {
      const timeline = [
        { sessionId: 1, date: '2026-09-10', sessionNumber: 1, subjectCode: 'CS501', subjectName: 'OS', status: 'ABSENT', isAttended: false, isBreak: true, streakAfterClass: 0 },
        { sessionId: 2, date: '2026-09-11', sessionNumber: 1, subjectCode: 'CS501', subjectName: 'OS', status: 'PRESENT', isAttended: true, isBreak: false, streakAfterClass: 1 },
        { sessionId: 3, date: '2026-10-05', sessionNumber: 1, subjectCode: 'CS502', subjectName: 'DBMS', status: 'NCC', isAttended: true, isBreak: false, streakAfterClass: 2 },
        { sessionId: 4, date: '2026-10-05', sessionNumber: 2, subjectCode: 'CS501', subjectName: 'OS', status: 'MEDICAL', isAttended: true, isBreak: false, streakAfterClass: 3 },
      ];

      const analytics = computeAttendanceAnalytics(timeline);
      expect(analytics.counts.total).toBe(4);
      expect(analytics.counts.attended).toBe(3);
      expect(analytics.counts.ncc).toBe(1);
      expect(analytics.counts.medical).toBe(1);
      expect(analytics.counts.absent).toBe(1);
      expect(analytics.counts.rate).toBe(75);
      expect(analytics.monthlyTrend).toHaveLength(2);
      expect(analytics.improvementDelta).toBe(50); // Sept 50% -> Oct 100%
      expect(analytics.calendarDays[0].date).toBe('2026-10-05');
      expect(analytics.calendarDays[0].sessions).toHaveLength(2);
      expect(analytics.subjectInsights.find((s) => s.subjectCode === 'CS502').rate).toBe(100);
    });

    it('awards Comeback, Improvement, Commitment, and Excellence recognition badges cleanly', () => {
      const badges = evaluateRecognitionBadges({
        currentStreak: 5,
        longestStreak: 12,
        previousStreak: 4,
        totalAttendedClasses: 28,
        totalEligibleClasses: 30,
        improvementDelta: 8,
      });

      const unlockedCodes = badges.filter((b) => b.unlocked).map((b) => b.code);
      expect(unlockedCodes).toContain('FIRST_COMEBACK');
      expect(unlockedCodes).toContain('FIVE_CLASS_RECOVERY');
      expect(unlockedCodes).toContain('MONTHLY_IMPROVEMENT');
      expect(unlockedCodes).toContain('COMMITMENT_25');
      expect(unlockedCodes).toContain('PERSONAL_BEST_10');
      expect(unlockedCodes).toContain('EXCELLENCE_90');
    });
  });

  describe('4. Personal Goals Validation & Progress Calculation', () => {
    const sampleStreakData = {
      currentStreak: 8,
      longestStreak: 12,
      totalAttendedClasses: 45,
      timeline: [
        { date: '2026-10-01', sessionNumber: 1, subjectCode: 'CS501', subjectName: 'OS', status: 'PRESENT', isAttended: true },
        { date: '2026-10-02', sessionNumber: 1, subjectCode: 'CS501', subjectName: 'OS', status: 'PRESENT', isAttended: true },
        { date: '2026-10-03', sessionNumber: 1, subjectCode: 'CS502', subjectName: 'DBMS', status: 'ABSENT', isAttended: false },
      ],
    };

    it('computes goal progress for percentage, streak, cumulative, and subject goals', () => {
      expect(computeGoalCurrentValue({ goal_type: 'SEMESTER_ATTENDANCE_PCT' }, sampleStreakData)).toBe(67);
      expect(computeGoalCurrentValue({ goal_type: 'CONSECUTIVE_STREAK' }, sampleStreakData)).toBe(8);
      expect(computeGoalCurrentValue({ goal_type: 'CUMULATIVE_CLASSES' }, sampleStreakData)).toBe(45);
      expect(computeGoalCurrentValue({ goal_type: 'SUBJECT_ATTENDANCE_PCT', subject_code: 'CS501' }, sampleStreakData)).toBe(100);
    });

    it('rejects impossible or invalid personal goals (e.g. >100% or <= longestStreak for BEAT_PERSONAL_BEST)', async () => {
      await expect(
        GoalAndNotificationService.createGoal(
          { studentId: 101, goalType: 'SEMESTER_ATTENDANCE_PCT', title: 'Impossible', targetValue: 120 },
          sampleStreakData
        )
      ).rejects.toThrow('Percentage goals cannot exceed 100%.');

      await expect(
        GoalAndNotificationService.createGoal(
          { studentId: 101, goalType: 'BEAT_PERSONAL_BEST', title: 'Too low', targetValue: 10 },
          sampleStreakData
        )
      ).rejects.toThrow('Target must exceed your current personal best (12).');
    });
  });

  describe('5. Notification Architecture (In-App + WebSocket + Optional Push, ZERO Email)', () => {
    it('persists new notification, broadcasts to room student:<id>, and avoids duplicate dispatch on replay', async () => {
      const mockBroadcast = vi.fn(async () => {});
      const mockPushSend = vi.fn(async () => ({ success: true, sentCount: 1 }));
      vi.doMock('@/lib/sse', () => ({ broadcastUpdate: mockBroadcast }));
      vi.doMock('@/services/security/PushNotificationService', () => ({
        default: { sendToRecipients: mockPushSend },
      }));

      // Simulate new insert (affectedRows = 1)
      const mockDbInsertNew = {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => []) })) })) })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onDuplicateKeyUpdate: vi.fn(async () => [{ affectedRows: 1 }]),
          })),
        })),
      };

      const res1 = await GoalAndNotificationService.createIdempotentNotification(
        {
          studentId: 101,
          rollNo: '22KU01',
          eventKey: 'milestone_STREAK_5',
          category: 'MILESTONE_UNLOCKED',
          title: 'First Spark!',
          message: 'Unlocked 5 classes badge',
          emojiChar: '🔥',
        },
        mockDbInsertNew
      );
      expect(res1?.isNewEvent).toBe(true);
      expect(mockBroadcast).toHaveBeenCalledWith(
        'STREAK_NOTIFICATION_CREATED',
        expect.objectContaining({ student_id: 101, event_key: 'milestone_STREAK_5' }),
        { room: 'student:101' }
      );
      expect(mockPushSend).toHaveBeenCalledWith(['22KU01'], expect.objectContaining({ category: 'attendance' }));

      // Simulate duplicate replay (affectedRows = 0 or 2) -> must NOT re-broadcast or re-push
      mockBroadcast.mockClear();
      mockPushSend.mockClear();
      const mockDbDuplicate = {
        ...mockDbInsertNew,
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onDuplicateKeyUpdate: vi.fn(async () => [{ affectedRows: 2 }]),
          })),
        })),
      };
      const res2 = await GoalAndNotificationService.createIdempotentNotification(
        {
          studentId: 101,
          rollNo: '22KU01',
          eventKey: 'milestone_STREAK_5',
          category: 'MILESTONE_UNLOCKED',
          title: 'First Spark!',
          message: 'Unlocked 5 classes badge',
        },
        mockDbDuplicate
      );
      expect(res2?.isNewEvent).toBe(false);
      expect(mockBroadcast).not.toHaveBeenCalled();
      expect(mockPushSend).not.toHaveBeenCalled();
    });
  });
});
