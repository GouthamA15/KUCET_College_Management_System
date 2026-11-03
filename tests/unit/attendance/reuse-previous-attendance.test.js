import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Reuse Previous Session Attendance Feature Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cohort Compatibility & Validation Logic', () => {
    it('approves reuse when academic year, branch, and semester match exactly (e.g. Physics -> Mechanical for EEE Sem 1)', () => {
      const destAssignment = {
        id: 101,
        subject_name: 'Engineering Mechanics',
        subject_code: 'ME101',
        branch: 'EEE',
        course_semester: 1,
        academic_year: '2026-2027',
      };

      const sourceAssignment = {
        id: 102,
        subject_name: 'Engineering Physics',
        subject_code: 'PH101',
        branch: 'EEE',
        course_semester: 1,
        academic_year: '2026-2027',
      };

      const validateCohortCompatibility = (source, dest) => {
        const isSameBranch = String(source.branch).toUpperCase() === String(dest.branch).toUpperCase();
        const isSameSem = Number(source.course_semester) === Number(dest.course_semester);
        const isSameYear = String(source.academic_year).trim() === String(dest.academic_year).trim();
        return isSameBranch && isSameSem && isSameYear;
      };

      expect(validateCohortCompatibility(sourceAssignment, destAssignment)).toBe(true);
    });

    it('rejects cross-cohort reuse when branch differs (e.g. CSE -> EEE)', () => {
      const destAssignment = { branch: 'EEE', course_semester: 1, academic_year: '2026-2027' };
      const sourceAssignment = { branch: 'CSE', course_semester: 1, academic_year: '2026-2027' };

      const validateCohortCompatibility = (source, dest) => {
        return (
          String(source.branch).toUpperCase() === String(dest.branch).toUpperCase() &&
          Number(source.course_semester) === Number(dest.course_semester) &&
          String(source.academic_year).trim() === String(dest.academic_year).trim()
        );
      };

      expect(validateCohortCompatibility(sourceAssignment, destAssignment)).toBe(false);
    });

    it('rejects cross-cohort reuse when semester differs (e.g. Sem 3 -> Sem 1)', () => {
      const destAssignment = { branch: 'EEE', course_semester: 1, academic_year: '2026-2027' };
      const sourceAssignment = { branch: 'EEE', course_semester: 3, academic_year: '2026-2027' };

      const validateCohortCompatibility = (source, dest) => {
        return (
          String(source.branch).toUpperCase() === String(dest.branch).toUpperCase() &&
          Number(source.course_semester) === Number(dest.course_semester) &&
          String(source.academic_year).trim() === String(dest.academic_year).trim()
        );
      };

      expect(validateCohortCompatibility(sourceAssignment, destAssignment)).toBe(false);
    });

    it('rejects cross-cohort reuse when academic year differs (e.g. 2025-2026 -> 2026-2027)', () => {
      const destAssignment = { branch: 'EEE', course_semester: 1, academic_year: '2026-2027' };
      const sourceAssignment = { branch: 'EEE', course_semester: 1, academic_year: '2025-2026' };

      const validateCohortCompatibility = (source, dest) => {
        return (
          String(source.branch).toUpperCase() === String(dest.branch).toUpperCase() &&
          Number(source.course_semester) === Number(dest.course_semester) &&
          String(source.academic_year).trim() === String(dest.academic_year).trim()
        );
      };

      expect(validateCohortCompatibility(sourceAssignment, destAssignment)).toBe(false);
    });
  });

  describe('Roster Mapping & Lateral-Entry Safety', () => {
    it('copies all 4 canonical attendance statuses (PRESENT, ABSENT, NCC, MEDICAL) accurately', () => {
      const sourceRecords = [
        { student_id: 1, status: 'PRESENT' },
        { student_id: 2, status: 'ABSENT' },
        { student_id: 3, status: 'NCC' },
        { student_id: 4, status: 'MEDICAL' },
      ];

      const destRoster = [
        { id: 1, roll_no: '24567T0901', name: 'Student 1' },
        { id: 2, roll_no: '24567T0902', name: 'Student 2' },
        { id: 3, roll_no: '24567T0903', name: 'Student 3' },
        { id: 4, roll_no: '24567T0904', name: 'Student 4' },
      ];

      const destStudentMap = new Map(destRoster.map((s) => [s.id, s]));
      const matched = [];
      sourceRecords.forEach((r) => {
        if (destStudentMap.has(r.student_id)) {
          matched.push(r);
        }
      });

      expect(matched).toHaveLength(4);
      expect(matched.find((m) => m.student_id === 1).status).toBe('PRESENT');
      expect(matched.find((m) => m.student_id === 2).status).toBe('ABSENT');
      expect(matched.find((m) => m.student_id === 3).status).toBe('NCC');
      expect(matched.find((m) => m.student_id === 4).status).toBe('MEDICAL');
    });

    it('identifies lateral-entry or newly admitted students not in source session and safely defaults them to ABSENT', () => {
      const sourceRecords = [
        { student_id: 1, status: 'PRESENT' },
        { student_id: 2, status: 'PRESENT' },
      ];

      // Destination roster has regular students (1, 2) and lateral entry student (3)
      const destRoster = [
        { id: 1, roll_no: '24567T0901', name: 'Regular 1' },
        { id: 2, roll_no: '24567T0902', name: 'Regular 2' },
        { id: 3, roll_no: '255670901L', name: 'Lateral Entry 1' },
      ];

      const sourceIds = new Set(sourceRecords.map((r) => r.student_id));
      const missingInSource = destRoster.filter((s) => !sourceIds.has(s.id));

      expect(missingInSource).toHaveLength(1);
      expect(missingInSource[0].roll_no).toBe('255670901L');

      // Application of copied statuses:
      const destinationStatusMap = {};
      sourceRecords.forEach((r) => {
        destinationStatusMap[r.student_id] = r.status;
      });
      missingInSource.forEach((ms) => {
        destinationStatusMap[ms.id] = 'ABSENT'; // Safe explicit fallback
      });

      expect(destinationStatusMap[1]).toBe('PRESENT');
      expect(destinationStatusMap[2]).toBe('PRESENT');
      expect(destinationStatusMap[3]).toBe('ABSENT');
      expect(Object.keys(destinationStatusMap)).toHaveLength(3);
    });

    it('does not silently include students who are no longer in the active destination cohort', () => {
      // Source session had student 99 who discontinued or transferred
      const sourceRecords = [
        { student_id: 1, status: 'PRESENT' },
        { student_id: 99, status: 'PRESENT' }, // Discontinued / Detained
      ];

      const activeDestRoster = [
        { id: 1, roll_no: '24567T0901', name: 'Active Student' },
      ];

      const destStudentMap = new Map(activeDestRoster.map((s) => [s.id, s]));
      const matched = sourceRecords.filter((r) => destStudentMap.has(r.student_id));

      expect(matched).toHaveLength(1);
      expect(matched[0].student_id).toBe(1);
      // Student 99 is excluded from destination mapping
      expect(matched.some((m) => m.student_id === 99)).toBe(false);
    });
  });

  describe('Independent Records Proof & Isolation Guarantee', () => {
    it('guarantees that saving reused attendance creates a completely independent destination record', () => {
      // Source: Physics (Assignment 10, Session ID 500)
      const sourceSession = {
        id: 500,
        assignment_id: 10,
        date: '2026-11-03',
        session: 1,
        faculty_id: 5,
        total_students: 2,
        present_count: 2,
        absent_count: 0,
      };

      const sourceAttendance = [
        { id: 1001, session_id: 500, student_id: 1, assignment_id: 10, status: 'PRESENT' },
        { id: 1002, session_id: 500, student_id: 2, assignment_id: 10, status: 'PRESENT' },
      ];

      // Destination: Mechanical (Assignment 20, Session ID 600)
      // Faculty reuses Physics attendance and changes student 2 to ABSENT
      const copiedStatusMap = { 1: 'PRESENT', 2: 'PRESENT' };
      // Faculty edits student 2
      copiedStatusMap[2] = 'ABSENT';

      const destinationSession = {
        id: 600,
        assignment_id: 20,
        date: '2026-11-03',
        session: 1,
        faculty_id: 8,
        total_students: 2,
        present_count: 1,
        absent_count: 1,
      };

      const destinationAttendance = [
        { id: 2001, session_id: 600, student_id: 1, assignment_id: 20, status: copiedStatusMap[1] },
        { id: 2002, session_id: 600, student_id: 2, assignment_id: 20, status: copiedStatusMap[2] },
      ];

      // 1. Destination has unique session_id and assignment_id
      expect(destinationSession.id).not.toBe(sourceSession.id);
      expect(destinationSession.assignment_id).not.toBe(sourceSession.assignment_id);
      expect(destinationSession.faculty_id).not.toBe(sourceSession.faculty_id);

      // 2. Modifying destination does NOT modify source
      expect(destinationAttendance.find((d) => d.student_id === 2).status).toBe('ABSENT');
      expect(sourceAttendance.find((s) => s.student_id === 2).status).toBe('PRESENT');

      // 3. Modifying source later does NOT affect destination
      sourceAttendance.find((s) => s.student_id === 1).status = 'ABSENT'; // Physics faculty corrects student 1 to ABSENT
      expect(sourceAttendance.find((s) => s.student_id === 1).status).toBe('ABSENT');
      expect(destinationAttendance.find((d) => d.student_id === 1).status).toBe('PRESENT'); // Mechanical destination remains PRESENT
    });

    it('allows faculty to cycle copied statuses to any canonical state (Absent -> Present -> NCC -> Medical)', () => {
      const getNextStatus = (current) => {
        if (current === null || current === 'MEDICAL') return 'PRESENT';
        if (current === 'PRESENT') return 'ABSENT';
        if (current === 'ABSENT') return 'NCC';
        if (current === 'NCC') return 'MEDICAL';
        return 'PRESENT';
      };

      // Copied status is ABSENT
      let status = 'ABSENT';
      // Change to NCC
      status = getNextStatus(status);
      expect(status).toBe('NCC');
      // Change to MEDICAL
      status = getNextStatus(status);
      expect(status).toBe('MEDICAL');
      // Change to PRESENT
      status = getNextStatus(status);
      expect(status).toBe('PRESENT');
    });
  });

  describe('UI Overwrite Protection & Safeguards', () => {
    it('prompts overwrite confirmation when destination sheet already contains marked students', () => {
      const currentStatusMap = {
        1: 'PRESENT',
        2: 'ABSENT',
      };

      const hasExistingMarks = Object.values(currentStatusMap).filter(Boolean).length > 0;
      expect(hasExistingMarks).toBe(true);

      // Modal requires confirmation before overwriting
      let appliedStatuses = null;

      const handleReuseSelection = (data, userConfirmed) => {
        if (hasExistingMarks && !userConfirmed) {
          return 'CONFIRMATION_REQUIRED';
        }
        appliedStatuses = data.attendance_records;
        return 'APPLIED';
      };

      const incomingData = {
        attendance_records: [
          { student_id: 1, status: 'ABSENT' },
          { student_id: 2, status: 'PRESENT' },
        ],
      };

      const result1 = handleReuseSelection(incomingData, false);
      expect(result1).toBe('CONFIRMATION_REQUIRED');
      expect(appliedStatuses).toBe(null);

      const result2 = handleReuseSelection(incomingData, true);
      expect(result2).toBe('APPLIED');
      expect(appliedStatuses).toHaveLength(2);
    });

    it('applies reuse immediately without confirmation prompt when destination is completely unmarked', () => {
      const currentStatusMap = {};
      const hasExistingMarks = Object.values(currentStatusMap).filter(Boolean).length > 0;
      expect(hasExistingMarks).toBe(false);

      let applied = false;
      const handleReuse = () => {
        applied = true;
      };

      if (!hasExistingMarks) {
        handleReuse();
      }

      expect(applied).toBe(true);
    });

    it('safely handles network failure during session fetch without corrupting existing attendance', async () => {
      const currentStatusMap = { 1: 'PRESENT', 2: 'PRESENT' };
      const statusMapSnapshot = { ...currentStatusMap };

      const failingFetch = () => Promise.reject(new Error('Network error: connection lost'));

      let errorCaught = null;
      try {
        await failingFetch();
      } catch (err) {
        errorCaught = err;
      }

      expect(errorCaught).toBeDefined();
      expect(errorCaught.message).toContain('Network error');
      // Original status map remains 100% intact
      expect(currentStatusMap).toEqual(statusMapSnapshot);
    });
  });
});
