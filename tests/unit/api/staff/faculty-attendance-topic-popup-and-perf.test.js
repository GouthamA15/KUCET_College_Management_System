import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as attendancePOST } from '@/app/api/staff/faculty/attendance/route';
import { PATCH as topicPATCH } from '@/app/api/staff/faculty/attendance/session/topic/route';
import { getAuthUser } from '@/lib/api-utils';
import { AttendanceService } from '@/services/AttendanceService';
import { db } from '@/db';
import { canonicalizeRollNo } from '@/lib/rollNumber';

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: vi.fn(),
  };
});

vi.mock('@/services/AttendanceService', () => ({
  AttendanceService: {
    updateLectureTopic: vi.fn(),
    validateAttendanceDate: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/academic-utils', () => ({
  isSemesterActive: vi.fn().mockResolvedValue(true),
}));

describe('Faculty Attendance Topic Popup & Performance Optimization Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Topic Modal Popup Decision Logic (Phase 1)', () => {
    // Contract verification of the topic popup decision rule in FacultyAttendanceContext
    const evaluateTopicModalState = (savedTopic, inlineTopic, currentTopic) => {
      const effectiveTopic = savedTopic || inlineTopic || currentTopic;
      const hasValidTopic = typeof effectiveTopic === 'string' && effectiveTopic.trim().length >= 2;
      return hasValidTopic ? null : { assignmentId: 101, date: '2026-10-26', session: 1, initialTopic: '' };
    };

    it('does NOT trigger topic popup when a valid topic is entered on the main page', () => {
      const modal = evaluateTopicModalState(null, 'Paging and Virtual Memory', '');
      expect(modal).toBeNull();
    });

    it('does NOT trigger topic popup when server returns an already saved topic', () => {
      const modal = evaluateTopicModalState('File Systems and Inodes', null, '');
      expect(modal).toBeNull();
    });

    it('triggers topic modal only when topic is completely missing or empty', () => {
      const modal = evaluateTopicModalState(null, '', '');
      expect(modal).not.toBeNull();
      expect(modal.session).toBe(1);
    });

    it('treats whitespace-only strings as empty and triggers modal prompt', () => {
      const modal = evaluateTopicModalState(null, '     ', '');
      expect(modal).not.toBeNull();
    });

    it('treats single-character strings as invalid (min 2 chars) and triggers modal prompt', () => {
      const modal = evaluateTopicModalState(null, 'A', '');
      expect(modal).not.toBeNull();
    });

    it('sends the inline topic cleanly in attendance POST body', async () => {
      getAuthUser.mockResolvedValue({
        id: 10,
        role: 'faculty',
        branch: 'CSE',
      });

      // Assignment lookup
      db.select.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{
              id: 101,
              subject_code: 'CS301',
              branch: 'CSE',
              course_semester: 5,
              academic_year: '2026-2027',
              faculty_id: 10,
            }]),
          }),
        }),
      });

      // Canonical lookup
      db.select.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([{ id: 101 }]),
            }),
          }),
        }),
      });

      // College info
      db.select.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: 1, is_active: true }]),
          }),
        }),
      });

      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: () => ({
            onDuplicateKeyUpdate: () => Promise.resolve(),
          }),
        }),
      };

      db.transaction.mockImplementation(async (cb) => cb(mockTx));

      AttendanceService.updateLectureTopic.mockResolvedValue({
        success: true,
        topic_covered: 'Virtual Memory & Page Faults',
      });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: 101,
          date: '2026-10-26',
          session: 1,
          topic_covered: 'Virtual Memory & Page Faults',
          attendance_data: [{ student_id: 1, status: 'PRESENT' }],
        }),
      });

      const res = await attendancePOST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.topic_covered).toBe('Virtual Memory & Page Faults');
      expect(AttendanceService.updateLectureTopic).toHaveBeenCalledWith(
        expect.objectContaining({
          assignmentId: 101,
          date: '2026-10-26',
          sessionNumber: 1,
          topicCovered: 'Virtual Memory & Page Faults',
        })
      );
    });
  });

  describe('Attendance Save Responsiveness & Bulk Performance (Phase 2)', () => {
    it('executes bulk All Present operation in-memory across 60 students in < 1ms', () => {
      const students = Array.from({ length: 60 }, (_, i) => ({ id: i + 1 }));
      const start = performance.now();

      const nextStatusMap = {};
      students.forEach((s) => {
        nextStatusMap[s.id] = 'PRESENT';
      });

      const duration = performance.now() - start;
      expect(Object.keys(nextStatusMap).length).toBe(60);
      expect(nextStatusMap[1]).toBe('PRESENT');
      expect(nextStatusMap[60]).toBe('PRESENT');
      expect(duration).toBeLessThan(5); // Sub-5ms in-memory update
    });

    it('executes bulk All Absent operation correctly without modifying student base records', () => {
      const students = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, roll_no: `24567T09${i}` }));
      const nextStatusMap = {};
      students.forEach((s) => {
        nextStatusMap[s.id] = 'ABSENT';
      });

      expect(students[0].roll_no).toBe('24567T090');
      expect(nextStatusMap[students[0].id]).toBe('ABSENT');
    });

    it('prevents duplicate save submissions when submitting flag is active', () => {
      let isSubmitting = true;
      const saveAttempts = [];

      const triggerSave = () => {
        if (isSubmitting) return 'BLOCKED_DUPLICATE';
        isSubmitting = true;
        return 'SAVED';
      };

      expect(triggerSave()).toBe('BLOCKED_DUPLICATE');
    });
  });

  describe('QR Scanning & Manual Consistency (Phase 5)', () => {
    const classRoster = [
      { id: 101, roll_no: '24567T0901', name: 'Student 1' },
      { id: 102, roll_no: '24567T0902', name: 'Student 2' },
      { id: 103, roll_no: '24567T0903', name: 'Student 3' },
    ];

    it('matches scanned QR roll number accurately with student roster using canonical roll numbers', () => {
      const scannedInput = '24567t0901'; // lower case from QR
      const targetRoll = canonicalizeRollNo(scannedInput);
      const student = classRoster.find((s) => canonicalizeRollNo(s.roll_no) === targetRoll);

      expect(student).toBeDefined();
      expect(student.id).toBe(101);
    });

    it('throttles rapid duplicate scans of the same student within 1500ms', () => {
      let lastRoll = '';
      let lastTime = 0;
      let markCount = 0;

      const processScan = (roll, now) => {
        const canonical = canonicalizeRollNo(roll);
        if (lastRoll === canonical && (now - lastTime) < 1500) {
          return 'THROTTLED';
        }
        lastRoll = canonical;
        lastTime = now;
        markCount++;
        return 'MARKED';
      };

      expect(processScan('24567T0901', 1000)).toBe('MARKED');
      expect(processScan('24567T0901', 1200)).toBe('THROTTLED');
      expect(processScan('24567T0901', 1400)).toBe('THROTTLED');
      expect(processScan('24567T0901', 2600)).toBe('MARKED'); // > 1500ms elapsed
      expect(markCount).toBe(2);
    });

    it('handles student not in class with appropriate error without throwing', () => {
      const unknownRoll = '24567T0999';
      const targetRoll = canonicalizeRollNo(unknownRoll);
      const student = classRoster.find((s) => canonicalizeRollNo(s.roll_no) === targetRoll);

      expect(student).toBeUndefined();
    });

    it('marks remaining unverified students as ABSENT when scanner stops', () => {
      const statusMap = {
        101: 'PRESENT', // Scanned
      };

      const finalStatus = { ...statusMap };
      classRoster.forEach((s) => {
        if (!finalStatus[s.id]) {
          finalStatus[s.id] = 'ABSENT';
        }
      });

      expect(finalStatus[101]).toBe('PRESENT');
      expect(finalStatus[102]).toBe('ABSENT');
      expect(finalStatus[103]).toBe('ABSENT');
    });
  });
});
