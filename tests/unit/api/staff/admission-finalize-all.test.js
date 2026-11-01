import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mocks
let mockUser = null;
let mockTx = null;

const createMockTx = () => ({
  select: vi.fn(),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ affectedRows: 1 }])
    })
  })
});

const sampleDraft = {
  id: 42,
  name: 'TEST STUDENT',
  email: 'test@student.kucet.edu',
  student_mobile: 'enc-mobile',
  guardian_mobile: 'enc-parent',
  dob: '2006-08-15',
  admission_date: '2026-07-01',
  branch: 'CSE',
  entrance_exam: 'TG EAPCET',
  admission_year: 2026,
  status: 'PROCESSED',
};

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
    update: vi.fn(),
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    runWithContext: vi.fn((ctx, fn) => fn()),
  }
}));

vi.mock('@/lib/email', () => ({
  sendInstitutionalEmail: vi.fn().mockResolvedValue({ success: true }),
  getBaseUrl: vi.fn().mockReturnValue('https://kucet.ac.in'),
  EMAIL_CATEGORIES: { ADMISSIONS: 'ADMISSIONS' },
}));

vi.mock('@/lib/sse', () => ({
  broadcastUpdate: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/services/AdmissionFinalizationService', () => ({
  AdmissionFinalizationService: {
    handleDraftFinalized: vi.fn().mockResolvedValue(true),
  }
}));

vi.mock('@/services/StudentService', () => ({
  StudentService: {
    upsertStudent: vi.fn().mockResolvedValue(101),
  }
}));

vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn(val => val ? `decrypted-${val}` : null),
}));

vi.mock('@/lib/address-utils', () => ({
  getPermanentAddressFromDetails: vi.fn(() => '1-23, Subhash Nagar, Warangal, 506009'),
  getContactAddressFromDetails: vi.fn(() => '1-23, Subhash Nagar, Warangal, 506009'),
}));

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    wrapHandler: ({ auth, handler, audit: _audit }) => {
      return async (req, context = {}) => {
        if (auth && !mockUser) {
          return actual.apiError('Unauthorized', 401);
        }
        try {
          const res = await handler(req, { user: mockUser, context });
          return res instanceof Response ? res : actual.apiResponse(res);
        } catch (err) {
          return actual.apiError(err.message || 'Internal Server Error', 500);
        }
      };
    },
  };
});

import { 
  finalizeAdmissionDraft, 
  bulkFinalizeAdmissionDrafts 
} from '@/services/admission/AdmissionDraftFinalizeService';
import { sendInstitutionalEmail } from '@/lib/email';
import { broadcastUpdate } from '@/lib/sse';
import { AdmissionFinalizationService } from '@/services/AdmissionFinalizationService';
import { StudentService } from '@/services/StudentService';
import { POST as bulkFinalizePOST } from '@/app/api/staff/admission/drafts/bulk-finalize/route';

describe('AdmissionDraftFinalizeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockTx = createMockTx();
  });

  describe('finalizeAdmissionDraft', () => {
    it('throws INVALID_ROLL_NO when roll number format is invalid', async () => {
      await expect(finalizeAdmissionDraft({
        draftId: 42,
        rollNo: 'INVALID_ROLL',
        user: { id: 1, role: 'admission' },
        tx: mockTx
      })).rejects.toThrow('INVALID_ROLL_NO');
    });

    it('throws DRAFT_NOT_FOUND when draft does not exist', async () => {
      mockTx.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockResolvedValue([]) // No rows
          })
        })
      });

      await expect(finalizeAdmissionDraft({
        draftId: 999,
        rollNo: '26567T0901',
        user: { id: 1, role: 'admission' },
        tx: mockTx
      })).rejects.toThrow('DRAFT_NOT_FOUND');
    });

    it('throws DRAFT_NOT_VERIFIED when draft status is not PROCESSED', async () => {
      mockTx.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockResolvedValue([{ ...sampleDraft, status: 'PENDING' }])
          })
        })
      });

      await expect(finalizeAdmissionDraft({
        draftId: 42,
        rollNo: '26567T0901',
        user: { id: 1, role: 'admission' },
        tx: mockTx
      })).rejects.toThrow('DRAFT_NOT_VERIFIED');
    });

    it('throws ROLL_BRANCH_MISMATCH when roll number branch does not match draft branch', async () => {
      mockTx.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockResolvedValue([sampleDraft])
          })
        })
      });

      await expect(finalizeAdmissionDraft({
        draftId: 42,
        rollNo: '26567T0001', // CIVIL roll
        user: { id: 1, role: 'admission' },
        tx: mockTx
      })).rejects.toThrow('ROLL_BRANCH_MISMATCH');
    });

    it('throws ROLL_TYPE_MISMATCH when regular roll is given for ECET Lateral draft', async () => {
      mockTx.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockResolvedValue([{ ...sampleDraft, entrance_exam: 'TG ECET' }])
          })
        })
      });

      await expect(finalizeAdmissionDraft({
        draftId: 42,
        rollNo: '26567T0901',
        user: { id: 1, role: 'admission' },
        tx: mockTx
      })).rejects.toThrow('ROLL_TYPE_MISMATCH');
    });

    it('throws STUDENT_EXISTS when a student with this roll number already exists', async () => {
      let callCount = 0;
      mockTx.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return { for: vi.fn().mockResolvedValue([sampleDraft]) };
            } else {
              return { limit: vi.fn().mockResolvedValue([{ id: 99 }]) };
            }
          })
        })
      }));

      await expect(finalizeAdmissionDraft({
        draftId: 42,
        rollNo: '26567T0901',
        user: { id: 1, role: 'admission' },
        tx: mockTx
      })).rejects.toThrow('STUDENT_EXISTS');
    });

    it('successfully finalizes draft, creates student, sends welcome email and broadcasts update', async () => {
      let callCount = 0;
      mockTx.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return { for: vi.fn().mockResolvedValue([sampleDraft]) };
            } else {
              return { limit: vi.fn().mockResolvedValue([]) };
            }
          })
        })
      }));

      const res = await finalizeAdmissionDraft({
        draftId: 42,
        rollNo: '26567T0901',
        admissionDateInput: '2026-08-01',
        user: { id: 5, staffId: 'STF001', role: 'admission' },
        tx: mockTx
      });

      expect(res.success).toBe(true);
      expect(res.studentId).toBe(101);
      expect(res.rollNo).toBe('26567T0901');

      expect(StudentService.upsertStudent).toHaveBeenCalledWith(
        expect.objectContaining({
          roll_no: '26567T0901',
          name: sampleDraft.name,
          email: sampleDraft.email,
        }),
        'STF001',
        mockTx
      );

      expect(mockTx.update).toHaveBeenCalled();

      expect(sendInstitutionalEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: sampleDraft.email,
          subject: 'Welcome to KUCET! Your Account is Active',
          action: expect.objectContaining({
            label: 'Login to Student Portal',
            url: 'https://kucet.ac.in/student',
          }),
        })
      );

      expect(broadcastUpdate).toHaveBeenCalledWith(
        'ADMISSION_DRAFT_FINALIZED',
        expect.objectContaining({
          id: 42,
          studentId: 101,
          rollNo: '26567T0901',
          branch: 'CSE',
        })
      );

      expect(AdmissionFinalizationService.handleDraftFinalized).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: 'CSE',
          admissionYear: 2026,
        })
      );
    });
  });

  describe('bulkFinalizeAdmissionDrafts', () => {
    it('returns empty summary when items array is empty', async () => {
      const result = await bulkFinalizeAdmissionDrafts({ items: [], user: { id: 1 } });
      expect(result.success).toBe(false);
      expect(result.total).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toEqual([]);
    });

    it('processes items in order, recording success and handling individual errors gracefully', async () => {
      const items = [
        { draftId: 1, roll_no: '26567T0901' },
        { draftId: 2, roll_no: 'INVALID_ROLL_FORMAT' },
      ];

      let callCount = 0;
      mockTx.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return { for: vi.fn().mockResolvedValue([{ ...sampleDraft, id: 1 }]) };
            } else {
              return { limit: vi.fn().mockResolvedValue([]) };
            }
          })
        })
      }));

      const { db } = await import('@/db');
      db.transaction = vi.fn(async (cb) => cb(mockTx));

      const result = await bulkFinalizeAdmissionDrafts({
        items,
        user: { id: 1, role: 'admission' }
      });

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.success).toBe(false);

      expect(result.results[0]).toEqual(expect.objectContaining({
        draftId: 1,
        rollNo: '26567T0901',
        success: true,
      }));

      expect(result.results[1]).toEqual(expect.objectContaining({
        draftId: 2,
        rollNo: 'INVALID_ROLL_FORMAT',
        success: false,
        error: 'Invalid roll number format.',
      }));
    });
  });
});

describe('Bulk Finalize Route (/api/staff/admission/drafts/bulk-finalize)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockTx = createMockTx();
  });

  it('rejects unauthenticated users with 401 Unauthorized', async () => {
    mockUser = null;
    const req = new Request('http://localhost/api/staff/admission/drafts/bulk-finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ draftId: 1, roll_no: '26567T0901' }] }),
    });

    const res = await bulkFinalizePOST(req);
    expect(res.status).toBe(401);
  });

  it('rejects student role with 403 Forbidden', async () => {
    mockUser = { id: 10, role: 'student' };
    const req = new Request('http://localhost/api/staff/admission/drafts/bulk-finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ draftId: 1, roll_no: '26567T0901' }] }),
    });

    const res = await bulkFinalizePOST(req);
    expect(res.status).toBe(403);
  });

  it('rejects empty items with 400 Bad Request', async () => {
    mockUser = { id: 1, role: 'admission', email: 'admission@kucet.ac.in' };
    const req = new Request('http://localhost/api/staff/admission/drafts/bulk-finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    });

    const res = await bulkFinalizePOST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('At least one draft item is required');
  });

  it('successfully bulk finalizes admissions via POST and returns 200', async () => {
    mockUser = { id: 1, role: 'admission', email: 'admission@kucet.ac.in' };
    const items = [
      { draftId: 1, roll_no: '26567T0901' },
      { draftId: 2, roll_no: '26567T0902' }
    ];

    let callCount = 0;
    mockTx.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount % 2 === 1) {
            return { for: vi.fn().mockResolvedValue([{ ...sampleDraft, id: callCount }]) };
          } else {
            return { limit: vi.fn().mockResolvedValue([]) };
          }
        })
      })
    }));

    const { db } = await import('@/db');
    db.transaction = vi.fn(async (cb) => cb(mockTx));

    const req = new Request('http://localhost/api/staff/admission/drafts/bulk-finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });

    const res = await bulkFinalizePOST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.total).toBe(2);
    expect(body.successful).toBe(2);
  });
});

describe('Finalize Admissions UI Integration', () => {
  it('verifies Finalize Admission page contains Finalize All button in table header with Operational Actions', () => {
    const pagePath = path.resolve(__dirname, '../../../../src/app/staff/admission/finalize/page.js');
    const content = fs.readFileSync(pagePath, 'utf-8');

    expect(content).not.toContain('Operational Actions');
    expect(content).toContain('id="finalize-all-btn"');
    expect(content).toContain('Finalize All');
    expect(content).toContain('allRollNumbersFilled');
    expect(content).toContain('!allRollNumbersFilled');
    expect(content).toContain('<FinalizeAllPreviewModal');
  });

  it('verifies FinalizeAllPreviewModal component exists and provides roll number mapping', () => {
    const modalPath = path.resolve(__dirname, '../../../../src/components/staff/admission/FinalizeAllPreviewModal.js');
    const modalContent = fs.readFileSync(modalPath, 'utf-8');

    expect(modalContent).toContain('Finalize All Admissions');
    expect(modalContent).toContain('Roll Number Mapping');
    expect(modalContent).toContain('Applicant Name');
    expect(modalContent).toContain('Institutional Roll Number');
    expect(modalContent).toContain('Confirm & Finalize All');
  });
});
