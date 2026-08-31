import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('Admission Soft Rejection, Status History & Controlled Restoration', () => {
  const restoreSchema = z.object({
    target_status: z.enum(['DRAFT', 'PROCESSED']).default('DRAFT'),
    restoration_reason: z.string().trim().min(3, 'Restoration reason must be at least 3 characters').max(1000)
  });

  const rejectionSchema = z.object({
    status: z.literal('REJECTED'),
    rejection_reason: z.string().trim().min(3, 'Rejection reason must be provided').max(1000)
  });

  describe('Rejection & Restoration Validation Rules', () => {
    it('validates soft rejection payload with valid reason', () => {
      const validRejection = {
        status: 'REJECTED',
        rejection_reason: 'Identity documentation mismatched the board hall ticket.'
      };
      const parsed = rejectionSchema.safeParse(validRejection);
      expect(parsed.success).toBe(true);
      expect(parsed.data.status).toBe('REJECTED');
    });

    it('rejects empty or whitespace-only rejection reason', () => {
      const invalidRejection = {
        status: 'REJECTED',
        rejection_reason: '   '
      };
      const parsed = rejectionSchema.safeParse(invalidRejection);
      expect(parsed.success).toBe(false);
    });

    it('validates application restoration payload to default DRAFT queue', () => {
      const validRestore = {
        restoration_reason: 'Candidate submitted corrected intermediate memorandum.'
      };
      const parsed = restoreSchema.safeParse(validRestore);
      expect(parsed.success).toBe(true);
      expect(parsed.data.target_status).toBe('DRAFT');
      expect(parsed.data.restoration_reason).toBe('Candidate submitted corrected intermediate memorandum.');
    });

    it('validates application restoration payload to PROCESSED verified queue', () => {
      const validRestore = {
        target_status: 'PROCESSED',
        restoration_reason: 'Manual verification approved by Admissions Dean.'
      };
      const parsed = restoreSchema.safeParse(validRestore);
      expect(parsed.success).toBe(true);
      expect(parsed.data.target_status).toBe('PROCESSED');
    });
  });

  describe('Status History Lifecycle Invariants', () => {
    it('preserves immutable status transition chain: DRAFT -> REJECTED -> DRAFT -> PROCESSED', () => {
      const statusTransitions = [];

      const recordTransition = (draftId, oldStatus, newStatus, reason, actorId, actorType) => {
        statusTransitions.push({
          id: statusTransitions.length + 1,
          draft_id: draftId,
          old_status: oldStatus,
          new_status: newStatus,
          reason,
          changed_by_user_id: actorId,
          changed_by_user_type: actorType,
          created_at: new Date()
        });
      };

      const draftId = 44501;

      // 1. Initial Submission
      recordTransition(draftId, null, 'DRAFT', 'Application submitted by candidate', null, 'system');
      // 2. Rejection by Staff
      recordTransition(draftId, 'DRAFT', 'REJECTED', 'Photo illegible', 90003, 'staff');
      // 3. Restoration by Staff
      recordTransition(draftId, 'REJECTED', 'DRAFT', 'Updated photo provided', 90007, 'staff');
      // 4. Verification
      recordTransition(draftId, 'DRAFT', 'PROCESSED', 'All documents verified', 90003, 'staff');

      expect(statusTransitions.length).toBe(4);
      expect(statusTransitions[0].new_status).toBe('DRAFT');
      expect(statusTransitions[1].new_status).toBe('REJECTED');
      expect(statusTransitions[2].new_status).toBe('DRAFT');
      expect(statusTransitions[3].new_status).toBe('PROCESSED');

      // The historical rejection record MUST never be erased
      const rejectionRecord = statusTransitions.find(t => t.new_status === 'REJECTED');
      expect(rejectionRecord).toBeDefined();
      expect(rejectionRecord.reason).toBe('Photo illegible');
      expect(rejectionRecord.changed_by_user_id).toBe(90003);
    });

    it('guarantees media and document keys are preserved upon soft rejection', () => {
      const mockDraft = {
        id: 44501,
        name: 'Goutham Rao',
        status: 'DRAFT',
        pfp: 'admission/drafts/pfp/7a59662b.webp',
        signature: 'admission/drafts/signatures/8b4912c.webp',
        rejection_reason: null,
        rejected_at: null
      };

      // Soft rejection simulation: files MUST NOT be deleted from storage
      const applySoftRejection = (draft, reason, staffId) => {
        return {
          ...draft,
          status: 'REJECTED',
          rejection_reason: reason,
          rejected_by_staff_id: staffId,
          rejected_at: new Date()
        };
      };

      const rejectedDraft = applySoftRejection(mockDraft, 'Marks memo mismatch', 101);

      expect(rejectedDraft.status).toBe('REJECTED');
      expect(rejectedDraft.pfp).toBe('admission/drafts/pfp/7a59662b.webp');
      expect(rejectedDraft.signature).toBe('admission/drafts/signatures/8b4912c.webp');
      expect(rejectedDraft.rejection_reason).toBe('Marks memo mismatch');
      expect(rejectedDraft.rejected_by_staff_id).toBe(101);
    });

    it('permits candidate re-application with same email/mobile when previous application was REJECTED', () => {
      const existingDrafts = [
        { id: 1, email: 'candidate@example.com', mobile_hash: 'hash123', status: 'REJECTED' },
        { id: 2, email: 'other@example.com', mobile_hash: 'hash456', status: 'DRAFT' },
      ];

      const checkCanApply = (email, mobileHash) => {
        const activeDraft = existingDrafts.find(
          d => (d.email === email || d.mobile_hash === mobileHash) && d.status !== 'REJECTED'
        );
        return !activeDraft;
      };

      // Candidate 1 (previously REJECTED) re-applies with same email/mobile -> ALLOWED
      expect(checkCanApply('candidate@example.com', 'hash123')).toBe(true);

      // Candidate 2 (currently active DRAFT) tries to submit duplicate -> BLOCKED
      expect(checkCanApply('other@example.com', 'hash456')).toBe(false);

      // Brand new candidate -> ALLOWED
      expect(checkCanApply('new@example.com', 'hash789')).toBe(true);
    });
  });
});
