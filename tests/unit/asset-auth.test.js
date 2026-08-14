import { describe, it, expect, vi } from 'vitest';
import { 
  normalizeAssetPath, 
  isStaticPublicAsset, 
  canUserAccessAsset 
} from '@/lib/asset-auth';

// Mock DB queries for authorization tests
vi.mock('@/db', () => ({
  db: {
    query: {
      principal: {
        findFirst: vi.fn().mockImplementation(async ({ where: _where }) => {
          return { id: 1 };
        })
      },
      clerks: {
        findFirst: vi.fn().mockImplementation(async ({ where: _where }) => {
          return { id: 10, is_active: true };
        })
      },
      students: {
        findFirst: vi.fn().mockImplementation(async ({ where: _where }) => {
          return { id: 100, roll_no: '21051A0501', pfp: 'kucet/students/pfp/stu100_photo.webp' };
        })
      },
      studentImages: {
        findFirst: vi.fn().mockImplementation(async ({ where: _where }) => {
          return { student_id: 100, pfp: 'kucet/students/pfp/stu100_photo.webp' };
        })
      },
      studentSignatures: {
        findFirst: vi.fn().mockImplementation(async ({ where: _where }) => {
          return { student_id: 100, signature: 'kucet/students/signatures/stu100_sig.png' };
        })
      },
      studentAdmissionDrafts: {
        findMany: vi.fn().mockImplementation(async () => [
          { pfp: 'kucet/admission_drafts/pfp/draft_photo.webp', signature: 'kucet/admission_drafts/signatures/draft_sig.webp' }
        ])
      },
      studentProfileRequests: {
        findMany: vi.fn().mockImplementation(async () => [
          { new_pfp: 'kucet/requests/pfp/req_photo.webp', new_signature: null, proof_url: 'kucet/requests/proofs/id_proof.pdf' }
        ])
      },
      studentRequests: {
        findMany: vi.fn().mockImplementation(async () => [
          { request_id: 501 }
        ])
      },
      studentRequestImages: {
        findMany: vi.fn().mockImplementation(async () => [
          { request_id: 501, payment_screenshot: 'kucet/certificates/payments/pay_screenshot_501.webp' }
        ])
      },
      bugReports: {
        findMany: vi.fn().mockImplementation(async () => [
          { screenshot_url: 'kucet/bug_reports/bug_screen_1.png' }
        ])
      }
    }
  }
}));

describe('Asset Authorization & Path Normalization Engine', () => {
  describe('normalizeAssetPath()', () => {
    it('should strip query strings and leading slashes', () => {
      expect(normalizeAssetPath('/kucet/students/pfp/abc.jpg?v=123')).toBe('students/pfp/abc.jpg');
    });

    it('should strip /api/assets/view/ and /uploads/ prefixes', () => {
      expect(normalizeAssetPath('/api/assets/view/kucet/admission_drafts/signatures/lthzn.webp')).toBe('admission_drafts/signatures/lthzn.webp');
      expect(normalizeAssetPath('/uploads/kucet/students/pfp/test.png')).toBe('students/pfp/test.png');
    });

    it('should strip domain and version prefixes', () => {
      expect(normalizeAssetPath('https://server.com/api/assets/view/v1778/kucet/clerks/pfp/clerk1.jpg')).toBe('clerks/pfp/clerk1.jpg');
    });
  });

  describe('isStaticPublicAsset()', () => {
    it('should identify static institutional branding assets', () => {
      expect(isStaticPublicAsset('/assets/ku-logo.png')).toBe(true);
      expect(isStaticPublicAsset('/assets/default-avatar.svg')).toBe(true);
      expect(isStaticPublicAsset('/manifest.json')).toBe(true);
      expect(isStaticPublicAsset('/favicon.ico')).toBe(true);
    });

    it('should reject confidential uploaded asset paths', () => {
      expect(isStaticPublicAsset('kucet/admission_drafts/signatures/lthzn.webp')).toBe(false);
      expect(isStaticPublicAsset('kucet/students/pfp/stu100_photo.webp')).toBe(false);
      expect(isStaticPublicAsset('kucet/backups/db_backup.sql.gz')).toBe(false);
    });
  });

  describe('canUserAccessAsset()', () => {
    const adminUser = { id: 1, email: 'admin@kucet.ac.in', role: 'admin' };
    const clerkUser = { id: 10, email: 'clerk@kucet.ac.in', role: 'scholarship', clerkId: 10 };
    const studentUser = { id: 100, student_id: 100, roll_no: '21051A0501', email: 'stu100@kucet.ac.in', role: 'student' };

    it('should ALLOW static public assets without authentication', async () => {
      const allowed = await canUserAccessAsset(null, '/assets/ku-logo.png');
      expect(allowed).toBe(true);
    });

    it('should REJECT sensitive private assets for unauthenticated users (Incognito/Direct link)', async () => {
      const allowed = await canUserAccessAsset(null, 'kucet/admission_drafts/signatures/lthzn.webp');
      expect(allowed).toBe(false);
    });

    it('should REJECT directory traversal attempts', async () => {
      const allowed = await canUserAccessAsset(adminUser, 'kucet/../../etc/passwd');
      expect(allowed).toBe(false);
    });

    it('should ALLOW Super Admin to access all assets (including backups)', async () => {
      expect(await canUserAccessAsset(adminUser, 'kucet/students/pfp/stu100_photo.webp')).toBe(true);
      expect(await canUserAccessAsset(adminUser, 'kucet/backups/db_backup_2026.sql.gz')).toBe(true);
    });

    it('should ALLOW Staff to access operational assets but DENY backup access', async () => {
      expect(await canUserAccessAsset(clerkUser, 'kucet/students/pfp/stu100_photo.webp')).toBe(true);
      expect(await canUserAccessAsset(clerkUser, 'kucet/admission_drafts/signatures/draft_sig.webp')).toBe(true);
      expect(await canUserAccessAsset(clerkUser, 'kucet/backups/db_backup_2026.sql.gz')).toBe(false);
    });

    it('should ALLOW Student to access ONLY their own profile photo and signature', async () => {
      // Own photo & signature
      expect(await canUserAccessAsset(studentUser, 'kucet/students/pfp/stu100_photo.webp')).toBe(true);
      expect(await canUserAccessAsset(studentUser, 'kucet/students/signatures/stu100_sig.png')).toBe(true);

      // Other student's photo
      expect(await canUserAccessAsset(studentUser, 'kucet/students/pfp/other_student_photo.webp')).toBe(false);
    });

    it('should ALLOW Student to access their own draft, profile request proof, and payment screenshots', async () => {
      expect(await canUserAccessAsset(studentUser, 'kucet/admission_drafts/pfp/draft_photo.webp')).toBe(true);
      expect(await canUserAccessAsset(studentUser, 'kucet/requests/proofs/id_proof.pdf')).toBe(true);
      expect(await canUserAccessAsset(studentUser, 'kucet/certificates/payments/pay_screenshot_501.webp')).toBe(true);

      // Unowned payment screenshot
      expect(await canUserAccessAsset(studentUser, 'kucet/certificates/payments/pay_screenshot_999.webp')).toBe(false);
    });
  });
});
