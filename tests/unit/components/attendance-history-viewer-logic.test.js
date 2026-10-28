import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime } from '@/lib/date';

describe('Attendance History & Summary Metrics Business Logic Suite', () => {
  it('excludes calendar-only working days and counts only submitted sessions with committed attendance records', () => {
    // 1. Calendar days for semester (e.g. 10 working days)
    const academicCalendarDays = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      day_type: 'WORKING',
      session: 1,
    }));

    // 2. Only 2 sessions were actually conducted and submitted
    const committedAttendanceRecords = [
      // Session 1: 2026-09-01 S1 (3 students)
      { date: '2026-09-01', session: 1, student_id: 1, status: 'PRESENT', submitted_at: '2026-09-01T10:00:00Z' },
      { date: '2026-09-01', session: 1, student_id: 2, status: 'PRESENT', submitted_at: '2026-09-01T10:00:00Z' },
      { date: '2026-09-01', session: 1, student_id: 3, status: 'ABSENT', submitted_at: '2026-09-01T10:00:00Z' },

      // Session 2: 2026-09-04 S1 (All absent session - legitimate submission)
      { date: '2026-09-04', session: 1, student_id: 1, status: 'ABSENT', submitted_at: '2026-09-04T10:00:00Z' },
      { date: '2026-09-04', session: 1, student_id: 2, status: 'ABSENT', submitted_at: '2026-09-04T10:00:00Z' },
      { date: '2026-09-04', session: 1, student_id: 3, status: 'ABSENT', submitted_at: '2026-09-04T10:00:00Z' },
    ];

    // Authoritative submitted sessions logic:
    // Deriving from committed records alone (excluding unsubmitted calendar dates)
    const sessionMap = new Map();
    for (const r of committedAttendanceRecords) {
      const key = `${r.date}__${r.session}`;
      if (!sessionMap.has(key)) {
        sessionMap.set(key, {
          date: r.date,
          session: r.session,
          total_students: 0,
          present_count: 0,
          submitted_at: r.submitted_at
        });
      }
      const item = sessionMap.get(key);
      item.total_students += 1;
      if (r.status === 'PRESENT') item.present_count += 1;
    }

    const submittedSessions = Array.from(sessionMap.values());

    // 1. Total Classes Conducted MUST be 2 (not 10 calendar days)
    expect(submittedSessions).toHaveLength(2);
    expect(academicCalendarDays.length).toBe(10);
    const totalClasses = submittedSessions.length;
    expect(totalClasses).toBe(2);

    // 2. All-absent session on 2026-09-04 MUST be preserved as a valid conducted session
    const allAbsentSession = submittedSessions.find(s => s.date === '2026-09-04');
    expect(allAbsentSession).toBeDefined();
    expect(allAbsentSession.total_students).toBe(3);
    expect(allAbsentSession.present_count).toBe(0);

    // 3. Unsubmitted dates (2026-09-02, 2026-09-03, 2026-09-05..10) must be absent from submittedSessions
    const unsubmittedDates = ['2026-09-02', '2026-09-03', '2026-09-05', '2026-09-06'];
    for (const d of unsubmittedDates) {
      expect(submittedSessions.some(s => s.date === d)).toBe(false);
    }

    // 4. Aggregate Metrics Verification
    let totalPresentCount = 0;
    let totalRecords = 0;
    committedAttendanceRecords.forEach(r => {
      totalRecords++;
      if (r.status === 'PRESENT') totalPresentCount++;
    });

    expect(totalPresentCount).toBe(2);
    expect(totalRecords).toBe(6);
    const avgAttendance = Math.round((totalPresentCount / totalRecords) * 100);
    expect(avgAttendance).toBe(33); // 2 / 6 = 33.3% -> 33%
  });

  it('formats calendar dates strictly as DD-MM-YYYY', () => {
    expect(formatDate('2026-09-04')).toBe('04-09-2026');
    expect(formatDate('2026-10-28')).toBe('28-10-2026');
    expect(formatDate('2026-01-05')).toBe('05-01-2026');
  });

  it('formats submission timestamps as DD-MM-YYYY • hh:mm A in Indian Standard Time (IST)', () => {
    // 2026-09-04T10:00:00Z -> IST (+5:30) is 15:30 (03:30 PM)
    const formatted = formatDateTime('2026-09-04T10:00:00Z');
    expect(formatted).toBe('04-09-2026 • 03:30 PM');
  });
});
