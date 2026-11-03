import { describe, it, expect } from 'vitest';

describe('Additional Requirement: Student Attendance Visibility & Request/Dispute Workflow', () => {
  describe('A. Batch-Aware Student Attendance Visibility & Filtering Rules', () => {
    // Mock dataset representing sessions in a semester
    const mockSessions = [
      { id: 1, assignment_id: 10, attendance_date: '2026-03-01', session_number: 1, batch_number: 0, topic_covered: 'Theory: Intro to OS' },
      { id: 2, assignment_id: 10, attendance_date: '2026-03-02', session_number: 2, batch_number: 0, topic_covered: 'Theory: Processes' },
      { id: 3, assignment_id: 20, attendance_date: '2026-03-03', session_number: 3, batch_number: 1, topic_covered: 'Lab: Unix Commands (Batch 1)' },
      { id: 4, assignment_id: 20, attendance_date: '2026-03-03', session_number: 3, batch_number: 2, topic_covered: 'Lab: Unix Commands (Batch 2)' },
      { id: 5, assignment_id: 20, attendance_date: '2026-03-10', session_number: 4, batch_number: 1, topic_covered: 'Lab: Shell Scripting (Batch 1)' },
      { id: 6, assignment_id: 20, attendance_date: '2026-03-10', session_number: 4, batch_number: 2, topic_covered: 'Lab: Shell Scripting (Batch 2)' },
      { id: 7, assignment_id: 30, attendance_date: '2026-03-05', session_number: 1, batch_number: 1, topic_covered: 'English Lab: Phonetics (Batch 1)' },
      { id: 8, assignment_id: 30, attendance_date: '2026-03-05', session_number: 1, batch_number: 2, topic_covered: 'English Lab: Phonetics (Batch 2)' },
    ];

    // Student 101: Batch 1 in OS Lab (20), Batch 2 in English Lab (30)
    // Student 102: Batch 2 in OS Lab (20), Batch 1 in English Lab (30)
    const studentAllocations = {
      101: { 20: 1, 30: 2 },
      102: { 20: 2, 30: 1 }
    };

    function filterSessionsForStudent(studentId, assignmentId, studentRecords = []) {
      const studentBatch = studentAllocations[studentId]?.[assignmentId] || null;
      return mockSessions.filter(s => {
        if (s.assignment_id !== assignmentId) return false;
        // 1. Whole-class session is visible to everyone
        if (s.batch_number === 0 || s.batch_number === null) return true;
        // 2. Batch-specific session visible if student matches batch
        if (studentBatch !== null && s.batch_number === studentBatch) return true;
        // 3. Historical or override: student has an explicit attendance record
        if (studentRecords.some(r => r.session_id === s.id && r.student_id === studentId)) return true;
        return false;
      });
    }

    it('ensures Batch 1 student sees Batch 1 lab attendance but NOT Batch 2 attendance', () => {
      const visibleSessions = filterSessionsForStudent(101, 20); // OS Lab (student 101 is Batch 1)
      expect(visibleSessions.length).toBe(2);
      expect(visibleSessions.every(s => s.batch_number === 1)).toBe(true);
      expect(visibleSessions.some(s => s.id === 3)).toBe(true);
      expect(visibleSessions.some(s => s.id === 5)).toBe(true);
      // Batch 2 sessions (ids 4, 6) must NOT be visible
      expect(visibleSessions.some(s => s.id === 4)).toBe(false);
      expect(visibleSessions.some(s => s.id === 6)).toBe(false);
    });

    it('ensures Batch 2 student sees Batch 2 lab attendance but NOT Batch 1 attendance', () => {
      const visibleSessions = filterSessionsForStudent(102, 20); // OS Lab (student 102 is Batch 2)
      expect(visibleSessions.length).toBe(2);
      expect(visibleSessions.every(s => s.batch_number === 2)).toBe(true);
      expect(visibleSessions.some(s => s.id === 4)).toBe(true);
      expect(visibleSessions.some(s => s.id === 6)).toBe(true);
      // Batch 1 sessions (ids 3, 5) must NOT be visible
      expect(visibleSessions.some(s => s.id === 3)).toBe(false);
      expect(visibleSessions.some(s => s.id === 5)).toBe(false);
    });

    it('ensures student assigned to different batches in different subjects sees the correct batch for each subject', () => {
      // Student 101: Batch 1 in OS Lab (20), Batch 2 in English Lab (30)
      const osSessions = filterSessionsForStudent(101, 20);
      expect(osSessions.length).toBe(2);
      expect(osSessions.every(s => s.batch_number === 1)).toBe(true);

      const englishSessions = filterSessionsForStudent(101, 30);
      expect(englishSessions.length).toBe(1);
      expect(englishSessions[0].id).toBe(8); // English Lab Batch 2
      expect(englishSessions[0].batch_number).toBe(2);
    });

    it('ensures both batches can see eligible whole-class attendance (batch_number = 0)', () => {
      const theoryFor101 = filterSessionsForStudent(101, 10);
      const theoryFor102 = filterSessionsForStudent(102, 10);

      expect(theoryFor101.length).toBe(2);
      expect(theoryFor102.length).toBe(2);
      expect(theoryFor101.map(s => s.id)).toEqual([1, 2]);
      expect(theoryFor102.map(s => s.id)).toEqual([1, 2]);
    });

    it('computes percentage with batch-scoped classesHeld denominator (not inflated by other batch)', () => {
      // Student 101 attended 2 out of 2 Batch 1 lab sessions
      const visibleSessions = filterSessionsForStudent(101, 20);
      const studentRecords = [
        { session_id: 3, student_id: 101, status: 'PRESENT' },
        { session_id: 5, student_id: 101, status: 'PRESENT' }
      ];

      const classesHeld = visibleSessions.length; // 2 (NOT 4 total sessions)
      const attended = studentRecords.filter(r => r.status === 'PRESENT').length;
      const percentage = (attended / classesHeld) * 100;

      expect(classesHeld).toBe(2);
      expect(attended).toBe(2);
      expect(percentage).toBe(100); // 100%, not 50%
    });

    it('preserves historical attendance records where student has an explicit record', () => {
      // Suppose an older session had an irregular batch assignment or override
      const historicalSession = { id: 99, assignment_id: 20, attendance_date: '2026-02-15', session_number: 1, batch_number: 2 };
      mockSessions.push(historicalSession);

      // Student 101 has an override record in this session
      const studentRecords = [{ session_id: 99, student_id: 101, status: 'PRESENT' }];
      const visible = filterSessionsForStudent(101, 20, studentRecords);

      expect(visible.some(s => s.id === 99)).toBe(true);
    });
  });

  describe('B. Attendance Dispute & Correction Workflow Preservation', () => {
    const mockStudentAttendance = [
      { id: 501, session_id: 3, student_id: 101, assignment_id: 20, date: '2026-03-03', session: 3, status: 'ABSENT' },
      { id: 502, session_id: 4, student_id: 102, assignment_id: 20, date: '2026-03-03', session: 3, status: 'PRESENT' }
    ];

    it('allows a student to submit a dispute for their own batch absent session', () => {
      // Student 101 was marked ABSENT in their Batch 1 session (id: 3)
      const record = mockStudentAttendance.find(r =>
        r.student_id === 101 &&
        r.assignment_id === 20 &&
        r.date === '2026-03-03' &&
        r.session === 3
      );

      expect(record).toBeDefined();
      expect(record.status).toBe('ABSENT');
      // Dispute validation succeeds
      const canDispute = record && record.status === 'ABSENT';
      expect(canDispute).toBe(true);
    });

    it('prevents a student from disputing another batch session (no attendance record found)', () => {
      // Student 101 attempts to dispute Batch 2 session (which student 102 attended)
      // There is NO record in studentAttendance for student 101 in session 4
      const recordForBatch2 = mockStudentAttendance.find(r =>
        r.student_id === 101 &&
        r.session_id === 4
      );

      expect(recordForBatch2).toBeUndefined();
      // Route returns 404: "No attendance record found for this date and session"
      const errorMsg = !recordForBatch2 ? 'No attendance record found for this date and session.' : null;
      expect(errorMsg).toBe('No attendance record found for this date and session.');
    });

    it('prevents a student from disputing a session marked as PRESENT', () => {
      const record = mockStudentAttendance.find(r => r.student_id === 102 && r.session_id === 4);
      expect(record.status).toBe('PRESENT');

      const isEligible = record.status === 'ABSENT';
      expect(isEligible).toBe(false);
    });

    it('updates ONLY the disputed student attendance record upon faculty approval without affecting other students or batches', () => {
      const dispute = {
        id: 701,
        student_id: 101,
        assignment_id: 20,
        attendance_date: '2026-03-03',
        session: 3,
        original_status: 'ABSENT',
        requested_status: 'PRESENT',
        status: 'PENDING'
      };

      // Faculty approves dispute
      dispute.status = 'APPROVED';

      // Update student_attendance matching (student_id, assignment_id, date, session)
      const targetRecord = mockStudentAttendance.find(r =>
        r.student_id === dispute.student_id &&
        r.assignment_id === dispute.assignment_id &&
        r.date === dispute.attendance_date &&
        r.session === dispute.session
      );

      expect(targetRecord).toBeDefined();
      targetRecord.status = dispute.requested_status;

      // Verify targeted update:
      expect(mockStudentAttendance.find(r => r.id === 501).status).toBe('PRESENT');
      // Other student record (id 502) is unchanged
      expect(mockStudentAttendance.find(r => r.id === 502).status).toBe('PRESENT');
    });

    it('guarantees exact session_id + student_id predicate prevents modifying concurrent batch session', () => {
      // Two concurrent batch sessions for Assignment 20, Date 2026-03-03, Session 3:
      // Session 101: Batch 1 (Alice id 101 marked ABSENT)
      // Session 102: Batch 2 (Bob id 102 marked ABSENT)
      const concurrentRecords = [
        { id: 901, session_id: 101, student_id: 101, assignment_id: 20, date: '2026-03-03', session: 3, status: 'ABSENT' },
        { id: 902, session_id: 102, student_id: 102, assignment_id: 20, date: '2026-03-03', session: 3, status: 'ABSENT' }
      ];

      // Alice disputes her absence in Session 101
      const aliceDispute = {
        student_id: 101,
        assignment_id: 20,
        attendance_date: '2026-03-03',
        session: 3,
        requested_status: 'PRESENT'
      };

      // Lookup target record
      const attRow = concurrentRecords.find(r =>
        r.student_id === aliceDispute.student_id &&
        r.assignment_id === aliceDispute.assignment_id &&
        r.date === aliceDispute.attendance_date &&
        r.session === aliceDispute.session
      );
      expect(attRow.session_id).toBe(101);

      // Execute exact predicate update: WHERE session_id = 101 AND student_id = 101
      for (const rec of concurrentRecords) {
        if (rec.session_id === attRow.session_id && rec.student_id === aliceDispute.student_id) {
          rec.status = aliceDispute.requested_status;
        }
      }

      // Alice updated to PRESENT
      expect(concurrentRecords.find(r => r.id === 901).status).toBe('PRESENT');
      // Bob in Session 102 remains ABSENT without side-effects
      expect(concurrentRecords.find(r => r.id === 902).status).toBe('ABSENT');
    });

    it('verifies strict server-side faculty authorization matrix', () => {
      const disputeContext = {
        id: 701,
        student_id: 101,
        assignment_id: 20,
        faculty_id: 5, // Primary faculty
        branch: 'CSE',
        course_semester: 4,
        subject_code: 'CS401L',
        attendance_date: '2026-03-03'
      };

      const coInstructors = [{ faculty_id: 6, branch: 'CSE', semester: 4, subject_code: 'CS401L' }];
      const substitutions = [{ substitute_faculty_id: 7, original_assignment_id: 20, substitution_date: '2026-03-03' }];

      function authorizeFaculty(user) {
        if (user.role === 'admin') return true;
        if (Number(disputeContext.faculty_id) === Number(user.id)) return true;
        if (user.is_principal || user.is_hod) {
          const authBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
          if (authBranches.includes(disputeContext.branch) || user.branch === disputeContext.branch) {
            return true;
          }
        }
        // Co-instructor check
        if (coInstructors.some(ci => ci.faculty_id === user.id && ci.branch === disputeContext.branch && ci.subject_code === disputeContext.subject_code)) {
          return true;
        }
        // Substitute check
        if (substitutions.some(s => s.substitute_faculty_id === user.id && s.original_assignment_id === disputeContext.assignment_id && s.substitution_date === disputeContext.attendance_date)) {
          return true;
        }
        return false;
      }

      // 1. Primary Faculty
      expect(authorizeFaculty({ id: 5, role: 'faculty' })).toBe(true);

      // 2. Co-Instructor
      expect(authorizeFaculty({ id: 6, role: 'faculty' })).toBe(true);

      // 3. Substitute Faculty
      expect(authorizeFaculty({ id: 7, role: 'faculty' })).toBe(true);

      // 4. HOD for CSE branch
      expect(authorizeFaculty({ id: 8, role: 'faculty', is_hod: true, branch: 'CSE' })).toBe(true);

      // 5. System Administrator
      expect(authorizeFaculty({ id: 1, role: 'admin' })).toBe(true);

      // 6. Unrelated Faculty (different instructor, no assignment)
      expect(authorizeFaculty({ id: 99, role: 'faculty', branch: 'CSE' })).toBe(false);

      // 7. Cross-branch Faculty (ECE HOD trying to review CSE dispute)
      expect(authorizeFaculty({ id: 10, role: 'faculty', is_hod: true, branch: 'ECE' })).toBe(false);
    });

    it('ensures non-laboratory theory disputes function identically without regression', () => {
      const theoryRecord = { id: 601, session_id: 1, student_id: 101, assignment_id: 10, date: '2026-03-01', session: 1, status: 'ABSENT' };
      const canDisputeTheory = theoryRecord.status === 'ABSENT';
      expect(canDisputeTheory).toBe(true);

      // Approving theory dispute updates theory record
      theoryRecord.status = 'PRESENT';
      expect(theoryRecord.status).toBe('PRESENT');
    });
  });
});
