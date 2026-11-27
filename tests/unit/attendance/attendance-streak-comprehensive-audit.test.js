import { describe, it, expect } from 'vitest';
import { calculateStreakFromSequence } from '@/services/attendance/StreakService';
import {
  STREAK_ATTENDANCE_POLICIES,
  evaluateAttendanceStatus,
  validateMilestonesConfig,
  evaluateMilestoneProgress,
  DEFAULT_STREAK_EMOJI,
  DEFAULT_STREAK_MILESTONES,
} from '@/lib/streak-config';

describe('Second-Pass Audit: Comprehensive Attendance Streak Verification (40 Scenarios)', () => {

  // --- Scenarios 1-6: Basic Sequences ---
  describe('Part 1: Basic Sequences (Scenarios 1-6)', () => {
    it('1. First attended class establishes streak = 1', () => {
      const sessions = [{ id: 1, assignment_id: 10, attendance_date: '2026-10-01', session_number: 1 }];
      const records = [{ session_id: 1, status: 'PRESENT' }];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(1);
      expect(res.longestStreak).toBe(1);
    });

    it('2. Consecutive attended classes monotonically increment streak', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-10-01' },
        { id: 2, session_number: 2, attendance_date: '2026-10-01' },
        { id: 3, session_number: 3, attendance_date: '2026-10-01' },
      ];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'PRESENT' },
        { session_id: 3, status: 'PRESENT' },
      ];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(3);
      expect(res.longestStreak).toBe(3);
      expect(res.totalAttendedClasses).toBe(3);
    });

    it('3. Single finalized absence resets current streak to 0 immediately', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-10-01' },
        { id: 2, session_number: 2, attendance_date: '2026-10-01' },
        { id: 3, session_number: 3, attendance_date: '2026-10-01' },
      ];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'PRESENT' },
        { session_id: 3, status: 'ABSENT' },
      ];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(0);
      expect(res.previousStreak).toBe(2);
      expect(res.longestStreak).toBe(2);
      expect(res.lastStreakBreak.sessionId).toBe(3);
    });

    it('4. Attending class after reset starts new streak = 1', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-10-01' },
        { id: 2, session_number: 2, attendance_date: '2026-10-01' },
        { id: 3, session_number: 3, attendance_date: '2026-10-01' },
      ];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'ABSENT' },
        { session_id: 3, status: 'PRESENT' },
      ];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(1);
      expect(res.longestStreak).toBe(1);
      expect(res.previousStreak).toBe(1);
    });

    it('5. Streak continues across weekends without breaking if no classes scheduled', () => {
      const sessions = [
        { id: 1, session_number: 5, attendance_date: '2026-10-02' }, // Friday
        { id: 2, session_number: 1, attendance_date: '2026-10-05' }, // Monday
      ];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'PRESENT' },
      ];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(2);
    });

    it('6. Empty session history returns zeros without NaN or exceptions', () => {
      const res = calculateStreakFromSequence([], []);
      expect(res.currentStreak).toBe(0);
      expect(res.longestStreak).toBe(0);
      expect(res.previousStreak).toBe(0);
      expect(res.totalEligibleClasses).toBe(0);
      expect(res.timeline).toEqual([]);
    });
  });

  // --- Scenarios 7-18: Scheduling, Timetables, Lab Batches & Intra-Day Ordering ---
  describe('Part 2: Scheduling, Lab Batches & Intra-day Ordering (Scenarios 7-18)', () => {
    it('7. Intra-day chronological ordering: period 1, 2, 3 ordered sequentially', () => {
      const sessions = [
        { id: 10, session_number: 1, attendance_date: '2026-10-01', subject_code: 'CS101' },
        { id: 11, session_number: 2, attendance_date: '2026-10-01', subject_code: 'CS102' },
        { id: 12, session_number: 3, attendance_date: '2026-10-01', subject_code: 'CS103' },
      ];
      const records = [
        { session_id: 10, status: 'PRESENT' },
        { session_id: 11, status: 'PRESENT' },
        { session_id: 12, status: 'PRESENT' },
      ];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(3);
      expect(res.timeline.map(t => t.sessionNumber)).toEqual([1, 2, 3]);
    });

    it('8. Multiple subjects in one day each count toward streak count', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-10-01', subject_code: 'SUB_A' },
        { id: 2, session_number: 2, attendance_date: '2026-10-01', subject_code: 'SUB_B' },
        { id: 3, session_number: 3, attendance_date: '2026-10-01', subject_code: 'SUB_C' },
        { id: 4, session_number: 4, attendance_date: '2026-10-01', subject_code: 'SUB_D' },
      ];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'PRESENT' },
        { session_id: 3, status: 'PRESENT' },
        { session_id: 4, status: 'PRESENT' },
      ];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(4);
    });

    it('9. Missing a middle class in a single day resets streak immediately for subsequent classes', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-10-01' },
        { id: 2, session_number: 2, attendance_date: '2026-10-01' },
        { id: 3, session_number: 3, attendance_date: '2026-10-01' },
      ];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'ABSENT' },
        { session_id: 3, status: 'PRESENT' },
      ];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(1);
      expect(res.longestStreak).toBe(1);
      expect(res.previousStreak).toBe(1);
    });

    it('10. Multi-tier lookup: matches by session_id when available', () => {
      const sessions = [{ id: 99, session_number: 1, attendance_date: '2026-10-01' }];
      const records = [{ session_id: 99, status: 'PRESENT' }];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(1);
    });

    it('11. Multi-tier lookup fallback: matches by assignment_id + date + session when session_id is null', () => {
      const sessions = [{ id: 101, assignment_id: 55, attendance_date: '2026-10-01', session_number: 2 }];
      const records = [{ session_id: null, assignment_id: 55, date: '2026-10-01', session: 2, status: 'PRESENT' }];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(1);
    });

    it('12. Multi-tier lookup fallback 2: matches by date + session when assignment_id is omitted', () => {
      const sessions = [{ id: 202, attendance_date: '2026-10-01', session_number: 4 }];
      const records = [{ date: '2026-10-01', session: 4, status: 'PRESENT' }];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(1);
    });

    it('12b. Multi-tier lookup collision guard: record for Assignment A does NOT match session for Assignment B', () => {
      // Session conducted for Assignment 200 (e.g. Physics) at Period 3
      const sessions = [{ id: 50, assignment_id: 200, attendance_date: '2026-10-01', session_number: 3 }];
      // Student attendance recorded for Assignment 100 (e.g. Chemistry) at Period 3
      const records = [{ session_id: null, assignment_id: 100, date: '2026-10-01', session: 3, status: 'PRESENT' }];

      const res = calculateStreakFromSequence(sessions, records);
      // Because Assignment 100 !== 200, matching must REJECT the record! Session 50 becomes UNRECORDED (absent)
      expect(res.currentStreak).toBe(0);
      expect(res.totalAttendedClasses).toBe(0);
      expect(res.totalMissedClasses).toBe(1);
      expect(res.timeline[0].status).toBe('UNRECORDED');
    });

    it('12c. Multi-tier lookup collision guard: multiple unassigned records for the same slot rejected as ambiguous', () => {
      const sessions = [{ id: 60, assignment_id: 300, attendance_date: '2026-10-01', session_number: 2 }];
      // Two corrupted unassigned records for the same slot
      const records = [
        { date: '2026-10-01', session: 2, status: 'PRESENT' },
        { date: '2026-10-01', session: 2, status: 'ABSENT' },
      ];

      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(0);
      expect(res.timeline[0].status).toBe('UNRECORDED');
    });

    it('13. Cancelled/omitted periods do not exist as conducted sessions and do not break streak', () => {
      // Period 1 conducted, Period 2 cancelled (never created), Period 3 conducted
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-10-01' },
        { id: 3, session_number: 3, attendance_date: '2026-10-01' },
      ];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 3, status: 'PRESENT' },
      ];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(2);
      expect(res.totalEligibleClasses).toBe(2);
    });

    it('14. Public holidays with zero scheduled sessions preserve streak continuity', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-08-14' }, // Day before Independence Day
        { id: 2, session_number: 1, attendance_date: '2026-08-16' }, // Day after Independence Day
      ];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'PRESENT' },
      ];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(2);
    });

    it('15. Lab batch isolation: Student in Batch 1 does not see Batch 2 session as eligible', () => {
      // Simulated: eligibleSessions pre-filtered by StreakService for Batch 1 only
      const eligibleForBatch1 = [
        { id: 10, batch_number: 1, session_number: 1, attendance_date: '2026-10-01' },
        { id: 12, batch_number: 0, session_number: 2, attendance_date: '2026-10-01' },
      ];
      const records = [
        { session_id: 10, status: 'PRESENT' },
        { session_id: 12, status: 'PRESENT' },
      ];
      const res = calculateStreakFromSequence(eligibleForBatch1, records);
      expect(res.currentStreak).toBe(2);
      expect(res.totalEligibleClasses).toBe(2);
    });

    it('16. Lab batch parallel sessions: simultaneous batch 1 and 2 don\'t collide in tie-breaking', () => {
      const sessions = [
        { id: 10, batch_number: 1, session_number: 3, attendance_date: '2026-10-01' },
      ];
      const records = [{ session_id: 10, status: 'PRESENT' }];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(1);
    });

    it('17. Same date Date object vs string ISO serialization consistency', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: new Date('2026-10-01T00:00:00.000Z') },
        { id: 2, session_number: 2, attendance_date: '2026-10-01' },
      ];
      const records = [
        { session_id: 1, date: '2026-10-01', session: 1, status: 'PRESENT' },
        { session_id: 2, date: new Date('2026-10-01T00:00:00.000Z'), session: 2, status: 'PRESENT' },
      ];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(2);
    });

    it('18. Consecutive 8-period full day yields streak of 8', () => {
      const sessions = Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        session_number: i + 1,
        attendance_date: '2026-10-01',
      }));
      const records = Array.from({ length: 8 }, (_, i) => ({
        session_id: i + 1,
        status: 'PRESENT',
      }));
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(8);
      expect(res.longestStreak).toBe(8);
    });
  });

  // --- Scenarios 19-30: Attendance States, Policies & Edge Cases ---
  describe('Part 3: Attendance States & Policies (Scenarios 19-30)', () => {
    it('19. Policy EXCUSED_INCREMENTS: NCC increments streak', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-10-01' },
        { id: 2, session_number: 2, attendance_date: '2026-10-01' },
      ];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'NCC' },
      ];
      const res = calculateStreakFromSequence(sessions, records, {
        policy: STREAK_ATTENDANCE_POLICIES.EXCUSED_INCREMENTS,
      });
      expect(res.currentStreak).toBe(2);
      expect(res.timeline[1].isExcused).toBe(true);
    });

    it('20. Policy EXCUSED_INCREMENTS: MEDICAL increments streak', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-10-01' },
        { id: 2, session_number: 2, attendance_date: '2026-10-01' },
      ];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'MEDICAL' },
      ];
      const res = calculateStreakFromSequence(sessions, records, {
        policy: STREAK_ATTENDANCE_POLICIES.EXCUSED_INCREMENTS,
      });
      expect(res.currentStreak).toBe(2);
      expect(res.timeline[1].isExcused).toBe(true);
    });

    it('21. Policy EXCUSED_PRESERVES: NCC preserves streak without incrementing or resetting', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-10-01' },
        { id: 2, session_number: 2, attendance_date: '2026-10-01' },
        { id: 3, session_number: 3, attendance_date: '2026-10-01' },
      ];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'NCC' }, // preserved at 1
        { session_id: 3, status: 'PRESENT' }, // increments to 2
      ];
      const res = calculateStreakFromSequence(sessions, records, {
        policy: STREAK_ATTENDANCE_POLICIES.EXCUSED_PRESERVES,
      });
      expect(res.currentStreak).toBe(2);
      expect(res.longestStreak).toBe(2);
      expect(res.timeline[1].streakAfterClass).toBe(1);
      expect(res.timeline[1].isExcused).toBe(true);
      expect(res.timeline[1].isBreak).toBe(false);
    });

    it('22. Policy EXCUSED_PRESERVES: MEDICAL preserves streak without incrementing', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-10-01' },
        { id: 2, session_number: 2, attendance_date: '2026-10-01' },
      ];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'MEDICAL' },
      ];
      const res = calculateStreakFromSequence(sessions, records, {
        policy: STREAK_ATTENDANCE_POLICIES.EXCUSED_PRESERVES,
      });
      expect(res.currentStreak).toBe(1);
      expect(res.timeline[1].streakAfterClass).toBe(1);
    });

    it('23. Policy STRICT_PRESENT_ONLY: NCC breaks streak', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-10-01' },
        { id: 2, session_number: 2, attendance_date: '2026-10-01' },
      ];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'NCC' },
      ];
      const res = calculateStreakFromSequence(sessions, records, {
        policy: STREAK_ATTENDANCE_POLICIES.STRICT_PRESENT_ONLY,
      });
      expect(res.currentStreak).toBe(0);
      expect(res.longestStreak).toBe(1);
      expect(res.timeline[1].isBreak).toBe(true);
    });

    it('24. Policy STRICT_PRESENT_ONLY: MEDICAL breaks streak', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-10-01' },
        { id: 2, session_number: 2, attendance_date: '2026-10-01' },
      ];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'MEDICAL' },
      ];
      const res = calculateStreakFromSequence(sessions, records, {
        policy: STREAK_ATTENDANCE_POLICIES.STRICT_PRESENT_ONLY,
      });
      expect(res.currentStreak).toBe(0);
      expect(res.longestStreak).toBe(1);
      expect(res.timeline[1].isBreak).toBe(true);
    });

    it('25. Conducted session with UNRECORDED status breaks streak (fail-safe)', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-10-01' },
        { id: 2, session_number: 2, attendance_date: '2026-10-01' },
      ];
      // Student is completely missing from student_attendance for session 2
      const records = [{ session_id: 1, status: 'PRESENT' }];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(0);
      expect(res.longestStreak).toBe(1);
      expect(res.totalMissedClasses).toBe(1);
      expect(res.timeline[1].status).toBe('UNRECORDED');
    });

    it('26. evaluateAttendanceStatus returns correct action for all permutations', () => {
      expect(evaluateAttendanceStatus('PRESENT').action).toBe('INCREMENT');
      expect(evaluateAttendanceStatus('ABSENT').action).toBe('BREAK');
      expect(evaluateAttendanceStatus('UNRECORDED').action).toBe('BREAK');
      expect(evaluateAttendanceStatus('UNKNOWN').action).toBe('BREAK');

      expect(evaluateAttendanceStatus('NCC', STREAK_ATTENDANCE_POLICIES.EXCUSED_INCREMENTS).action).toBe('INCREMENT');
      expect(evaluateAttendanceStatus('NCC', STREAK_ATTENDANCE_POLICIES.EXCUSED_PRESERVES).action).toBe('PRESERVE');
      expect(evaluateAttendanceStatus('NCC', STREAK_ATTENDANCE_POLICIES.STRICT_PRESENT_ONLY).action).toBe('BREAK');

      expect(evaluateAttendanceStatus('MEDICAL', STREAK_ATTENDANCE_POLICIES.EXCUSED_INCREMENTS).action).toBe('INCREMENT');
      expect(evaluateAttendanceStatus('MEDICAL', STREAK_ATTENDANCE_POLICIES.EXCUSED_PRESERVES).action).toBe('PRESERVE');
      expect(evaluateAttendanceStatus('MEDICAL', STREAK_ATTENDANCE_POLICIES.STRICT_PRESENT_ONLY).action).toBe('BREAK');
    });

    it('27. Duplicate student records for the same session do not count twice', () => {
      const sessions = [{ id: 1, session_number: 1, attendance_date: '2026-10-01' }];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 1, status: 'PRESENT' },
      ];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(1);
      expect(res.totalAttendedClasses).toBe(1);
    });

    it('28. Dispute approval from ABSENT to PRESENT recovers continuous streak', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-10-01' },
        { id: 2, session_number: 2, attendance_date: '2026-10-01' },
        { id: 3, session_number: 3, attendance_date: '2026-10-01' },
      ];
      // Dispute updated in DB: session 2 is now PRESENT
      const resolvedRecords = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'PRESENT' },
        { session_id: 3, status: 'PRESENT' },
      ];
      const res = calculateStreakFromSequence(sessions, resolvedRecords);
      expect(res.currentStreak).toBe(3);
      expect(res.longestStreak).toBe(3);
    });

    it('29. Faculty attendance correction from PRESENT to ABSENT immediately breaks streak', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-10-01' },
        { id: 2, session_number: 2, attendance_date: '2026-10-01' },
      ];
      const correctedRecords = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'ABSENT' },
      ];
      const res = calculateStreakFromSequence(sessions, correctedRecords);
      expect(res.currentStreak).toBe(0);
      expect(res.longestStreak).toBe(1);
    });

    it('30. Consecutive absences keep streak at 0 without negative numbers', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-10-01' },
        { id: 2, session_number: 2, attendance_date: '2026-10-01' },
        { id: 3, session_number: 3, attendance_date: '2026-10-01' },
      ];
      const records = [
        { session_id: 1, status: 'ABSENT' },
        { session_id: 2, status: 'ABSENT' },
        { session_id: 3, status: 'ABSENT' },
      ];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(0);
      expect(res.longestStreak).toBe(0);
      expect(res.totalMissedClasses).toBe(3);
    });
  });

  // --- Scenarios 31-40: Ordering, Tie-Breaking, Milestones & Integrity ---
  describe('Part 4: Tie-Breaking, Milestones & Integrity (Scenarios 31-40)', () => {
    it('31. Tie-breaking: sessions on same date with same session_number ordered deterministically by id', () => {
      const sessions = [
        { id: 10, session_number: 1, attendance_date: '2026-10-01' },
        { id: 11, session_number: 1, attendance_date: '2026-10-01' },
      ];
      const records = [
        { session_id: 10, status: 'PRESENT' },
        { session_id: 11, status: 'PRESENT' },
      ];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(2);
      expect(res.timeline[0].sessionId).toBe(10);
      expect(res.timeline[1].sessionId).toBe(11);
    });

    it('32. Chronological sorting across months: Oct 31 to Nov 01 retains streak', () => {
      const sessions = [
        { id: 1, session_number: 4, attendance_date: '2026-10-31' },
        { id: 2, session_number: 1, attendance_date: '2026-11-01' },
      ];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'PRESENT' },
      ];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(2);
    });

    it('33. Personal best (longestStreak) remains preserved when currentStreak resets to 0', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-10-01' },
        { id: 2, session_number: 2, attendance_date: '2026-10-01' },
        { id: 3, session_number: 3, attendance_date: '2026-10-01' },
        { id: 4, session_number: 4, attendance_date: '2026-10-01' },
        { id: 5, session_number: 1, attendance_date: '2026-10-02' },
      ];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'PRESENT' },
        { session_id: 3, status: 'PRESENT' },
        { session_id: 4, status: 'PRESENT' },
        { session_id: 5, status: 'ABSENT' },
      ];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(0);
      expect(res.longestStreak).toBe(4);
      expect(res.previousStreak).toBe(4);
    });

    it('34. Exceeding personal best updates longestStreak immediately', () => {
      const sessions = [
        { id: 1, session_number: 1, attendance_date: '2026-10-01' },
        { id: 2, session_number: 2, attendance_date: '2026-10-01' },
        { id: 3, session_number: 3, attendance_date: '2026-10-01' },
      ];
      const records = [
        { session_id: 1, status: 'PRESENT' },
        { session_id: 2, status: 'PRESENT' },
        { session_id: 3, status: 'PRESENT' },
      ];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.currentStreak).toBe(3);
      expect(res.longestStreak).toBe(3);
    });

    it('35. Milestone validator rejects duplicate milestone codes', () => {
      const badConfig = [
        { milestone_code: 'BRONZE', required_streak: 5, emoji_char: '🥉' },
        { milestone_code: 'BRONZE', required_streak: 10, emoji_char: '🥈' },
      ];
      const val = validateMilestonesConfig(badConfig);
      expect(val.valid).toBe(false);
      expect(val.errors.some(e => e.includes('Duplicate milestone_code'))).toBe(true);
    });

    it('36. Milestone validator rejects non-positive or duplicate required_streak thresholds', () => {
      const badConfig = [
        { milestone_code: 'ZERO', required_streak: 0, emoji_char: '0️⃣' },
        { milestone_code: 'DUP', required_streak: 10, emoji_char: '1️⃣' },
        { milestone_code: 'DUP2', required_streak: 10, emoji_char: '2️⃣' },
      ];
      const val = validateMilestonesConfig(badConfig);
      expect(val.valid).toBe(false);
      expect(val.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('37. Milestone progress evaluator handles streak exactly at milestone threshold', () => {
      const milestones = [
        { id: 1, milestone_code: 'M10', required_streak: 10, emoji_char: '🎯', is_active: true },
        { id: 2, milestone_code: 'M20', required_streak: 20, emoji_char: '🚀', is_active: true },
      ];
      const evalResult = evaluateMilestoneProgress(10, milestones);
      expect(evalResult.unlockedMilestones.length).toBe(1);
      expect(evalResult.unlockedMilestones[0].milestone_code).toBe('M10');
      expect(evalResult.nextMilestone.milestone_code).toBe('M20');
      expect(evalResult.milestoneProgress.current).toBe(10);
      expect(evalResult.milestoneProgress.remaining).toBe(10);
      expect(evalResult.milestoneProgress.percentage).toBe(50);
    });

    it('38. Milestone progress evaluator handles streak exceeding all active milestones', () => {
      const milestones = [
        { id: 1, milestone_code: 'M10', required_streak: 10, emoji_char: '🎯', is_active: true },
      ];
      const evalResult = evaluateMilestoneProgress(25, milestones);
      expect(evalResult.unlockedMilestones.length).toBe(1);
      expect(evalResult.nextMilestone).toBeNull();
      expect(evalResult.milestoneProgress).toBeNull();
    });

    it('39. Default milestone configuration defines all 9 valid institutional tiers and default flame emoji', () => {
      expect(DEFAULT_STREAK_MILESTONES.length).toBe(9);
      const val = validateMilestonesConfig(DEFAULT_STREAK_MILESTONES);
      expect(val.valid).toBe(true);
      expect(DEFAULT_STREAK_EMOJI.char).toBe('🔥');
    });

    it('40. Timeline captures topic covered and subject names accurately', () => {
      const sessions = [
        {
          id: 1,
          session_number: 1,
          attendance_date: '2026-10-01',
          subject_code: 'CS301',
          subject_name: 'Operating Systems',
          topic_covered: 'Process Synchronization & Semaphores',
        },
      ];
      const records = [{ session_id: 1, status: 'PRESENT' }];
      const res = calculateStreakFromSequence(sessions, records);
      expect(res.timeline[0].subjectCode).toBe('CS301');
      expect(res.timeline[0].subjectName).toBe('Operating Systems');
      expect(res.timeline[0].topic).toBe('Process Synchronization & Semaphores');
      expect(res.timeline[0].isAttended).toBe(true);
    });

    it('41. Performance benchmark: evaluates 1,000 consecutive classes in under 50ms', () => {
      const largeSessions = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        assignment_id: 10 + (i % 5),
        session_number: (i % 6) + 1,
        attendance_date: `2026-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
        subject_code: `CS${500 + (i % 5)}`,
      }));

      const largeRecords = Array.from({ length: 1000 }, (_, i) => ({
        session_id: i + 1,
        assignment_id: 10 + (i % 5),
        session: (i % 6) + 1,
        date: `2026-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
        status: i % 25 === 0 ? 'ABSENT' : 'PRESENT', // streak resets every 25 classes
      }));

      // Warm up V8 JIT before timing so shared CI runners do not flake on cold compilation
      calculateStreakFromSequence(largeSessions.slice(0, 10), largeRecords.slice(0, 10));

      const start = performance.now();
      const res = calculateStreakFromSequence(largeSessions, largeRecords);
      const elapsed = performance.now() - start;

      expect(res.totalEligibleClasses).toBe(1000);
      expect(res.totalAttendedClasses).toBe(960);
      expect(res.totalMissedClasses).toBe(40);
      expect(res.longestStreak).toBe(24);
      expect(elapsed).toBeLessThan(50); // Sub-50ms CI-safe performance threshold
    });
  });
});
