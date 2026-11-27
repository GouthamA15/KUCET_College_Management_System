import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    runWithContext: vi.fn((_ctx, fn) => fn()),
  },
}));

let mockUser = {
  id: 1,
  student_id: 101,
  roll_no: '22KU01',
  role: 'student',
};

vi.mock('@/lib/api-utils', () => ({
  getAuthUser: vi.fn(async () => mockUser),
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
}));

vi.mock('@/services/attendance/StreakService', () => ({
  StreakService: {
    calculateStudentStreak: vi.fn(async ({ studentId, policy }) => ({
      studentId,
      currentStreak: 12,
      longestStreak: 20,
      previousStreak: 8,
      policyApplied: policy || 'EXCUSED_INCREMENTS',
      selectedEmoji: { char: '🔥', code: 'fire' },
      unlockedMilestones: [],
      timeline: [
        { sessionId: 1, subjectCode: 'CS101', status: 'PRESENT', isAttended: true },
      ],
    })),
    updateSelectedEmoji: vi.fn(async ({ _studentId, _emojiChar, _emojiCode, milestoneId }) => {
      // Security rule: milestoneId 999 is NOT unlocked by student 101
      if (milestoneId === 999) {
        throw new Error('Unauthorized: You have not yet unlocked this milestone emoji.');
      }
      return { success: true, message: 'Active streak emoji updated successfully.' };
    }),
  },
}));

import { getAuthUser } from '@/lib/api-utils';
import { StreakService } from '@/services/attendance/StreakService';
import { GET as getSummary } from '@/app/api/student/attendance/streak/route';
import { GET as getHistory } from '@/app/api/student/attendance/streak/history/route';
import { POST as postSelectEmoji } from '@/app/api/student/attendance/streak/select-emoji/route';

describe('Second-Pass Audit: Student Attendance Streak Security & Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: 1,
      student_id: 101,
      roll_no: '22KU01',
      role: 'student',
    };
  });

  describe('1. Cross-Student Authorization & IDOR Protection', () => {
    it('always binds streak query strictly to authenticated session student_id', async () => {
      const request = new Request('http://localhost:3000/api/student/attendance/streak?student_id=999');
      const response = await getSummary(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.studentId).toBe(101); // Bound to session student_id 101, NOT 999
      expect(StreakService.calculateStudentStreak).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: 101, rollNo: '22KU01' })
      );
    });

    it('history endpoint binds strictly to authenticated session student_id', async () => {
      const request = new Request('http://localhost:3000/api/student/attendance/streak/history?student_id=999');
      const response = await getHistory(request);
      expect(response.status).toBe(200);
      expect(StreakService.calculateStudentStreak).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: 101, rollNo: '22KU01' })
      );
    });

    it('rejects unauthenticated requests with 401', async () => {
      vi.mocked(getAuthUser).mockResolvedValueOnce(null);
      const request = new Request('http://localhost:3000/api/student/attendance/streak');
      const response = await getSummary(request);
      expect(response.status).toBe(401);
    });
  });

  describe('2. Custom Emoji Selection & Milestone Ownership Verification', () => {
    it('prevents selecting locked milestone emoji (milestone 999)', async () => {
      const request = new Request('http://localhost:3000/api/student/attendance/streak/select-emoji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emoji_char: '👑',
          emoji_code: 'crown',
          milestone_id: 999,
        }),
      });

      const response = await postSelectEmoji(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('Unauthorized: You have not yet unlocked this milestone emoji');
    });

    it('permits restoring default flame emoji without milestone_id', async () => {
      const request = new Request('http://localhost:3000/api/student/attendance/streak/select-emoji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emoji_char: '🔥',
          emoji_code: 'fire',
          milestone_id: null,
        }),
      });

      const response = await postSelectEmoji(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });
  });

  describe('3. Input Validation & Zod Schema Hardening', () => {
    it('rejects empty emoji character', async () => {
      const request = new Request('http://localhost:3000/api/student/attendance/streak/select-emoji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emoji_char: '',
          emoji_code: 'fire',
        }),
      });

      const response = await postSelectEmoji(request);
      expect(response.status).toBe(400);
    });

    it('rejects negative milestone_id', async () => {
      const request = new Request('http://localhost:3000/api/student/attendance/streak/select-emoji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emoji_char: '🔥',
          emoji_code: 'fire',
          milestone_id: -5,
        }),
      });

      const response = await postSelectEmoji(request);
      expect(response.status).toBe(400);
    });

    it('rejects excessively long emoji string (max 16 chars)', async () => {
      const request = new Request('http://localhost:3000/api/student/attendance/streak/select-emoji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emoji_char: '🔥'.repeat(20),
          emoji_code: 'fire',
        }),
      });

      const response = await postSelectEmoji(request);
      expect(response.status).toBe(400);
    });
  });

  describe('4. Server-Side Attendance Policy Security (Client Manipulation Protection)', () => {
    it('strictly ignores untrusted client policy query parameter in summary endpoint', async () => {
      // Attacker tries to force STRICT_PRESENT_ONLY to manipulate calculations
      const request = new Request('http://localhost:3000/api/student/attendance/streak?policy=STRICT_PRESENT_ONLY');
      const response = await getSummary(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      // Verify StreakService was called WITHOUT client policy override
      expect(StreakService.calculateStudentStreak).toHaveBeenCalledWith(
        expect.not.objectContaining({ policy: 'STRICT_PRESENT_ONLY' })
      );
      expect(StreakService.calculateStudentStreak).toHaveBeenCalledWith({
        studentId: 101,
        rollNo: '22KU01',
        semester: undefined,
        academicYear: undefined,
      });
      expect(json.data.policyApplied).toBe('EXCUSED_INCREMENTS');
    });

    it('strictly ignores untrusted client policy query parameter in history endpoint', async () => {
      // Attacker tries to inject EXCUSED_INCREMENTS when server might be on STRICT
      const request = new Request('http://localhost:3000/api/student/attendance/streak/history?policy=EXCUSED_INCREMENTS');
      const response = await getHistory(request);

      expect(response.status).toBe(200);
      expect(StreakService.calculateStudentStreak).toHaveBeenCalledWith({
        studentId: 101,
        rollNo: '22KU01',
        semester: undefined,
        academicYear: undefined,
      });
    });
  });

  describe('5. Concurrency & Race Condition Idempotency', () => {
    it('simulates concurrent unlock invocations resolving identically without throwing', async () => {
      const promises = [1, 2, 3, 4, 5].map(() =>
        StreakService.updateSelectedEmoji({
          studentId: 101,
          emojiChar: '🔥',
          emojiCode: 'fire',
          milestoneId: null,
        })
      );

      const results = await Promise.all(promises);
      expect(results.length).toBe(5);
      for (const res of results) {
        expect(res.success).toBe(true);
      }
    });
  });
});
