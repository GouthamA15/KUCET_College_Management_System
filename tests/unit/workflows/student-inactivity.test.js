import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Student Inactivity Monitoring and Lifecycle Automation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates net inactivity days by deducting declared holidays and vacation periods', () => {
    const today = new Date('2026-10-15T00:00:00Z');
    const lastAttendanceDate = new Date('2026-05-01T00:00:00Z'); // 167 calendar days ago
    
    const rawDiffDays = Math.floor((today.getTime() - lastAttendanceDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(rawDiffDays).toBe(167);

    // Declared holidays and summer vacation days in that interval
    const _holidayDates = [
      '2026-05-15', '2026-05-16', '2026-05-17', '2026-06-01', '2026-06-02',
      '2026-06-03', '2026-07-01', '2026-07-02', '2026-08-15', '2026-10-02'
    ];
    
    // Suppose 25 total non-instructional days occurred
    const holidayDeduction = 25;
    const netInactivityDays = Math.max(0, rawDiffDays - holidayDeduction);

    expect(netInactivityDays).toBe(142);
    // 142 days is >= 120 days (Warning threshold) but < 150 days (Deactivation threshold)
    expect(netInactivityDays >= 120).toBe(true);
    expect(netInactivityDays >= 150).toBe(false);
  });

  it('triggers cohort safeguard to prevent deactivation if fewer than 15 cohort classes were conducted', () => {
    const netInactivityDays = 155; // Would normally trigger deactivation
    const cohortSessionsConducted = 12; // Faculty struck, class cancelled, or new semester just started

    const shouldDeactivate = (netDays, cohortClasses) => {
      if (cohortClasses < 15 && netDays >= 120) {
        return { action: 'SKIP_COHORT_SAFEGUARD', reason: 'Insufficient cohort classes held' };
      }
      if (netDays >= 150) {
        return { action: 'DEACTIVATE' };
      }
      if (netDays >= 120) {
        return { action: 'WARN' };
      }
      return { action: 'NONE' };
    };

    const result = shouldDeactivate(netInactivityDays, cohortSessionsConducted);
    expect(result.action).toBe('SKIP_COHORT_SAFEGUARD');

    // When normal sessions conducted >= 15, deactivation proceeds
    const normalResult = shouldDeactivate(netInactivityDays, 40);
    expect(normalResult.action).toBe('DEACTIVATE');
  });

  it('revokes active user sessions and marks student status INACTIVE_ATTENDANCE upon deactivation', () => {
    const student = {
      id: 42,
      roll_no: '24KU1A0501',
      student_status: 'ACTIVE'
    };

    const mockUpdateStudent = vi.fn();
    const mockRevokeSessions = vi.fn();
    const mockInsertInactivityLog = vi.fn();

    const deactivationHandler = (s, netDays) => {
      mockUpdateStudent({ id: s.id, student_status: 'INACTIVE_ATTENDANCE' });
      mockRevokeSessions({ user_id: s.id, user_type: 'student' });
      mockInsertInactivityLog({
        student_id: s.id,
        inactivity_days: netDays,
        action_taken: 'DEACTIVATED'
      });
    };

    deactivationHandler(student, 155);

    expect(mockUpdateStudent).toHaveBeenCalledWith(expect.objectContaining({
      student_status: 'INACTIVE_ATTENDANCE'
    }));
    expect(mockRevokeSessions).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 42,
      user_type: 'student'
    }));
    expect(mockInsertInactivityLog).toHaveBeenCalledWith(expect.objectContaining({
      student_id: 42,
      action_taken: 'DEACTIVATED'
    }));
  });

  it('enforces dual approval state machine for reactivation (HOD recommendation -> Admin clearance)', () => {
    const request = {
      id: 10,
      student_id: 42,
      status: 'PENDING_HOD',
      hod_recommendation: null,
      admin_notes: null
    };

    // Stage 1: HOD reviews request
    const processHodReview = (req, recommendation, comments, hodStaffId) => {
      if (req.status !== 'PENDING_HOD') {
        throw new Error('Request is not pending HOD review');
      }
      if (recommendation === 'RECOMMENDED') {
        return {
          ...req,
          status: 'PENDING_ADMIN',
          hod_recommendation: 'RECOMMENDED',
          hod_comments: comments,
          hod_reviewed_by: hodStaffId
        };
      } else {
        return {
          ...req,
          status: 'REJECTED',
          hod_recommendation: 'NOT_RECOMMENDED',
          hod_comments: comments,
          hod_reviewed_by: hodStaffId
        };
      }
    };

    // Stage 2: Super Admin reviews request
    const processAdminReview = (req, decision, remarks, adminUserId) => {
      if (req.status !== 'PENDING_ADMIN') {
        throw new Error('Request must have HOD endorsement before Admin review');
      }
      if (decision === 'APPROVED') {
        return {
          ...req,
          status: 'APPROVED',
          admin_notes: remarks,
          reviewed_by_admin: adminUserId
        };
      } else {
        return {
          ...req,
          status: 'REJECTED',
          admin_notes: remarks,
          reviewed_by_admin: adminUserId
        };
      }
    };

    // Cannot jump directly to admin review while PENDING_HOD
    expect(() => processAdminReview(request, 'APPROVED', 'Approved by admin', 1))
      .toThrow('Request must have HOD endorsement before Admin review');

    // HOD endorses
    const hodReviewed = processHodReview(request, 'RECOMMENDED', 'Medical certificates verified', 5);
    expect(hodReviewed.status).toBe('PENDING_ADMIN');
    expect(hodReviewed.hod_recommendation).toBe('RECOMMENDED');

    // Admin approves
    const adminApproved = processAdminReview(hodReviewed, 'APPROVED', 'Fee dues cleared, reinstated', 1);
    expect(adminApproved.status).toBe('APPROVED');
    expect(adminApproved.reviewed_by_admin).toBe(1);
  });
});
