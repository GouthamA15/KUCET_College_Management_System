import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AcademicMonitoringService } from '@/services/academic/AcademicMonitoringService';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('@/lib/academic-utils', () => ({
  getCollegeAcademicYear: vi.fn().mockResolvedValue('2026-27'),
  deriveDefaultAcademicYear: vi.fn().mockReturnValue('2026-27'),
  resolveCanonicalSubjectType: vi.fn(({ subject_code, canonical_subject_type }) => {
    const isLab = canonical_subject_type === 'lab' || subject_code?.toLowerCase().includes('lab');
    return {
      is_lab: isLab,
      subject_type: isLab ? 'lab' : 'theory',
      status: 'RESOLVED'
    };
  })
}));

vi.mock('@/lib/academic-authorization', () => ({
  isDesignatedAcademicSupervisor: vi.fn(async (staffId) => staffId === 303),
  getAuthorizedAcademicBranches: vi.fn((user) => {
    if (user.role === 'admin' || user.is_designated_supervisor || user.is_first_year_coordinator) return null;
    if (user.is_hod) return user.authorized_branches || ['CSE'];
    return [];
  }),
  getAllowedAcademicSemesters: vi.fn((user, _targetBranch) => {
    if (user.role === 'admin' || user.is_designated_supervisor) return [1, 2, 3, 4, 5, 6, 7, 8];
    if (user.is_first_year_coordinator) return [1, 2];
    if (user.is_hod) return [1, 2, 3, 4, 5, 6, 7, 8];
    return [];
  }),
  isAcademicScopeAllowed: vi.fn((user, { branch, semester }) => {
    if (user.role === 'admin' || user.is_designated_supervisor) return true;
    if (user.is_first_year_coordinator) {
      return Number(semester) === 1 || Number(semester) === 2;
    }
    if (user.is_hod) {
      const branches = user.authorized_branches || ['CSE'];
      return branches.includes(branch);
    }
    return false;
  }),
  getInstitutionalBranches: vi.fn().mockResolvedValue(['CSE', 'IT', 'CSD', 'ECE', 'EEE', 'CIVIL', 'MECH']),
  isAcademicYearLocked: vi.fn().mockResolvedValue({ isLocked: false, reason: null })
}));

describe('AcademicMonitoringService - Scope & RBAC Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows First-Year Coordinator to monitor Semesters 1 and 2 across institutional branches', async () => {
    const coordUser = { id: 101, role: 'faculty', is_first_year_coordinator: true };
    const scope = await AcademicMonitoringService.resolveScope(coordUser, {
      branch: 'ECE',
      semester: 1,
      academicYear: '2026-27'
    });

    expect(scope.branch).toBe('ECE');
    expect(scope.semester).toBe(1);
    expect(scope.isCoord).toBe(true);
  });

  it('rejects First-Year Coordinator when requesting Semester 3 with HTTP 403', async () => {
    const coordUser = { id: 101, role: 'faculty', is_first_year_coordinator: true };

    await expect(
      AcademicMonitoringService.resolveScope(coordUser, {
        branch: 'CSE',
        semester: 3,
        academicYear: '2026-27'
      })
    ).rejects.toThrow(/Forbidden/);
  });

  it('allows HOD to access all 8 semesters within authorized department branch', async () => {
    const hodUser = { id: 202, role: 'faculty', is_hod: true, authorized_branches: ['CSE'] };
    const scope = await AcademicMonitoringService.resolveScope(hodUser, {
      branch: 'CSE',
      semester: 6,
      academicYear: '2026-27'
    });

    expect(scope.branch).toBe('CSE');
    expect(scope.semester).toBe(6);
  });

  it('rejects HOD when requesting a foreign department branch with HTTP 403', async () => {
    const hodUser = { id: 202, role: 'faculty', is_hod: true, authorized_branches: ['CSE'] };

    await expect(
      AcademicMonitoringService.resolveScope(hodUser, {
        branch: 'MECH',
        semester: 4,
        academicYear: '2026-27'
      })
    ).rejects.toThrow(/Forbidden/);
  });

  it('allows Designated Academic Supervisor global institutional access across all branches and semesters', async () => {
    const supervisorUser = { id: 303, role: 'faculty', is_principal: true };
    const scope = await AcademicMonitoringService.resolveScope(supervisorUser, {
      branch: 'CIVIL',
      semester: 7,
      academicYear: '2026-27'
    });

    expect(scope.branch).toBe('CIVIL');
    expect(scope.semester).toBe(7);
    expect(scope.isGlobal).toBe(true);
  });

  it('rejects non-designated Principal from obtaining global monitoring scope (fail-closed)', async () => {
    // Staff id 999 is NOT the designated supervisor (isDesignatedAcademicSupervisor returns false)
    const nonDesignatedPrincipal = { id: 999, role: 'faculty', is_principal: true };

    await expect(
      AcademicMonitoringService.resolveScope(nonDesignatedPrincipal, {
        branch: 'CSE',
        semester: 1,
        academicYear: '2026-27'
      })
    ).rejects.toThrow(/Forbidden/);
  });

  it('rejects regular faculty lacking coordinator, HOD, or supervisor assignment with HTTP 403', async () => {
    const regularFaculty = { id: 404, role: 'faculty', branch: 'CSE' };

    await expect(
      AcademicMonitoringService.resolveScope(regularFaculty, {
        branch: 'CSE',
        semester: 1,
        academicYear: '2026-27'
      })
    ).rejects.toThrow(/Forbidden/);
  });
});

describe('AcademicMonitoringService - Calculation Formulas & Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('escapes CSV cells against spreadsheet formula injection (=, +, -, @)', async () => {
    const mockUser = { id: 1, role: 'admin' };

    vi.spyOn(AcademicMonitoringService, 'getCombinedAcademicData').mockResolvedValueOnce({
      scope: { academic_year: '2026-27', branch: 'CSE', semester: 1 },
      students: [
        {
          id: 1,
          roll_no: '=cmd|/c calc!A0',
          name: '+Malicious Student',
          branch: 'CSE',
          semester: 1,
          attendance_percentage: 80,
          attendance_status_label: 'Good Standing',
          average_cie_marks: null,
          marks_status_label: 'Pending Evaluations',
          combined_label: 'Marks Not Published'
        }
      ]
    });

    const csv = await AcademicMonitoringService.generateCsvExport({
      user: mockUser,
      type: 'combined',
      branch: 'CSE',
      semester: 1,
      academicYear: '2026-27'
    });

    expect(csv).toContain("\"'=cmd|/c calc!A0\"");
    expect(csv).toContain("\"'+Malicious Student\"");
  });

  it('correctly calculates attendance counting PRESENT, NCC, and MEDICAL as attended at exactly 75%', async () => {
    const mockUser = { id: 1, role: 'admin' };

    vi.spyOn(AcademicMonitoringService, 'resolveScope').mockResolvedValueOnce({
      user: mockUser,
      isGlobal: true,
      branch: 'CSE',
      semester: 1,
      academicYear: '2026-27',
      allowedBranches: ['CSE'],
      allowedSemesters: [1]
    });

    vi.spyOn(AcademicMonitoringService, 'getCanonicalAssignments').mockResolvedValueOnce([
      {
        id: 1,
        assignment_ids: [1],
        subject_code: 'CS101',
        subject_name: 'Programming',
        branch: 'CSE',
        course_semester: 1,
        academic_year: '2026-27',
        is_lab: false
      }
    ]);

    vi.spyOn(AcademicMonitoringService, 'getCohortStudents').mockResolvedValueOnce([
      {
        id: 10,
        roll_no: '24567T0901',
        name: 'Student A',
        admission_date: '2026-08-01'
      }
    ]);

    db.select
      .mockImplementationOnce(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { student_id: 10, assignment_id: 1, date: '2026-08-05', session: 1, status: 'PRESENT' },
          { student_id: 10, assignment_id: 1, date: '2026-08-06', session: 1, status: 'NCC' },
          { student_id: 10, assignment_id: 1, date: '2026-08-07', session: 1, status: 'MEDICAL' },
          { student_id: 10, assignment_id: 1, date: '2026-08-08', session: 1, status: 'ABSENT' }
        ])
      }))
      .mockImplementationOnce(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: 101, assignment_id: 1, date: '2026-08-05', session_number: 1 },
          { id: 102, assignment_id: 1, date: '2026-08-06', session_number: 1 },
          { id: 103, assignment_id: 1, date: '2026-08-07', session_number: 1 },
          { id: 104, assignment_id: 1, date: '2026-08-08', session_number: 1 }
        ])
      }));

    const result = await AcademicMonitoringService.getCohortAttendance({
      user: mockUser,
      branch: 'CSE',
      semester: 1,
      academicYear: '2026-27'
    });

    const student = result.students[0];
    expect(student.total_sessions).toBe(4);
    expect(student.present_count).toBe(1);
    expect(student.ncc_count).toBe(1);
    expect(student.medical_count).toBe(1);
    expect(student.absent_count).toBe(1);
    // Attended = PRESENT (1) + NCC (1) + MEDICAL (1) = 3 out of 4 = 75.0%
    expect(student.attended_sessions).toBe(3);
    expect(student.attendance_percentage).toBe(75);
    // Exactly 75% is in GOOD_STANDING
    expect(student.status).toBe('GOOD_STANDING');
    expect(student.status_label).toBe('Good Standing');
  });

  it('flags student below 75% with neutral ATTENDANCE_ATTENTION status', async () => {
    const mockUser = { id: 1, role: 'admin' };

    vi.spyOn(AcademicMonitoringService, 'resolveScope').mockResolvedValueOnce({
      user: mockUser,
      isGlobal: true,
      branch: 'CSE',
      semester: 1,
      academicYear: '2026-27',
      allowedBranches: ['CSE'],
      allowedSemesters: [1]
    });

    vi.spyOn(AcademicMonitoringService, 'getCanonicalAssignments').mockResolvedValueOnce([
      {
        id: 1,
        assignment_ids: [1],
        subject_code: 'CS101',
        subject_name: 'Programming',
        branch: 'CSE',
        course_semester: 1,
        academic_year: '2026-27',
        is_lab: false
      }
    ]);

    vi.spyOn(AcademicMonitoringService, 'getCohortStudents').mockResolvedValueOnce([
      {
        id: 15,
        roll_no: '24567T0915',
        name: 'Student Below',
        admission_date: '2026-08-01'
      }
    ]);

    // 2 attended out of 4 = 50% (< 75%)
    db.select
      .mockImplementationOnce(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { student_id: 15, assignment_id: 1, date: '2026-08-05', session: 1, status: 'PRESENT' },
          { student_id: 15, assignment_id: 1, date: '2026-08-06', session: 1, status: 'PRESENT' },
          { student_id: 15, assignment_id: 1, date: '2026-08-07', session: 1, status: 'ABSENT' },
          { student_id: 15, assignment_id: 1, date: '2026-08-08', session: 1, status: 'ABSENT' }
        ])
      }))
      .mockImplementationOnce(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: 101, assignment_id: 1, date: '2026-08-05', session_number: 1 },
          { id: 102, assignment_id: 1, date: '2026-08-06', session_number: 1 },
          { id: 103, assignment_id: 1, date: '2026-08-07', session_number: 1 },
          { id: 104, assignment_id: 1, date: '2026-08-08', session_number: 1 }
        ])
      }));

    const result = await AcademicMonitoringService.getCohortAttendance({
      user: mockUser,
      branch: 'CSE',
      semester: 1,
      academicYear: '2026-27'
    });

    const student = result.students[0];
    expect(student.attendance_percentage).toBe(50);
    expect(student.status).toBe('ATTENDANCE_ATTENTION');
    expect(student.status_label).toBe('Attendance Attention Required');
  });

  it('tracks factual consecutive absence counts without unapproved threshold-based alert booleans', async () => {
    const mockUser = { id: 1, role: 'admin' };

    vi.spyOn(AcademicMonitoringService, 'resolveScope').mockResolvedValueOnce({
      user: mockUser,
      isGlobal: true,
      branch: 'CSE',
      semester: 1,
      academicYear: '2026-27',
      allowedBranches: ['CSE'],
      allowedSemesters: [1]
    });

    vi.spyOn(AcademicMonitoringService, 'getCanonicalAssignments').mockResolvedValueOnce([
      {
        id: 1,
        assignment_ids: [1],
        subject_code: 'CS101',
        subject_name: 'Programming',
        branch: 'CSE',
        course_semester: 1,
        academic_year: '2026-27',
        is_lab: false
      }
    ]);

    vi.spyOn(AcademicMonitoringService, 'getCohortStudents').mockResolvedValueOnce([
      {
        id: 20,
        roll_no: '24567T0902',
        name: 'Student B',
        admission_date: '2026-08-01'
      }
    ]);

    // 3 latest sessions are ABSENT
    db.select
      .mockImplementationOnce(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { student_id: 20, assignment_id: 1, date: '2026-08-05', session: 1, status: 'PRESENT' },
          { student_id: 20, assignment_id: 1, date: '2026-08-06', session: 1, status: 'ABSENT' },
          { student_id: 20, assignment_id: 1, date: '2026-08-07', session: 1, status: 'ABSENT' },
          { student_id: 20, assignment_id: 1, date: '2026-08-08', session: 1, status: 'ABSENT' }
        ])
      }))
      .mockImplementationOnce(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: 101, assignment_id: 1, date: '2026-08-05', session_number: 1 },
          { id: 102, assignment_id: 1, date: '2026-08-06', session_number: 1 },
          { id: 103, assignment_id: 1, date: '2026-08-07', session_number: 1 },
          { id: 104, assignment_id: 1, date: '2026-08-08', session_number: 1 }
        ])
      }));

    const result = await AcademicMonitoringService.getCohortAttendance({
      user: mockUser,
      branch: 'CSE',
      semester: 1,
      academicYear: '2026-27'
    });

    const student = result.students[0];
    expect(student.consecutive_absent_count).toBe(3);
    // Unapproved alert boolean has_consecutive_absence_alert must NOT be present
    expect(student.has_consecutive_absence_alert).toBeUndefined();
  });

  it('correctly calculates CIE marks evaluating Best-of-Mids for Theory Pattern 1 and reports workflow status', async () => {
    const mockUser = { id: 1, role: 'admin' };

    vi.spyOn(AcademicMonitoringService, 'resolveScope').mockResolvedValueOnce({
      user: mockUser,
      isGlobal: true,
      branch: 'CSE',
      semester: 1,
      academicYear: '2026-27',
      allowedBranches: ['CSE'],
      allowedSemesters: [1]
    });

    vi.spyOn(AcademicMonitoringService, 'getCanonicalAssignments').mockResolvedValueOnce([
      {
        id: 1,
        assignment_ids: [1],
        subject_code: 'CS101',
        subject_name: 'Theory Subject',
        branch: 'CSE',
        course_semester: 1,
        academic_year: '2026-27',
        is_lab: false,
        pattern: { name: 'Pattern 1 (20+10)', hasAssignment: true, midMax: 20 }
      }
    ]);

    vi.spyOn(AcademicMonitoringService, 'getCohortStudents').mockResolvedValueOnce([
      {
        id: 30,
        roll_no: '24567T0903',
        name: 'Student C'
      }
    ]);

    // Student C has Mid1=15, Mid2=18, Assignment=9 -> Best Mid=18 + 9 = 27
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        {
          id: 501,
          student_id: 30,
          assignment_id: 1,
          is_published: true,
          mid1_marks: '15.00',
          mid2_marks: '18.00',
          assignment_marks: '9.00',
          lab_theory_marks: null,
          lab_execution_marks: null,
          lab_record_marks: null
        }
      ])
    }));

    const result = await AcademicMonitoringService.getCohortMarks({
      user: mockUser,
      branch: 'CSE',
      semester: 1,
      academicYear: '2026-27'
    });

    const student = result.students[0];
    const subMarks = student.subject_breakdown['CS101'];
    expect(subMarks.mid1).toBe(15);
    expect(subMarks.mid2).toBe(18);
    expect(subMarks.best_mid).toBe(18);
    expect(subMarks.assignment).toBe(9);
    // Best Mid (18) + Assignment (9) = 27
    expect(subMarks.total_marks).toBe(27);
    expect(subMarks.is_published).toBe(true);
    expect(student.average_cie_marks).toBe(27);
    // Status is workflow-based (PUBLISHED), not an arbitrary failure cutoff
    expect(student.status).toBe('PUBLISHED');
    expect(student.status_label).toBe('Marks Published');
  });

  it('correctly calculates CIE marks for Laboratory subjects and reports DRAFT status', async () => {
    const mockUser = { id: 1, role: 'admin' };

    vi.spyOn(AcademicMonitoringService, 'resolveScope').mockResolvedValueOnce({
      user: mockUser,
      isGlobal: true,
      branch: 'CSE',
      semester: 1,
      academicYear: '2026-27',
      allowedBranches: ['CSE'],
      allowedSemesters: [1]
    });

    vi.spyOn(AcademicMonitoringService, 'getCanonicalAssignments').mockResolvedValueOnce([
      {
        id: 2,
        assignment_ids: [2],
        subject_code: 'CS102L',
        subject_name: 'Programming Lab',
        branch: 'CSE',
        course_semester: 1,
        academic_year: '2026-27',
        is_lab: true
      }
    ]);

    vi.spyOn(AcademicMonitoringService, 'getCohortStudents').mockResolvedValueOnce([
      {
        id: 40,
        roll_no: '24567T0904',
        name: 'Student D'
      }
    ]);

    // Student D has Lab Execution=10, Theory=10, Record=5 -> Total = 25
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        {
          id: 502,
          student_id: 40,
          assignment_id: 2,
          is_published: false, // Draft marks
          mid1_marks: null,
          mid2_marks: null,
          assignment_marks: null,
          lab_theory_marks: '10.00',
          lab_execution_marks: '10.00',
          lab_record_marks: '5.00'
        }
      ])
    }));

    const result = await AcademicMonitoringService.getCohortMarks({
      user: mockUser,
      branch: 'CSE',
      semester: 1,
      academicYear: '2026-27'
    });

    const student = result.students[0];
    const subMarks = student.subject_breakdown['CS102L'];
    expect(subMarks.is_lab).toBe(true);
    expect(subMarks.lab_execution).toBe(10);
    expect(subMarks.lab_theory).toBe(10);
    expect(subMarks.lab_record).toBe(5);
    expect(subMarks.total_marks).toBe(25);
    expect(subMarks.is_published).toBe(false);
    expect(subMarks.status).toBe('DRAFT');
    expect(student.status).toBe('DRAFT');
    expect(student.status_label).toBe('Draft Marks');
  });

  it('assigns neutral combined performance categories without unapproved CIE failing thresholds', async () => {
    const mockUser = { id: 1, role: 'admin' };

    vi.spyOn(AcademicMonitoringService, 'getCohortAttendance').mockResolvedValueOnce({
      scope: { academic_year: '2026-27', branch: 'CSE', semester: 1 },
      pagination: { page: 1, total_pages: 1 },
      subjects: [],
      students: [
        {
          id: 1,
          roll_no: '24567T0901',
          name: 'Student Normal',
          branch: 'CSE',
          semester: 1,
          total_sessions: 20,
          attended_sessions: 18,
          attendance_percentage: 90.0,
          consecutive_absent_count: 0,
          status: 'GOOD_STANDING',
          status_label: 'Good Standing',
          subject_breakdown: {}
        },
        {
          id: 2,
          roll_no: '24567T0902',
          name: 'Student Low Att',
          branch: 'CSE',
          semester: 1,
          total_sessions: 20,
          attended_sessions: 14,
          attendance_percentage: 70.0,
          consecutive_absent_count: 2,
          status: 'ATTENDANCE_ATTENTION',
          status_label: 'Attendance Attention Required',
          subject_breakdown: {}
        }
      ]
    });

    vi.spyOn(AcademicMonitoringService, 'getCohortMarks').mockResolvedValueOnce({
      scope: { academic_year: '2026-27', branch: 'CSE', semester: 1 },
      pagination: { page: 1, total_pages: 1 },
      subjects: [],
      students: [
        {
          id: 1,
          average_cie_marks: 25.0,
          status: 'PUBLISHED',
          status_label: 'Marks Published',
          subject_breakdown: {}
        },
        {
          id: 2,
          average_cie_marks: null,
          status: 'NOT_ENTERED',
          status_label: 'Pending Evaluations',
          subject_breakdown: {}
        }
      ]
    });

    const result = await AcademicMonitoringService.getCombinedAcademicData({
      user: mockUser,
      branch: 'CSE',
      semester: 1,
      academicYear: '2026-27'
    });

    expect(result.students[0].combined_category).toBe('MARKS_AVAILABLE');
    expect(result.students[0].combined_label).toBe('Marks Available');
    expect(result.students[1].combined_category).toBe('ATTENDANCE_ATTENTION');
    expect(result.students[1].combined_label).toBe('Attendance Attention Required');
  });

  it('protects student drilldown against IDOR when student branch does not match authorized scope', async () => {
    const mockHODUser = { id: 202, role: 'faculty', is_hod: true, authorized_branches: ['CSE'] };

    // Student 50 has roll number 24567T1801 (18 = IT branch)
    db.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          id: 50,
          roll_no: '24567T1801',
          name: 'IT Student',
          admission_date: '2026-08-01'
        }
      ])
    }));

    await expect(
      AcademicMonitoringService.getStudentAcademicDetails({
        user: mockHODUser,
        studentId: 50,
        branch: 'CSE',
        semester: 1,
        academicYear: '2026-27'
      })
    ).rejects.toThrow(/Forbidden/);
  });
});
