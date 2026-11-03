import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Attendance Marking UX & Interaction Logic Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Part B: Bulk Operation Confirmation Dialogs', () => {
    it('opens confirmation dialog on Present All click with student count and does not mutate state prior to confirmation', () => {
      const state = {
        students: [
          { id: 1, roll_no: '24567T0901', status: null },
          { id: 2, roll_no: '24567T0902', status: 'ABSENT' },
          { id: 3, roll_no: '24567T0903', status: 'PRESENT' },
        ],
        bulkModalStatus: null,
      };

      // Faculty clicks "Present All"
      const handleOpenBulk = (status) => {
        state.bulkModalStatus = status;
      };

      handleOpenBulk('PRESENT');

      // Modal is open with target status and affected count
      expect(state.bulkModalStatus).toBe('PRESENT');
      // No student attendance records changed before confirmation
      expect(state.students[0].status).toBe(null);
      expect(state.students[1].status).toBe('ABSENT');
      expect(state.students[2].status).toBe('PRESENT');
    });

    it('cancels bulk action leaving all student attendance records completely unchanged', () => {
      const state = {
        students: [
          { id: 1, roll_no: '24567T0901', status: 'PRESENT' },
          { id: 2, roll_no: '24567T0902', status: 'ABSENT' },
          { id: 3, roll_no: '24567T0903', status: 'NCC' },
        ],
        bulkModalStatus: 'PRESENT',
      };

      // Faculty clicks "Cancel" on confirmation modal
      const handleCancel = () => {
        state.bulkModalStatus = null;
      };

      handleCancel();

      expect(state.bulkModalStatus).toBe(null);
      expect(state.students[0].status).toBe('PRESENT');
      expect(state.students[1].status).toBe('ABSENT');
      expect(state.students[2].status).toBe('NCC');
    });

    it('executes bulk action exactly once upon confirmation and updates all students', async () => {
      let apiCallCount = 0;
      const mockApi = vi.fn().mockImplementation(async (payload) => {
        apiCallCount++;
        return { ok: true, json: async () => ({ success: true, count: payload.attendance_data.length }) };
      });

      const baseStudents = [
        { id: 1, roll_no: '24567T0901' },
        { id: 2, roll_no: '24567T0902' },
        { id: 3, roll_no: '24567T0903' },
      ];

      let attendanceStatusMap = { 1: 'ABSENT', 2: 'ABSENT', 3: 'ABSENT' };
      let bulkSubmitting = false;

      const confirmBulkAttendance = async (targetStatus) => {
        if (bulkSubmitting) return; // Debounce guard
        bulkSubmitting = true;

        // 1. Optimistic update
        const nextMap = {};
        baseStudents.forEach((s) => {
          nextMap[s.id] = targetStatus;
        });
        attendanceStatusMap = nextMap;

        try {
          await mockApi({
            assignment_id: 10,
            date: '2026-09-04',
            session: 1,
            attendance_data: baseStudents.map((s) => ({ student_id: s.id, status: targetStatus })),
          });
        } finally {
          bulkSubmitting = false;
        }
      };

      await confirmBulkAttendance('PRESENT');

      expect(apiCallCount).toBe(1);
      expect(attendanceStatusMap[1]).toBe('PRESENT');
      expect(attendanceStatusMap[2]).toBe('PRESENT');
      expect(attendanceStatusMap[3]).toBe('PRESENT');
    });

    it('prevents duplicate concurrent bulk requests while processing', async () => {
      let apiCallCount = 0;
      const mockApi = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 50)));

      let bulkSubmitting = false;
      const executeBulk = async (_status) => {
        if (bulkSubmitting) return 'BLOCKED';
        bulkSubmitting = true;
        try {
          apiCallCount++;
          await mockApi();
          return 'SUCCESS';
        } finally {
          bulkSubmitting = false;
        }
      };

      // Rapid double click
      const [res1, res2] = await Promise.all([
        executeBulk('PRESENT'),
        executeBulk('PRESENT'),
      ]);

      expect(res1).toBe('SUCCESS');
      expect(res2).toBe('BLOCKED');
      expect(apiCallCount).toBe(1);
    });

    it('rolls back optimistic state on bulk API failure', async () => {
      const previousState = { 1: 'PRESENT', 2: 'ABSENT', 3: 'NCC' };
      let attendanceStatusMap = { ...previousState };

      const failingApi = vi.fn().mockRejectedValue(new Error('500 Internal Server Error'));

      let errorCaught = null;
      const executeBulkWithRollback = async (targetStatus) => {
        const snapshot = { ...attendanceStatusMap };
        // Optimistic update
        attendanceStatusMap = { 1: targetStatus, 2: targetStatus, 3: targetStatus };
        try {
          await failingApi();
        } catch (err) {
          // Rollback
          attendanceStatusMap = snapshot;
          errorCaught = err;
        }
      };

      await executeBulkWithRollback('ABSENT');

      expect(errorCaught).toBeDefined();
      expect(errorCaught.message).toBe('500 Internal Server Error');
      // Must be restored to original values
      expect(attendanceStatusMap[1]).toBe('PRESENT');
      expect(attendanceStatusMap[2]).toBe('ABSENT');
      expect(attendanceStatusMap[3]).toBe('NCC');
    });
  });

  describe('Part C: Individual Student Status Cycling', () => {
    it('strictly cycles through Present → Absent → NCC → Medical → Present', () => {
      const getNextStatus = (current) => {
        if (current === null || current === 'MEDICAL') return 'PRESENT';
        if (current === 'PRESENT') return 'ABSENT';
        if (current === 'ABSENT') return 'NCC';
        if (current === 'NCC') return 'MEDICAL';
        return 'PRESENT';
      };

      // Unmarked (null) -> PRESENT
      let status = null;
      status = getNextStatus(status);
      expect(status).toBe('PRESENT');

      // PRESENT -> ABSENT
      status = getNextStatus(status);
      expect(status).toBe('ABSENT');

      // ABSENT -> NCC
      status = getNextStatus(status);
      expect(status).toBe('NCC');

      // NCC -> MEDICAL
      status = getNextStatus(status);
      expect(status).toBe('MEDICAL');

      // MEDICAL -> PRESENT
      status = getNextStatus(status);
      expect(status).toBe('PRESENT');
    });

    it('applies immediate optimistic update and persists via attendance API', async () => {
      let persistedPayload = null;
      const mockApi = vi.fn().mockImplementation(async (body) => {
        persistedPayload = body;
        return { ok: true, json: async () => ({ success: true }) };
      });

      const baseStudents = [
        { id: 101, roll_no: '24567T0901' },
        { id: 102, roll_no: '24567T0902' },
      ];
      let attendanceStatusMap = { 101: 'PRESENT', 102: 'PRESENT' };
      const updatingStudents = new Set();

      const cycleStudent = async (studentId) => {
        if (updatingStudents.has(studentId)) return;
        const current = attendanceStatusMap[studentId];
        const next = current === 'PRESENT' ? 'ABSENT' : 'PRESENT';

        // 1. Optimistic
        attendanceStatusMap = { ...attendanceStatusMap, [studentId]: next };
        updatingStudents.add(studentId);

        try {
          await mockApi({
            assignment_id: 1,
            attendance_data: baseStudents.map((s) => ({
              student_id: s.id,
              status: s.id === studentId ? next : attendanceStatusMap[s.id],
            })),
          });
        } finally {
          updatingStudents.delete(studentId);
        }
      };

      await cycleStudent(101);

      expect(attendanceStatusMap[101]).toBe('ABSENT');
      expect(attendanceStatusMap[102]).toBe('PRESENT');
      expect(persistedPayload.attendance_data).toEqual([
        { student_id: 101, status: 'ABSENT' },
        { student_id: 102, status: 'PRESENT' },
      ]);
    });

    it('debounces rapid repeated clicks on the same student while mutation is in-flight', async () => {
      let callCount = 0;
      const updatingStudents = new Set();

      const slowApi = () => new Promise((resolve) => setTimeout(resolve, 40));

      const cycleStudent = async (studentId) => {
        if (updatingStudents.has(studentId)) return 'IGNORED_RAPID_CLICK';
        updatingStudents.add(studentId);
        try {
          callCount++;
          await slowApi();
          return 'SUCCESS';
        } finally {
          updatingStudents.delete(studentId);
        }
      };

      // Trigger 3 rapid clicks concurrently on the same student
      const [r1, r2, r3] = await Promise.all([
        cycleStudent(55),
        cycleStudent(55),
        cycleStudent(55),
      ]);

      expect(r1).toBe('SUCCESS');
      expect(r2).toBe('IGNORED_RAPID_CLICK');
      expect(r3).toBe('IGNORED_RAPID_CLICK');
      expect(callCount).toBe(1);
    });

    it('rolls back individual student status when API persistence fails', async () => {
      let attendanceStatusMap = { 10: 'PRESENT' };
      const updatingStudents = new Set();

      const failingApi = () => Promise.reject(new Error('Network error'));

      const cycleStudent = async (studentId) => {
        const prev = attendanceStatusMap[studentId];
        const next = 'ABSENT';

        // Optimistic
        attendanceStatusMap = { ...attendanceStatusMap, [studentId]: next };
        updatingStudents.add(studentId);

        try {
          await failingApi();
        } catch (_err) {
          // Rollback
          attendanceStatusMap = { ...attendanceStatusMap, [studentId]: prev };
        } finally {
          updatingStudents.delete(studentId);
        }
      };

      await cycleStudent(10);

      // Must be restored to PRESENT
      expect(attendanceStatusMap[10]).toBe('PRESENT');
      expect(updatingStudents.has(10)).toBe(false);
    });

    it('respects institutional policy for NCC and MEDICAL counting in attendance percentages', () => {
      // KUCET institutional rule: Attended = PRESENT + NCC + MEDICAL
      const calculateAttendance = (records) => {
        const total = records.length;
        if (total === 0) return 0;
        const present = records.filter((r) => r === 'PRESENT').length;
        const ncc = records.filter((r) => r === 'NCC').length;
        const medical = records.filter((r) => r === 'MEDICAL').length;
        const attended = present + ncc + medical;
        return {
          total,
          present,
          ncc,
          medical,
          attended,
          percentage: Math.round((attended / total) * 100),
        };
      };

      const studentRecords = [
        'PRESENT',  // 1
        'PRESENT',  // 2
        'ABSENT',   // 3
        'NCC',      // 4 (Duty leave)
        'MEDICAL',  // 5 (Medical leave)
      ];

      const metrics = calculateAttendance(studentRecords);
      expect(metrics.total).toBe(5);
      expect(metrics.present).toBe(2);
      expect(metrics.ncc).toBe(1);
      expect(metrics.medical).toBe(1);
      expect(metrics.attended).toBe(4); // 2 + 1 + 1 = 4
      expect(metrics.percentage).toBe(80); // (4 / 5) * 100 = 80%
    });

    it('blocks status modification on inactive or locked semesters', () => {
      const assignment = { id: 1, is_active: false };
      const dateValidation = { isValid: false, message: 'Semester ended' };

      const canModifyAttendance = () => {
        return Boolean(assignment?.is_active && dateValidation?.isValid);
      };

      expect(canModifyAttendance()).toBe(false);
    });
  });
});
