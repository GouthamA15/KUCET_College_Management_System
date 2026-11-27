import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  STREAK_ATTENDANCE_POLICIES,
  evaluateAttendanceStatus,
  sortTimelineDescending,
  computeAttendanceAnalytics,
  DEFAULT_STREAK_MILESTONES,
} from '@/lib/streak-config';
import { computeGoalCurrentValue } from '@/services/attendance/GoalAndNotificationService';

const mockGetAuthUser = vi.fn();
vi.mock('@/lib/api-utils', () => ({
  getAuthUser: (...args) => mockGetAuthUser(...args),
  apiResponse: (data, status = 200) => Response.json(data, { status }),
  apiError: (msg, status = 400) => Response.json({ error: msg }, { status }),
  wrapHandler: (opts) => async (req) => opts.handler({ req, data: {} }),
  logAudit: vi.fn(),
}));

const mockCalculateStudentStreak = vi.fn();
const mockUpdateSelectedEmoji = vi.fn();
vi.mock('@/services/attendance/StreakService', () => ({
  StreakService: {
    calculateStudentStreak: (...args) => mockCalculateStudentStreak(...args),
    updateSelectedEmoji: (...args) => mockUpdateSelectedEmoji(...args),
  },
}));

const mockGetStudentGoals = vi.fn();
const mockSyncGoals = vi.fn();
const mockCreateGoal = vi.fn();
const mockUpdateGoal = vi.fn();
const mockGetNotifications = vi.fn();
const mockMarkRead = vi.fn();
const mockUpdatePref = vi.fn();
vi.mock('@/services/attendance/GoalAndNotificationService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    GoalAndNotificationService: {
      getStudentGoals: (...args) => mockGetStudentGoals(...args),
      syncGoalsWithStreakData: (...args) => mockSyncGoals(...args),
      createGoal: (...args) => mockCreateGoal(...args),
      updateGoal: (...args) => mockUpdateGoal(...args),
      getStudentNotifications: (...args) => mockGetNotifications(...args),
      markNotificationsRead: (...args) => mockMarkRead(...args),
      updateNotificationPreference: (...args) => mockUpdatePref(...args),
    },
  };
});

describe('Attendance Achievement — Security, Boundaries, Analytics & Calendar Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Phase 2 & 3: Policy, 9-Milestone Set & Deterministic Ordering', () => {
    it('verifies all 9 default milestones from 5 to 200 are unique and ascending', () => {
      expect(DEFAULT_STREAK_MILESTONES).toHaveLength(9);
      const thresholds = DEFAULT_STREAK_MILESTONES.map((m) => m.required_streak);
      expect(thresholds).toEqual([5, 10, 20, 30, 50, 75, 100, 150, 200]);
      const codes = new Set(DEFAULT_STREAK_MILESTONES.map((m) => m.milestone_code));
      expect(codes.size).toBe(9);
    });

    it('counts PRESENT, NCC, and MEDICAL as attended under EXCUSED_INCREMENTS and ABSENT/UNRECORDED as BREAK', () => {
      for (const s of ['PRESENT', 'NCC', 'MEDICAL']) {
        expect(evaluateAttendanceStatus(s, STREAK_ATTENDANCE_POLICIES.EXCUSED_INCREMENTS)).toMatchObject({
          action: 'INCREMENT',
          isAttended: true,
        });
      }
      for (const s of ['ABSENT', 'UNRECORDED', null, undefined, 'MALFORMED']) {
        expect(evaluateAttendanceStatus(s, STREAK_ATTENDANCE_POLICIES.EXCUSED_INCREMENTS)).toMatchObject({
          action: 'BREAK',
          isAttended: false,
        });
      }
    });

    it('orders timeline globally descending by date, sessionNumber, then sessionId', () => {
      const input = [
        { date: '2026-11-24', sessionNumber: 1, sessionId: 10 },
        { date: '2026-11-26', sessionNumber: 1, sessionId: 11 },
        { date: '2026-11-26', sessionNumber: 3, sessionId: 9 },
        { date: '2026-11-26', sessionNumber: 3, sessionId: 15 },
      ];
      const sorted = sortTimelineDescending(input);
      expect(sorted.map((x) => `${x.date}#${x.sessionNumber}#${x.sessionId}`)).toEqual([
        '2026-11-26#3#15',
        '2026-11-26#3#9',
        '2026-11-26#1#11',
        '2026-11-24#1#10',
      ]);
    });
  });

  describe('Phase 4 & 5: Goal Progress, Analytics & Leap-Year Calendar', () => {
    it('computes goal progress strictly from authoritative streakData', () => {
      const streakData = {
        currentStreak: 12,
        totalAttendedClasses: 45,
        timeline: [
          { date: '2026-02-29', sessionNumber: 1, sessionId: 1, status: 'PRESENT', isAttended: true, subjectCode: 'CS501' },
          { date: '2026-02-29', sessionNumber: 2, sessionId: 2, status: 'ABSENT', isAttended: false, subjectCode: 'CS502' },
        ],
      };
      expect(computeGoalCurrentValue({ goal_type: 'CONSECUTIVE_STREAK' }, streakData)).toBe(12);
      expect(computeGoalCurrentValue({ goal_type: 'CUMULATIVE_CLASSES' }, streakData)).toBe(45);
      expect(computeGoalCurrentValue({ goal_type: 'SEMESTER_ATTENDANCE_PCT' }, streakData)).toBe(50);
      expect(computeGoalCurrentValue({ goal_type: 'SUBJECT_ATTENDANCE_PCT', subject_code: 'CS501' }, streakData)).toBe(100);
      expect(computeGoalCurrentValue({ goal_type: 'SUBJECT_ATTENDANCE_PCT', subject_code: 'CS502' }, streakData)).toBe(0);
    });

    it('handles leap-year Feb 29 dates and empty timelines cleanly in analytics & calendar', () => {
      const emptyAnalytics = computeAttendanceAnalytics([]);
      expect(emptyAnalytics.counts.total).toBe(0);
      expect(emptyAnalytics.counts.rate).toBe(0);

      const leapTimeline = [
        { date: '2024-02-29', sessionNumber: 1, sessionId: 1, status: 'PRESENT', isAttended: true, subjectCode: 'CS101', subjectName: 'DSA' },
        { date: '2024-03-01', sessionNumber: 1, sessionId: 2, status: 'NCC', isAttended: true, subjectCode: 'CS101', subjectName: 'DSA' },
      ];
      const { calendarDays } = computeAttendanceAnalytics(leapTimeline);
      expect(calendarDays.map((d) => d.date)).toEqual(['2024-03-01', '2024-02-29']);
    });
  });

  describe('Phase 7: API Security, Auth, Validation & Pagination Bounds (S01-S15)', () => {
    it('rejects unauthenticated requests (401) across student attendance endpoints', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const { GET: streakGet } = await import('@/app/api/student/attendance/streak/route');
      const { GET: historyGet } = await import('@/app/api/student/attendance/streak/history/route');
      const { GET: analyticsGet } = await import('@/app/api/student/attendance/analytics/route');
      const { GET: goalsGet, POST: goalsPost } = await import('@/app/api/student/attendance/goals/route');
      const { GET: notifGet, PATCH: notifPatch } = await import('@/app/api/student/attendance/notifications/route');

      expect((await streakGet(new Request('http://localhost/api/student/attendance/streak'))).status).toBe(401);
      expect((await historyGet(new Request('http://localhost/api/student/attendance/streak/history'))).status).toBe(401);
      expect((await analyticsGet(new Request('http://localhost/api/student/attendance/analytics'))).status).toBe(401);
      expect((await goalsGet(new Request('http://localhost/api/student/attendance/goals'))).status).toBe(401);
      expect((await goalsPost(new Request('http://localhost/api/student/attendance/goals', { method: 'POST', body: '{}' }))).status).toBe(401);
      expect((await notifGet(new Request('http://localhost/api/student/attendance/notifications'))).status).toBe(401);
      expect((await notifPatch(new Request('http://localhost/api/student/attendance/notifications', { method: 'PATCH', body: '{}' }))).status).toBe(401);
    });

    it('ignores forged student_id in request body/query and derives student_id from JWT session (S03/S04)', async () => {
      mockGetAuthUser.mockResolvedValue({ student_id: 101, roll_no: '24B81A0501' });
      mockCalculateStudentStreak.mockResolvedValue({ currentStreak: 5, longestStreak: 5, timeline: [] });
      mockCreateGoal.mockResolvedValue({ success: true, goal: { id: 1 } });

      const { POST: goalsPost } = await import('@/app/api/student/attendance/goals/route');
      const req = new Request('http://localhost/api/student/attendance/goals?student_id=999', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: 999,
          current_value: 999,
          goal_type: 'CONSECUTIVE_STREAK',
          title: 'Reach 10 classes',
          target_value: 10,
        }),
      });
      const res = await goalsPost(req);
      expect(res.status).toBe(201);
      expect(mockCreateGoal).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: 101, targetValue: 10 }),
        expect.any(Object)
      );
    });

    it('rejects negative, zero, empty, and unrealistic (>1000) goal targets', async () => {
      mockGetAuthUser.mockResolvedValue({ student_id: 101, roll_no: '24B81A0501' });
      const { POST: goalsPost } = await import('@/app/api/student/attendance/goals/route');

      for (const badPayload of [
        { goal_type: 'CONSECUTIVE_STREAK', title: '', target_value: 10 },
        { goal_type: 'CONSECUTIVE_STREAK', title: 'Neg', target_value: -5 },
        { goal_type: 'CONSECUTIVE_STREAK', title: 'Zero', target_value: 0 },
        { goal_type: 'CONSECUTIVE_STREAK', title: 'Huge', target_value: 999999 },
      ]) {
        const res = await goalsPost(
          new Request('http://localhost/api/student/attendance/goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(badPayload),
          })
        );
        expect(res.status).toBe(400);
      }
    });

    it('bounds notification pagination limit <= 100 and returns 400 on invalid JSON', async () => {
      mockGetAuthUser.mockResolvedValue({ student_id: 101, roll_no: '24B81A0501' });
      mockGetNotifications.mockResolvedValue({ notifications: [], unreadCount: 0, remindersEnabled: true });

      const { GET: notifGet, PATCH: notifPatch } = await import('@/app/api/student/attendance/notifications/route');
      await notifGet(new Request('http://localhost/api/student/attendance/notifications?limit=999999'));
      expect(mockGetNotifications).toHaveBeenCalledWith(101, { unreadOnly: false, limit: 100 });

      const badJsonRes = await notifPatch(
        new Request('http://localhost/api/student/attendance/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: '{invalid-json',
        })
      );
      expect(badJsonRes.status).toBe(400);
    });

    it('rejects invalid assignment_id on attendance history route', async () => {
      mockGetAuthUser.mockResolvedValue({ student_id: 101, roll_no: '24B81A0501' });
      const { GET: rawHistoryGet } = await import('@/app/api/student/attendance/history/route');

      const res = await rawHistoryGet(
        new Request('http://localhost/api/student/attendance/history?assignment_id=abc')
      );
      expect(res.status).toBe(400);
    });
  });
});
