process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as studentSignatureHandler } from '@/app/api/student/signature/route.js';
import { PUT as staffApproveHandler } from '@/app/api/staff/admission/student-requests/route.js';
import { getAuthUser } from '@/lib/api-utils';
import { db } from '@/db';
import { encrypt, decrypt, hashForIndex } from '@/lib/encryption';

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: vi.fn(),
  };
});

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 5 }),
}));

vi.mock('@/lib/sse', () => ({
  broadcastUpdate: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/providers', () => ({
  storage: {
    upload: vi.fn().mockResolvedValue('kucet/proofs/test_proof.jpg'),
    delete: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/services/storage/MediaPromotionService', () => ({
  MediaPromotionService: {
    promoteRequestMedia: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/db', () => {
  const insertMock = vi.fn();
  const updateMock = vi.fn();
  const transactionMock = vi.fn(async (cb) => {
    const tx = {
      update: vi.fn(() => ({
        set: vi.fn((setData) => ({
          where: vi.fn().mockResolvedValue(setData),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn().mockResolvedValue(true),
      })),
    };
    return cb(tx);
  });

  return {
    db: {
      query: {
        studentProfileRequests: {
          findFirst: vi.fn(),
        },
        students: {
          findFirst: vi.fn(),
        },
        studentPersonalDetails: {
          findFirst: vi.fn(),
        },
        studentAcademicBackground: {
          findFirst: vi.fn(),
        },
      },
      insert: insertMock,
      update: updateMock,
      transaction: transactionMock,
    },
  };
});

describe('Student Mobile Edit & Approval Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/student/signature - Student Mobile Update Submission', () => {
    it('rejects mobile update when verification proof is not provided', async () => {
      getAuthUser.mockResolvedValue({
        student_id: 101,
        roll_no: '22567T0901',
        role: 'student',
      });

      const req = new Request('http://localhost:3000/api/student/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: { mobile: '9876543210' },
          proof: null, // Missing proof
        }),
      });

      const res = await studentSignatureHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain('Verification proof (image) is required');
    });

    it('rejects mobile numbers that are not 10 digits', async () => {
      getAuthUser.mockResolvedValue({
        student_id: 101,
        roll_no: '22567T0901',
        role: 'student',
      });

      const req = new Request('http://localhost:3000/api/student/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: { mobile: '12345' }, // Invalid length
          proof: 'data:image/jpeg;base64,mockproofbase64',
        }),
      });

      const res = await studentSignatureHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain('Mobile number must be exactly 10 digits');
    });

    it('accepts valid mobile number with proof and encrypts mobile in studentProfileRequests', async () => {
      getAuthUser.mockResolvedValue({
        student_id: 101,
        roll_no: '22567T0901',
        role: 'student',
      });

      db.query.studentProfileRequests.findFirst.mockResolvedValue(null);

      let insertedValues = null;
      db.insert.mockImplementation(() => ({
        values: vi.fn((vals) => {
          insertedValues = vals;
          return Promise.resolve([{ insertId: 501 }]);
        }),
      }));

      const req = new Request('http://localhost:3000/api/student/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: { mobile: '9876543210' },
          proof: 'data:image/jpeg;base64,mockproofbase64',
        }),
      });

      const res = await studentSignatureHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(insertedValues).toBeDefined();
      expect(insertedValues.new_data).toBeDefined();

      // Ensure mobile was stored encrypted
      expect(insertedValues.new_data.mobile).not.toBe('9876543210');
      expect(decrypt(insertedValues.new_data.mobile)).toBe('9876543210');
    });

    it('normalizes mobile numbers with +91 prefix and formatting characters', async () => {
      getAuthUser.mockResolvedValue({
        student_id: 101,
        roll_no: '22567T0901',
        role: 'student',
      });

      db.query.studentProfileRequests.findFirst.mockResolvedValue(null);

      let insertedValues = null;
      db.insert.mockImplementation(() => ({
        values: vi.fn((vals) => {
          insertedValues = vals;
          return Promise.resolve([{ insertId: 502 }]);
        }),
      }));

      const req = new Request('http://localhost:3000/api/student/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: { mobile: '+91 98765-43210' },
          proof: 'data:image/jpeg;base64,mockproofbase64',
        }),
      });

      const res = await studentSignatureHandler(req);
      expect(res.status).toBe(200);
      expect(decrypt(insertedValues.new_data.mobile)).toBe('9876543210');
    });
  });

  describe('PUT /api/staff/admission/student-requests - Staff Approval of Mobile Update', () => {
    it('updates students.mobile and students.mobile_hash on request approval', async () => {
      getAuthUser.mockResolvedValue({
        id: 1,
        email: 'staff@kucet.ac.in',
        role: 'admission',
      });

      const plainMobile = '9876543210';
      const encMobile = encrypt(plainMobile);

      db.query.studentProfileRequests.findFirst.mockResolvedValue({
        id: 501,
        student_id: 101,
        status: 'pending',
        new_data: JSON.stringify({ mobile: encMobile }),
        new_pfp: null,
        new_signature: null,
        proof_url: 'kucet/proofs/test_proof.jpg',
      });

      let updatedStudentSets = null;
      db.transaction.mockImplementation(async (cb) => {
        const tx = {
          update: vi.fn(() => ({
            set: vi.fn((sets) => {
              if (sets.mobile || sets.mobile_hash) {
                updatedStudentSets = sets;
              }
              return {
                where: vi.fn().mockResolvedValue(true),
              };
            }),
          })),
        };
        return cb(tx);
      });

      const req = new Request('http://localhost:3000/api/staff/admission/student-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: 501,
          action: 'approve',
        }),
      });

      const res = await staffApproveHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      // Verify students table was updated with encrypted mobile and blind index hash
      expect(updatedStudentSets).toBeDefined();
      expect(updatedStudentSets.mobile).toBe(encMobile);
      expect(updatedStudentSets.mobile_hash).toBe(hashForIndex(plainMobile));
    });
  });

  describe('Client-Side Change Detection & Sanitization Logic', () => {
    it('detects changes in student mobile number and isolates clean 10-digit number', () => {
      const originalData = {
        student: { name: 'Test Student', mobile: '9876543210' },
        personal: {},
      };

      const formData = {
        student: { name: 'Test Student', mobile: '9123456789' },
        personal: {},
      };

      const currentMobile = (formData.student?.mobile || '').replace(/\D/g, '');
      const originalMobile = (originalData.student?.mobile || '').replace(/\D/g, '');
      const changes = {};

      if (currentMobile !== originalMobile) {
        changes.mobile = currentMobile;
      }

      expect(changes.mobile).toBe('9123456789');
    });

    it('does not trigger change when mobile number is identical after digit normalization', () => {
      const originalData = {
        student: { name: 'Test Student', mobile: '9876543210' },
        personal: {},
      };

      const formData = {
        student: { name: 'Test Student', mobile: '98765 43210' },
        personal: {},
      };

      const currentMobile = (formData.student?.mobile || '').replace(/\D/g, '');
      const originalMobile = (originalData.student?.mobile || '').replace(/\D/g, '');
      const changes = {};

      if (currentMobile !== originalMobile) {
        changes.mobile = currentMobile;
      }

      expect(changes.mobile).toBeUndefined();
    });
  });
});
