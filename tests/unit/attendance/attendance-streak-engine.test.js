import { describe, it, expect } from 'vitest';
import { calculateStreakFromSequence } from '@/services/attendance/StreakService';

describe('Attendance Streak Engine (calculateStreakFromSequence)', () => {
  it('1. First attended class gives streak 1', () => {
    const sessions = [
      { id: 1, assignment_id: 10, attendance_date: '2026-10-01', session_number: 1, subject_code: 'CS501', subject_name: 'OS' },
    ];
    const records = [
      { session_id: 1, date: '2026-10-01', session: 1, status: 'PRESENT' },
    ];

    const result = calculateStreakFromSequence(sessions, records);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.totalAttendedClasses).toBe(1);
    expect(result.totalMissedClasses).toBe(0);
  });

  it('2. Four consecutive attended classes give streak 4', () => {
    const sessions = [
      { id: 1, assignment_id: 10, attendance_date: '2026-10-01', session_number: 1 },
      { id: 2, assignment_id: 10, attendance_date: '2026-10-01', session_number: 2 },
      { id: 3, assignment_id: 20, attendance_date: '2026-10-01', session_number: 3 },
      { id: 4, assignment_id: 20, attendance_date: '2026-10-01', session_number: 4 },
    ];
    const records = [
      { session_id: 1, date: '2026-10-01', session: 1, status: 'PRESENT' },
      { session_id: 2, date: '2026-10-01', session: 2, status: 'PRESENT' },
      { session_id: 3, date: '2026-10-01', session: 3, status: 'PRESENT' },
      { session_id: 4, date: '2026-10-01', session: 4, status: 'PRESENT' },
    ];

    const result = calculateStreakFromSequence(sessions, records);
    expect(result.currentStreak).toBe(4);
    expect(result.longestStreak).toBe(4);
    expect(result.totalAttendedClasses).toBe(4);
  });

  it('3. One finalized absence resets the current streak to zero', () => {
    const sessions = [
      { id: 1, assignment_id: 10, attendance_date: '2026-10-01', session_number: 1 },
      { id: 2, assignment_id: 10, attendance_date: '2026-10-01', session_number: 2 },
      { id: 3, assignment_id: 10, attendance_date: '2026-10-01', session_number: 3 },
      { id: 4, assignment_id: 10, attendance_date: '2026-10-01', session_number: 4 },
      { id: 5, assignment_id: 20, attendance_date: '2026-10-02', session_number: 1 },
    ];
    const records = [
      { session_id: 1, date: '2026-10-01', session: 1, status: 'PRESENT' },
      { session_id: 2, date: '2026-10-01', session: 2, status: 'PRESENT' },
      { session_id: 3, date: '2026-10-01', session: 3, status: 'PRESENT' },
      { session_id: 4, date: '2026-10-01', session: 4, status: 'PRESENT' },
      { session_id: 5, date: '2026-10-02', session: 1, status: 'ABSENT' },
    ];

    const result = calculateStreakFromSequence(sessions, records);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(4);
    expect(result.previousStreak).toBe(4);
    expect(result.totalMissedClasses).toBe(1);
    expect(result.lastStreakBreak).not.toBeNull();
    expect(result.lastStreakBreak.sessionId).toBe(5);
  });

  it('4. Attendance after a reset starts a new streak', () => {
    const sessions = [
      { id: 1, assignment_id: 10, attendance_date: '2026-10-01', session_number: 1 },
      { id: 2, assignment_id: 10, attendance_date: '2026-10-01', session_number: 2 },
      { id: 3, assignment_id: 20, attendance_date: '2026-10-02', session_number: 1 },
      { id: 4, assignment_id: 20, attendance_date: '2026-10-02', session_number: 2 },
      { id: 5, assignment_id: 30, attendance_date: '2026-10-02', session_number: 3 },
    ];
    const records = [
      { session_id: 1, date: '2026-10-01', session: 1, status: 'PRESENT' },
      { session_id: 2, date: '2026-10-01', session: 2, status: 'PRESENT' },
      { session_id: 3, date: '2026-10-02', session: 1, status: 'ABSENT' },
      { session_id: 4, date: '2026-10-02', session: 2, status: 'PRESENT' },
      { session_id: 5, date: '2026-10-02', session: 3, status: 'PRESENT' },
    ];

    const result = calculateStreakFromSequence(sessions, records);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
    expect(result.previousStreak).toBe(2);
  });

  it('5. Multiple classes on the same day count separately (intra-day ordering)', () => {
    const sessions = [
      { id: 1, assignment_id: 10, attendance_date: '2026-10-05', session_number: 1 },
      { id: 2, assignment_id: 20, attendance_date: '2026-10-05', session_number: 2 },
      { id: 3, assignment_id: 30, attendance_date: '2026-10-05', session_number: 3 },
    ];
    const records = [
      { session_id: 1, date: '2026-10-05', session: 1, status: 'PRESENT' },
      { session_id: 2, date: '2026-10-05', session: 2, status: 'PRESENT' },
      { session_id: 3, date: '2026-10-05', session: 3, status: 'PRESENT' },
    ];

    const result = calculateStreakFromSequence(sessions, records);
    expect(result.currentStreak).toBe(3);
    expect(result.totalAttendedClasses).toBe(3);
  });

  it('6. Classes on different days remain consecutive if no eligible class is missed', () => {
    const sessions = [
      { id: 1, assignment_id: 10, attendance_date: '2026-10-01', session_number: 5 },
      { id: 2, assignment_id: 10, attendance_date: '2026-10-05', session_number: 1 }, // weekend gap
    ];
    const records = [
      { session_id: 1, date: '2026-10-01', session: 5, status: 'PRESENT' },
      { session_id: 2, date: '2026-10-05', session: 1, status: 'PRESENT' },
    ];

    const result = calculateStreakFromSequence(sessions, records);
    expect(result.currentStreak).toBe(2);
  });

  it('7. Cancelled classes or non-conducted classes do not break the streak', () => {
    // Only conducted sessions are present in eligibleSessions
    const sessions = [
      { id: 1, assignment_id: 10, attendance_date: '2026-10-01', session_number: 1 },
      // Period 2 cancelled (no attendance session created)
      { id: 3, assignment_id: 20, attendance_date: '2026-10-01', session_number: 3 },
    ];
    const records = [
      { session_id: 1, date: '2026-10-01', session: 1, status: 'PRESENT' },
      { session_id: 3, date: '2026-10-01', session: 3, status: 'PRESENT' },
    ];

    const result = calculateStreakFromSequence(sessions, records);
    expect(result.currentStreak).toBe(2);
  });

  it('8. Holidays do not break the streak', () => {
    // No attendance sessions scheduled on holiday date
    const sessions = [
      { id: 1, assignment_id: 10, attendance_date: '2026-10-01', session_number: 4 },
      // 2026-10-02 is Gandhi Jayanti (Holiday)
      { id: 2, assignment_id: 10, attendance_date: '2026-10-03', session_number: 1 },
    ];
    const records = [
      { session_id: 1, date: '2026-10-01', session: 4, status: 'PRESENT' },
      { session_id: 2, date: '2026-10-03', session: 1, status: 'PRESENT' },
    ];

    const result = calculateStreakFromSequence(sessions, records);
    expect(result.currentStreak).toBe(2);
  });

  it('9. Excused absences (NCC, MEDICAL) are evaluated as attended', () => {
    const sessions = [
      { id: 1, assignment_id: 10, attendance_date: '2026-10-01', session_number: 1 },
      { id: 2, assignment_id: 10, attendance_date: '2026-10-01', session_number: 2 },
      { id: 3, assignment_id: 10, attendance_date: '2026-10-01', session_number: 3 },
    ];
    const records = [
      { session_id: 1, date: '2026-10-01', session: 1, status: 'PRESENT' },
      { session_id: 2, date: '2026-10-01', session: 2, status: 'NCC' },
      { session_id: 3, date: '2026-10-01', session: 3, status: 'MEDICAL' },
    ];

    const result = calculateStreakFromSequence(sessions, records);
    expect(result.currentStreak).toBe(3);
    expect(result.totalAttendedClasses).toBe(3);
  });

  it('10. Duplicate attendance records for the same session do not inflate count', () => {
    const sessions = [
      { id: 1, assignment_id: 10, attendance_date: '2026-10-01', session_number: 1 },
    ];
    // Record lookup by (date, session) maps to one entry
    const records = [
      { session_id: 1, date: '2026-10-01', session: 1, status: 'PRESENT' },
      { session_id: 1, date: '2026-10-01', session: 1, status: 'PRESENT' },
    ];

    const result = calculateStreakFromSequence(sessions, records);
    expect(result.currentStreak).toBe(1);
    expect(result.totalAttendedClasses).toBe(1);
  });

  it('11. Correcting absent to present recalculates history accurately', () => {
    const sessions = [
      { id: 1, assignment_id: 10, attendance_date: '2026-10-01', session_number: 1 },
      { id: 2, assignment_id: 10, attendance_date: '2026-10-01', session_number: 2 },
      { id: 3, assignment_id: 10, attendance_date: '2026-10-01', session_number: 3 },
    ];
    // Before dispute approval: Session 2 was ABSENT -> streak was 1
    const beforeRecords = [
      { session_id: 1, date: '2026-10-01', session: 1, status: 'PRESENT' },
      { session_id: 2, date: '2026-10-01', session: 2, status: 'ABSENT' },
      { session_id: 3, date: '2026-10-01', session: 3, status: 'PRESENT' },
    ];
    expect(calculateStreakFromSequence(sessions, beforeRecords).currentStreak).toBe(1);

    // After dispute approval: Session 2 updated to PRESENT -> streak is now 3
    const afterRecords = [
      { session_id: 1, date: '2026-10-01', session: 1, status: 'PRESENT' },
      { session_id: 2, date: '2026-10-01', session: 2, status: 'PRESENT' },
      { session_id: 3, date: '2026-10-01', session: 3, status: 'PRESENT' },
    ];
    const afterResult = calculateStreakFromSequence(sessions, afterRecords);
    expect(afterResult.currentStreak).toBe(3);
    expect(afterResult.longestStreak).toBe(3);
  });

  it('12. Correcting present to absent recalculates history accurately', () => {
    const sessions = [
      { id: 1, assignment_id: 10, attendance_date: '2026-10-01', session_number: 1 },
      { id: 2, assignment_id: 10, attendance_date: '2026-10-01', session_number: 2 },
    ];
    const correctedRecords = [
      { session_id: 1, date: '2026-10-01', session: 1, status: 'PRESENT' },
      { session_id: 2, date: '2026-10-01', session: 2, status: 'ABSENT' },
    ];

    const result = calculateStreakFromSequence(sessions, correctedRecords);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(1);
  });

  it('13. Retroactively entered attendance updates the chronological sequence correctly', () => {
    // Sessions ordered by attendance_date and session_number, not submitted_at
    const sessions = [
      { id: 1, assignment_id: 10, attendance_date: '2026-10-01', session_number: 1 },
      { id: 3, assignment_id: 10, attendance_date: '2026-10-01', session_number: 2 }, // entered 3 days later
      { id: 2, assignment_id: 10, attendance_date: '2026-10-02', session_number: 1 },
    ];
    const records = [
      { session_id: 1, date: '2026-10-01', session: 1, status: 'PRESENT' },
      { session_id: 3, date: '2026-10-01', session: 2, status: 'PRESENT' },
      { session_id: 2, date: '2026-10-02', session: 1, status: 'PRESENT' },
    ];

    const result = calculateStreakFromSequence(sessions, records);
    expect(result.currentStreak).toBe(3);
    expect(result.timeline[1].sessionNumber).toBe(2);
  });

  it('14. Personal best (longestStreak) remains accurate after a reset to 0', () => {
    const sessions = [
      { id: 1, assignment_id: 10, attendance_date: '2026-10-01', session_number: 1 },
      { id: 2, assignment_id: 10, attendance_date: '2026-10-01', session_number: 2 },
      { id: 3, assignment_id: 10, attendance_date: '2026-10-01', session_number: 3 },
      { id: 4, assignment_id: 10, attendance_date: '2026-10-01', session_number: 4 },
      { id: 5, assignment_id: 10, attendance_date: '2026-10-01', session_number: 5 },
      { id: 6, assignment_id: 10, attendance_date: '2026-10-02', session_number: 1 },
    ];
    const records = [
      { session_id: 1, date: '2026-10-01', session: 1, status: 'PRESENT' },
      { session_id: 2, date: '2026-10-01', session: 2, status: 'PRESENT' },
      { session_id: 3, date: '2026-10-01', session: 3, status: 'PRESENT' },
      { session_id: 4, date: '2026-10-01', session: 4, status: 'PRESENT' },
      { session_id: 5, date: '2026-10-01', session: 5, status: 'PRESENT' },
      { session_id: 6, date: '2026-10-02', session: 1, status: 'ABSENT' },
    ];

    const result = calculateStreakFromSequence(sessions, records);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(5);
    expect(result.previousStreak).toBe(5);
  });

  it('15. Conducted session with unrecorded student status is treated as absent', () => {
    const sessions = [
      { id: 1, assignment_id: 10, attendance_date: '2026-10-01', session_number: 1 },
      { id: 2, assignment_id: 10, attendance_date: '2026-10-01', session_number: 2 },
    ];
    // Student only has record for Session 1, no record for Session 2
    const records = [
      { session_id: 1, date: '2026-10-01', session: 1, status: 'PRESENT' },
    ];

    const result = calculateStreakFromSequence(sessions, records);
    expect(result.currentStreak).toBe(0); // broken by unrecorded Session 2
    expect(result.longestStreak).toBe(1);
    expect(result.totalMissedClasses).toBe(1);
    expect(result.timeline[1].status).toBe('UNRECORDED');
  });

  it('16. Empty session list produces safe zero metrics', () => {
    const result = calculateStreakFromSequence([], []);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.totalEligibleClasses).toBe(0);
    expect(result.timeline).toEqual([]);
  });
});
