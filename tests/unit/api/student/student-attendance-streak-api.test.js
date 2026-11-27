import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getStreakSummary } from '@/app/api/student/attendance/streak/route';
import { GET as getStreakHistory } from '@/app/api/student/attendance/streak/history/route';
import { POST as selectEmoji } from '@/app/api/student/attendance/streak/select-emoji/route';
import { getAuthUser } from '@/lib/api-utils';
import { StreakService } from '@/services/attendance/StreakService';

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: vi.fn(),
  };
});

vi.mock('@/services/attendance/StreakService', () => ({
  StreakService: {
    calculateStudentStreak: vi.fn(),
    updateSelectedEmoji: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    runWithContext: vi.fn((_ctx, fn) => fn()),
  },
}));

describe('Student Attendance Streak APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/student/attendance/streak (Summary)', () => {
    it('1. Rejects unauthenticated requests with 401', async () => {
      getAuthUser.mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/student/attendance/streak');
      const res = await getStreakSummary(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('2. Authenticated student receives streak metrics and excludes full timeline', async () => {
      getAuthUser.mockResolvedValue({
        student_id: 101,
        roll_no: '567T0101',
        role: 'student',
      });

      StreakService.calculateStudentStreak.mockResolvedValue({
        currentStreak: 8,
        longestStreak: 12,
        previousStreak: 4,
        totalEligibleClasses: 20,
        totalAttendedClasses: 18,
        totalMissedClasses: 2,
        selectedEmoji: { char: '🔥', code: 'fire' },
        timeline: [{ date: '2026-10-01' }], // full timeline
      });

      const req = new Request('http://localhost:3000/api/student/attendance/streak');
      const res = await getStreakSummary(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.currentStreak).toBe(8);
      expect(json.data.longestStreak).toBe(12);
      expect(json.data.timeline).toBeUndefined(); // stripped from summary
    });
  });

  describe('GET /api/student/attendance/streak/history (Class Timeline)', () => {
    it('3. Rejects unauthenticated requests with 401', async () => {
      getAuthUser.mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/student/attendance/streak/history');
      const res = await getStreakHistory(req);
      expect(res.status).toBe(401);
    });

    it('4. Filters chronological timeline by subject code when query param is present', async () => {
      getAuthUser.mockResolvedValue({
        student_id: 101,
        roll_no: '567T0101',
        role: 'student',
      });

      StreakService.calculateStudentStreak.mockResolvedValue({
        currentStreak: 5,
        longestStreak: 5,
        timeline: [
          { sessionId: 1, subjectCode: 'CS501', isAttended: true },
          { sessionId: 2, subjectCode: 'CS502', isAttended: true },
          { sessionId: 3, subjectCode: 'CS501', isAttended: true },
        ],
      });

      const req = new Request('http://localhost:3000/api/student/attendance/streak/history?subject_code=CS501');
      const res = await getStreakHistory(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.timeline).toHaveLength(2);
      expect(json.timeline.every(t => t.subjectCode === 'CS501')).toBe(true);
    });
  });

  describe('POST /api/student/attendance/streak/select-emoji (Emoji Preference)', () => {
    it('5. Rejects request when user attempts to select locked milestone', async () => {
      getAuthUser.mockResolvedValue({
        student_id: 101,
        roll_no: '567T0101',
        role: 'student',
      });

      StreakService.updateSelectedEmoji.mockRejectedValue(
        new Error('Unauthorized: You have not yet unlocked this milestone emoji.')
      );

      const req = new Request('http://localhost:3000/api/student/attendance/streak/select-emoji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emoji_char: '👑',
          emoji_code: 'crown',
          milestone_id: 99,
        }),
      });

      const res = await selectEmoji(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain('Unauthorized: You have not yet unlocked this milestone emoji.');
    });

    it('6. Accepts default flame emoji selection', async () => {
      getAuthUser.mockResolvedValue({
        student_id: 101,
        roll_no: '567T0101',
        role: 'student',
      });

      StreakService.updateSelectedEmoji.mockResolvedValue({
        success: true,
        message: 'Default streak emoji restored.',
      });

      const req = new Request('http://localhost:3000/api/student/attendance/streak/select-emoji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emoji_char: '🔥',
          emoji_code: 'fire',
        }),
      });

      const res = await selectEmoji(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe('Default streak emoji restored.');
    });
  });
});
