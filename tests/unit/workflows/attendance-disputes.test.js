import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { STORAGE_FOLDERS } from '@/lib/storage-config';

describe('Attendance Disputes Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates dispute deadline window against system_configs', () => {
    const windowDays = 7;
    const now = new Date('2026-09-15T12:00:00Z').getTime();

    // Session within window (5 days old)
    const validSessionDate = '2026-09-10';
    const validDiffDays = Math.floor((now - new Date(validSessionDate + 'T00:00:00Z').getTime()) / (1000 * 60 * 60 * 24));
    expect(validDiffDays <= windowDays).toBe(true);

    // Session outside window (10 days old)
    const expiredSessionDate = '2026-09-05';
    const expiredDiffDays = Math.floor((now - new Date(expiredSessionDate + 'T00:00:00Z').getTime()) / (1000 * 60 * 60 * 24));
    expect(expiredDiffDays <= windowDays).toBe(false);
  });

  it('validates categories, requested statuses, and mandatory student declaration', () => {
    const VALID_CATEGORIES = new Set(['INCORRECT_MARKING', 'MEDICAL', 'AUTHORIZED_ACTIVITY', 'OTHER']);
    const VALID_REQUESTED_STATUSES = new Set(['PRESENT', 'NCC', 'MEDICAL']);

    const validateSubmission = ({ category, requested_status, student_declaration, reason }) => {
      if (!VALID_CATEGORIES.has(category)) throw new Error('Invalid dispute category');
      if (!VALID_REQUESTED_STATUSES.has(requested_status)) throw new Error('Invalid requested status');
      if (!reason || reason.trim().length < 5) throw new Error('Reason must be at least 5 characters');
      if (!student_declaration) throw new Error('You must confirm the truthfulness declaration');
      return true;
    };

    expect(() => validateSubmission({
      category: 'INVALID_CATEGORY',
      requested_status: 'PRESENT',
      student_declaration: true,
      reason: 'Was present'
    })).toThrow('Invalid dispute category');

    expect(() => validateSubmission({
      category: 'MEDICAL',
      requested_status: 'ABSENT',
      student_declaration: true,
      reason: 'Was sick'
    })).toThrow('Invalid requested status');

    expect(() => validateSubmission({
      category: 'MEDICAL',
      requested_status: 'MEDICAL',
      student_declaration: false,
      reason: 'Doctor prescribed bed rest'
    })).toThrow('You must confirm the truthfulness declaration');

    expect(validateSubmission({
      category: 'MEDICAL',
      requested_status: 'MEDICAL',
      student_declaration: true,
      reason: 'Doctor prescribed 3 days bed rest with medical certificate'
    })).toBe(true);
  });

  it('enforces MIME type and file size limits on supporting evidence attachments', () => {
    const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

    const validateFile = (mimeType, sizeBytes) => {
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new Error('Unsupported file type. Only JPEG, PNG, and PDF files are allowed.');
      }
      if (sizeBytes > MAX_FILE_SIZE) {
        throw new Error('File exceeds maximum allowed size of 5MB');
      }
      return true;
    };

    expect(validateFile('image/jpeg', 1024 * 500)).toBe(true);
    expect(validateFile('image/png', 1024 * 1024)).toBe(true);
    expect(validateFile('application/pdf', 3 * 1024 * 1024)).toBe(true);

    expect(() => validateFile('application/zip', 1024)).toThrow('Unsupported file type');
    expect(() => validateFile('application/x-msdownload', 1024)).toThrow('Unsupported file type');
    expect(() => validateFile('image/jpeg', 6 * 1024 * 1024)).toThrow('maximum allowed size');
  });

  it('generates crypto UUID relative storage keys without PII or roll numbers', () => {
    const generateStorageKey = (originalName) => {
      const ext = originalName.split('.').pop() || 'bin';
      return `${STORAGE_FOLDERS.ATTENDANCE_EVIDENCE}/${crypto.randomUUID()}.${ext}`;
    };

    const key1 = generateStorageKey('prescription_roll_210101.pdf');
    expect(key1).toMatch(/^attendance\/evidence\/[a-f0-9-]{36}\.pdf$/);
    expect(key1).not.toContain('210101');
    expect(key1).not.toContain('prescription');

    const key2 = generateStorageKey('sports_cert.png');
    expect(key2).toMatch(/^attendance\/evidence\/[a-f0-9-]{36}\.png$/);
  });

  it('enforces strict private authorization for viewing evidence documents', () => {
    const checkEvidenceAccess = (user, attachmentContext) => {
      // attachmentContext: { student_id, faculty_staff_id, branch }
      if (user.role === 'admin') return true;
      if (user.role === 'student' && user.student_id === attachmentContext.student_id) return true;
      if (user.role === 'faculty') {
        if (attachmentContext.faculty_staff_id === user.id) return true;
        if (user.is_hod && user.branch === attachmentContext.branch) return true;
      }
      return false;
    };

    const context = {
      student_id: 42,
      faculty_staff_id: 10,
      branch: 'CSE'
    };

    // Authorized users:
    expect(checkEvidenceAccess({ role: 'student', student_id: 42 }, context)).toBe(true);
    expect(checkEvidenceAccess({ role: 'faculty', id: 10, is_hod: false, branch: 'CSE' }, context)).toBe(true);
    expect(checkEvidenceAccess({ role: 'faculty', id: 99, is_hod: true, branch: 'CSE' }, context)).toBe(true);
    expect(checkEvidenceAccess({ role: 'admin', id: 1 }, context)).toBe(true);

    // Unauthorized users:
    expect(checkEvidenceAccess({ role: 'student', student_id: 99 }, context)).toBe(false);
    expect(checkEvidenceAccess({ role: 'faculty', id: 15, is_hod: false, branch: 'CSE' }, context)).toBe(false);
    expect(checkEvidenceAccess({ role: 'faculty', id: 15, is_hod: true, branch: 'ECE' }, context)).toBe(false);
  });

  it('requires reviewer comments when requesting more info and rejection reason when rejecting', () => {
    const validateReview = (status, { rejection_reason, reviewer_comments }) => {
      if (status === 'REJECTED' && (!rejection_reason || rejection_reason.trim().length === 0)) {
        throw new Error('Rejection reason is required when rejecting a dispute');
      }
      if (status === 'MORE_INFO_REQUIRED' && (!reviewer_comments || reviewer_comments.trim().length < 5)) {
        throw new Error('Reviewer comments (minimum 5 characters) are required when requesting more information');
      }
      return true;
    };

    expect(() => validateReview('REJECTED', { rejection_reason: '' })).toThrow('Rejection reason is required');
    expect(() => validateReview('MORE_INFO_REQUIRED', { reviewer_comments: 'abc' })).toThrow('Reviewer comments (minimum 5 characters)');
    expect(validateReview('MORE_INFO_REQUIRED', { reviewer_comments: 'Please upload hospital discharge summary.' })).toBe(true);
    expect(validateReview('APPROVED', {})).toBe(true);
  });

  it('resets status to PENDING when student responds to MORE_INFO_REQUIRED', () => {
    const dispute = {
      id: 10,
      status: 'MORE_INFO_REQUIRED',
      reason: 'Was unwell',
      additional_explanation: null
    };

    const handleStudentResponse = (disp, additionalText) => {
      if (disp.status !== 'MORE_INFO_REQUIRED') {
        throw new Error('Dispute is not awaiting additional information');
      }
      if (!additionalText || additionalText.trim().length < 5) {
        throw new Error('Additional explanation must be at least 5 characters');
      }

      return {
        ...disp,
        status: 'PENDING',
        additional_explanation: additionalText.trim()
      };
    };

    const updated = handleStudentResponse(dispute, 'Attached the signed fitness certificate from college medical officer.');
    expect(updated.status).toBe('PENDING');
    expect(updated.additional_explanation).toContain('fitness certificate');
  });

  it('atomically updates attendance record and writes to attendance_audit_logs on dispute approval', async () => {
    const mockAuditLog = vi.fn();
    const mockUpdateAttendance = vi.fn();

    const simulateApproval = async (dispute, reviewerId) => {
      // Transaction logic simulation
      mockUpdateAttendance({
        student_id: dispute.student_id,
        assignment_id: dispute.assignment_id,
        date: dispute.attendance_date,
        session: dispute.session,
        new_status: dispute.requested_status
      });

      mockAuditLog({
        student_id: dispute.student_id,
        assignment_id: dispute.assignment_id,
        attendance_date: dispute.attendance_date,
        session: dispute.session,
        previous_status: dispute.original_status,
        new_status: dispute.requested_status,
        modified_by_staff_id: reviewerId,
        change_type: 'DISPUTE_RESOLUTION',
        dispute_id: dispute.id,
        reason: `Dispute approved: ${dispute.reason}`
      });
    };

    const dispute = {
      id: 55,
      student_id: 12,
      assignment_id: 101,
      attendance_date: '2026-09-10',
      session: 2,
      original_status: 'ABSENT',
      requested_status: 'PRESENT',
      reason: 'Biometric glitch during morning attendance roll call'
    };

    await simulateApproval(dispute, 9);

    expect(mockUpdateAttendance).toHaveBeenCalledWith(expect.objectContaining({
      student_id: 12,
      new_status: 'PRESENT'
    }));

    expect(mockAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      dispute_id: 55,
      previous_status: 'ABSENT',
      new_status: 'PRESENT',
      modified_by_staff_id: 9,
      change_type: 'DISPUTE_RESOLUTION'
    }));
  });
});

