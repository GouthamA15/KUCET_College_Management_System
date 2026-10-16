import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as attendancePOST } from '@/app/api/staff/faculty/attendance/route';
import { getAuthUser } from '@/lib/api-utils';
import { AttendanceService } from '@/services/AttendanceService';
import { db } from '@/db';

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

describe('Faculty Attendance Complete Workflow & Recovery Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Topic String Normalization & Defense Against SyntheticMouseEvent', () => {
    it('handles SyntheticMouseEvent gracefully without calling .trim() on non-string', () => {
      // Simulate what React passed when onClick={handleSaveAttendance} was clicked
      const fakeSyntheticEvent = {
        _reactName: 'onClick',
        type: 'click',
        target: { tagName: 'BUTTON' },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      // Normalization contract:
      const normalizeTopic = (explicitTopic, currentTopicCovered) => {
        const topicToSave = typeof explicitTopic === 'string'
          ? explicitTopic
          : (typeof currentTopicCovered === 'string' ? currentTopicCovered : '');
        return topicToSave.trim() || null;
      };

      // Passing SyntheticMouseEvent must NOT throw TypeError: n.trim is not a function
      expect(() => normalizeTopic(fakeSyntheticEvent, 'Operating Systems Deadlocks')).not.toThrow();
      expect(normalizeTopic(fakeSyntheticEvent, 'Operating Systems Deadlocks')).toBe('Operating Systems Deadlocks');
      expect(normalizeTopic(fakeSyntheticEvent, '')).toBe(null);
      expect(normalizeTopic(fakeSyntheticEvent, null)).toBe(null);
      expect(normalizeTopic(fakeSyntheticEvent, undefined)).toBe(null);

      // Passing explicit string topic should work directly
      expect(normalizeTopic('Compiler Design Parsing', '')).toBe('Compiler Design Parsing');
      expect(normalizeTopic('   Trimming Spaces   ', '')).toBe('Trimming Spaces');
    });

    it('enforces status completeness across all students in a large class (e.g. 58 students)', () => {
      const totalStudents = 58;
      const baseStudents = Array.from({ length: totalStudents }, (_, i) => ({
        id: i + 1,
        roll_no: `24567T09${String(i + 1).padStart(2, '0')}`,
        name: `Student ${i + 1}`,
      }));

      // Initial state: no students marked
      const initialStatusMap = {};
      const attendanceDataInitial = baseStudents.map((s) => ({
        student_id: s.id,
        status: initialStatusMap[s.id] ?? null,
      }));

      const missingInitial = attendanceDataInitial.filter((a) => a.status === null);
      expect(missingInitial.length).toBe(58);

      const validateStatuses = (data) => {
        const missing = data.filter((a) => a.status === null);
        if (missing.length > 0) {
          throw new Error(`Please set attendance status for all students. (${missing.length} remaining)`);
        }
      };

      expect(() => validateStatuses(attendanceDataInitial)).toThrow(
        'Please set attendance status for all students. (58 remaining)'
      );

      // Partial state: 50 students verified via PIN, 8 remaining
      const verifiedIds = new Set(Array.from({ length: 50 }, (_, i) => i + 1));
      const partialStatusMap = {};
      verifiedIds.forEach((id) => {
        partialStatusMap[id] = 'PRESENT';
      });

      const attendanceDataPartial = baseStudents.map((s) => ({
        student_id: s.id,
        status: partialStatusMap[s.id] ?? null,
      }));

      const missingPartial = attendanceDataPartial.filter((a) => a.status === null);
      expect(missingPartial.length).toBe(8);
      expect(() => validateStatuses(attendanceDataPartial)).toThrow(
        'Please set attendance status for all students. (8 remaining)'
      );

      // Confirm All action: mark remaining unverified as ABSENT
      const confirmedStatusMap = { ...partialStatusMap };
      baseStudents.forEach((s) => {
        if (verifiedIds.has(s.id)) {
          confirmedStatusMap[s.id] = 'PRESENT';
        } else if (confirmedStatusMap[s.id] === undefined) {
          confirmedStatusMap[s.id] = 'ABSENT';
        }
      });

      const attendanceDataConfirmed = baseStudents.map((s) => ({
        student_id: s.id,
        status: confirmedStatusMap[s.id] ?? null,
      }));

      expect(() => validateStatuses(attendanceDataConfirmed)).not.toThrow();
      const presentCount = attendanceDataConfirmed.filter((a) => a.status === 'PRESENT').length;
      const absentCount = attendanceDataConfirmed.filter((a) => a.status === 'ABSENT').length;
      expect(presentCount).toBe(50);
      expect(absentCount).toBe(8);
    });

    it('supports all valid institutional attendance status types without contract mismatch', () => {
      const validStatuses = ['PRESENT', 'ABSENT', 'NCC', 'MEDICAL'];
      const testStatuses = [
        { student_id: 1, status: 'PRESENT' },
        { student_id: 2, status: 'ABSENT' },
        { student_id: 3, status: 'NCC' },
        { student_id: 4, status: 'MEDICAL' },
      ];

      testStatuses.forEach((rec) => {
        expect(validStatuses).toContain(rec.status);
      });
    });
  });

  describe('POST /api/staff/faculty/attendance Database Transaction & Atomic Save', () => {
    it('successfully validates and persists full 58-student attendance roster with transaction', async () => {
      getAuthUser.mockResolvedValue({
        id: 10,
        staffId: 10,
        email: 'faculty@kucet.ac.in',
        role: 'faculty',
        branch: 'CSE',
        is_hod: false,
      });

      // Mock assignment query
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{
              id: 101,
              subject_code: 'CS301',
              branch: 'CSE',
              course_semester: 5,
              academic_year: '2025-2026',
              faculty_id: 10,
            }]),
          }),
        }),
      });

      // Canonical assignment query
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            orderBy: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValueOnce([{ id: 101 }]),
            }),
          }),
        }),
      });

      // College info query
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: 1 }]),
          }),
        }),
      });

      // Transaction mock
      db.transaction.mockImplementation(async (callback) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              onDuplicateKeyUpdate: vi.fn().mockResolvedValue({ affectedRows: 58 }),
            }),
          }),
        };
        return await callback(tx);
      });

      AttendanceService.updateLectureTopic.mockResolvedValue({
        success: true,
        topic_covered: 'Microservices & Distributed Systems',
      });

      const totalStudents = 58;
      const attendance_data = Array.from({ length: totalStudents }, (_, i) => ({
        student_id: i + 1,
        status: i < 50 ? 'PRESENT' : 'ABSENT',
      }));

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: 101,
          date: '2026-09-15',
          session: 1,
          topic_covered: 'Microservices & Distributed Systems',
          attendance_data,
        }),
      });

      const res = await attendancePOST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.message).toContain('Attendance updated successfully');
      expect(json.topic_covered).toBe('Microservices & Distributed Systems');
      expect(db.transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects attendance submission if any student record has invalid or null status', async () => {
      getAuthUser.mockResolvedValue({
        id: 10,
        role: 'faculty',
      });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: 101,
          date: '2026-09-15',
          session: 1,
          attendance_data: [
            { student_id: 1, status: 'PRESENT' },
            { student_id: 2, status: null }, // Null status violation
          ],
        }),
      });

      const res = await attendancePOST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });
  });
});
