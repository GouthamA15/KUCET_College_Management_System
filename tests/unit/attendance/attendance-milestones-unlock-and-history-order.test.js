import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_STREAK_MILESTONES,
  DEFAULT_STREAK_EMOJI,
  evaluateMilestoneProgress,
  validateMilestonesConfig,
} from '@/lib/streak-config';
import { sortTimelineDescending } from '@/services/attendance/StreakService';

// Mock logger and api-utils for route tests
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    runWithContext: vi.fn((_ctx, fn) => fn()),
  },
}));

let mockStudentUser = {
  id: 1,
  student_id: 101,
  roll_no: '22KU01',
  role: 'student',
};

vi.mock('@/lib/api-utils', () => ({
  getAuthUser: vi.fn(async () => mockStudentUser),
  apiResponse: vi.fn((data, status = 200) => ({
    status,
    json: async () => data,
    data,
  })),
  apiError: vi.fn((message, status = 400) => ({
    status,
    json: async () => ({ error: message }),
    error: message,
  })),
  wrapHandler: vi.fn((opts) => opts),
}));

const mockAscTimeline = [
  { sessionId: 101, date: '2026-10-27', sessionNumber: 3, subjectCode: 'CS501', subjectName: 'OS', status: 'PRESENT', isAttended: true, isBreak: false, streakAfterClass: 1 },
  { sessionId: 102, date: '2026-10-27', sessionNumber: 4, subjectCode: 'CS502', subjectName: 'DBMS', status: 'PRESENT', isAttended: true, isBreak: false, streakAfterClass: 2 },
  { sessionId: 103, date: '2026-10-28', sessionNumber: 1, subjectCode: 'CS501', subjectName: 'OS', status: 'ABSENT', isAttended: false, isBreak: true, streakAfterClass: 0 },
  { sessionId: 104, date: '2026-10-28', sessionNumber: 2, subjectCode: 'CS503', subjectName: 'CN', status: 'PRESENT', isAttended: true, isBreak: false, streakAfterClass: 1 },
];

vi.mock('@/services/attendance/StreakService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    StreakService: {
      calculateStudentStreak: vi.fn(async ({ studentId }) => ({
        studentId,
        currentStreak: 1,
        longestStreak: 2,
        previousStreak: 2,
        totalEligibleClasses: 4,
        totalAttendedClasses: 3,
        totalMissedClasses: 1,
        selectedEmoji: DEFAULT_STREAK_EMOJI,
        unlockedMilestones: [],
        lockedMilestones: DEFAULT_STREAK_MILESTONES,
        allMilestones: DEFAULT_STREAK_MILESTONES,
        timeline: mockAscTimeline,
      })),
      updateSelectedEmoji: vi.fn(async ({ milestoneId, emojiChar, emojiCode }) => {
        if (!milestoneId && emojiChar === DEFAULT_STREAK_EMOJI.char && emojiCode === DEFAULT_STREAK_EMOJI.code) {
          return { success: true, message: 'Default streak emoji restored.' };
        }
        if (!milestoneId || milestoneId === 999) {
          throw new Error('Unauthorized: You have not yet unlocked this milestone emoji.');
        }
        return { success: true, message: 'Active streak emoji updated successfully.' };
      }),
    },
  };
});

import { GET as getHistoryRoute } from '@/app/api/student/attendance/streak/history/route';
import { POST as postSelectEmojiRoute } from '@/app/api/student/attendance/streak/select-emoji/route';

describe('Attendance Streak Milestones & Descending History Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentUser = { id: 1, student_id: 101, roll_no: '22KU01', role: 'student' };
  });

  describe('1. Nine Institutional Milestones Configuration & Unlock Thresholds', () => {
    const expectedTiers = [
      { threshold: 5, emoji: '❤️‍🔥', title: 'First Spark' },
      { threshold: 10, emoji: '⚡', title: 'Consistency' },
      { threshold: 20, emoji: '🏅', title: 'Dedicated' },
      { threshold: 30, emoji: '🚀', title: 'Rising Star' },
      { threshold: 50, emoji: '💎', title: 'Diamond Discipline' },
      { threshold: 75, emoji: '👑', title: 'Attendance Royalty' },
      { threshold: 100, emoji: '🏆', title: 'Champion' },
      { threshold: 150, emoji: '🌟', title: 'Legendary' },
      { threshold: 200, emoji: '🎓', title: 'Attendance Legend' },
    ];

    it('contains all 9 milestones with valid unique thresholds and codes', () => {
      expect(DEFAULT_STREAK_MILESTONES).toHaveLength(9);
      const validation = validateMilestonesConfig(DEFAULT_STREAK_MILESTONES);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);

      expectedTiers.forEach((tier, index) => {
        const m = DEFAULT_STREAK_MILESTONES[index];
        expect(m.required_streak).toBe(tier.threshold);
        expect(m.emoji_char).toBe(tier.emoji);
        expect(m.title).toBe(tier.title);
      });
    });

    it.each(expectedTiers)('unlocks "$title" at exact threshold $threshold and NOT at $threshold - 1', ({ threshold, title }) => {
      const below = evaluateMilestoneProgress(threshold - 1, DEFAULT_STREAK_MILESTONES);
      expect(below.unlockedMilestones.some(m => m.title === title)).toBe(false);

      const exact = evaluateMilestoneProgress(threshold, DEFAULT_STREAK_MILESTONES);
      expect(exact.unlockedMilestones.some(m => m.title === title)).toBe(true);
    });

    it('computes progress toward next milestone accurately (e.g. 2 / 5 classes)', () => {
      const progress = evaluateMilestoneProgress(2, DEFAULT_STREAK_MILESTONES);
      expect(progress.nextMilestone.title).toBe('First Spark');
      expect(progress.milestoneProgress).toEqual({
        current: 2,
        target: 5,
        remaining: 3,
        percentage: 40,
      });
    });
  });

  describe('2. Descending Chronological Order (Latest-First Attendance History)', () => {
    it('sortTimelineDescending orders newest date first and higher period first within the same date', () => {
      const sorted = sortTimelineDescending(mockAscTimeline);
      expect(sorted.map(i => ({ date: i.date, period: i.sessionNumber }))).toEqual([
        { date: '2026-10-28', period: 2 }, // First
        { date: '2026-10-28', period: 1 }, // Second
        { date: '2026-10-27', period: 4 }, // Third
        { date: '2026-10-27', period: 3 }, // Fourth
      ]);
    });

    it('uses deterministic stable sessionId DESC tie-breaker for equal date and period', () => {
      const ties = [
        { sessionId: 10, date: '2026-10-28', sessionNumber: 2 },
        { sessionId: 25, date: '2026-10-28', sessionNumber: 2 },
      ];
      const sorted = sortTimelineDescending(ties);
      expect(sorted.map(i => i.sessionId)).toEqual([25, 10]);
    });

    it('history API returns records in global descending order', async () => {
      const req = new Request('http://localhost:3000/api/student/attendance/streak/history');
      const res = await getHistoryRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.order).toBe('DESC');
      expect(json.timeline.map(i => `${i.date}_P${i.sessionNumber}`)).toEqual([
        '2026-10-28_P2',
        '2026-10-28_P1',
        '2026-10-27_P4',
        '2026-10-27_P3',
      ]);
    });

    it('server-side pagination preserves global descending order across pages', async () => {
      const reqPage1 = new Request('http://localhost:3000/api/student/attendance/streak/history?page=1&limit=2');
      const res1 = await getHistoryRoute(reqPage1);
      const json1 = await res1.json();

      expect(json1.pagination).toEqual({ page: 1, limit: 2, total: 4, totalPages: 2, hasMore: true });
      expect(json1.timeline.map(i => `${i.date}_P${i.sessionNumber}`)).toEqual([
        '2026-10-28_P2',
        '2026-10-28_P1',
      ]);

      const reqPage2 = new Request('http://localhost:3000/api/student/attendance/streak/history?page=2&limit=2');
      const res2 = await getHistoryRoute(reqPage2);
      const json2 = await res2.json();

      expect(json2.pagination).toEqual({ page: 2, limit: 2, total: 4, totalPages: 2, hasMore: false });
      expect(json2.timeline.map(i => `${i.date}_P${i.sessionNumber}`)).toEqual([
        '2026-10-27_P4',
        '2026-10-27_P3',
      ]);
    });

    it('filters by subject, status, and date range while preserving descending order', async () => {
      const reqSubj = new Request('http://localhost:3000/api/student/attendance/streak/history?subject_code=CS501');
      const jsonSubj = await (await getHistoryRoute(reqSubj)).json();
      expect(jsonSubj.timeline.map(i => `${i.date}_P${i.sessionNumber}`)).toEqual([
        '2026-10-28_P1',
        '2026-10-27_P3',
      ]);

      const reqDate = new Request('http://localhost:3000/api/student/attendance/streak/history?start_date=2026-10-28&end_date=2026-10-28');
      const jsonDate = await (await getHistoryRoute(reqDate)).json();
      expect(jsonDate.timeline.map(i => `${i.date}_P${i.sessionNumber}`)).toEqual([
        '2026-10-28_P2',
        '2026-10-28_P1',
      ]);

      const reqPresent = new Request('http://localhost:3000/api/student/attendance/streak/history?status=PRESENT');
      const jsonPresent = await (await getHistoryRoute(reqPresent)).json();
      expect(jsonPresent.timeline.map(i => `${i.date}_P${i.sessionNumber}`)).toEqual([
        '2026-10-28_P2',
        '2026-10-27_P4',
        '2026-10-27_P3',
      ]);
    });
  });

  describe('3. Emoji Selection Security Guards', () => {
    it('rejects selecting a locked custom emoji without a valid unlocked milestone_id', async () => {
      const req = new Request('http://localhost:3000/api/student/attendance/streak/select-emoji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emoji_char: '👑',
          emoji_code: 'attendance_royalty',
          milestone_id: null,
        }),
      });
      const res = await postSelectEmojiRoute(req);
      expect(res.status).toBe(400);
    });
  });
});
