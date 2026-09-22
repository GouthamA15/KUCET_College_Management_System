import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/student/achievements/route';
import { PUT } from '@/app/api/student/achievements/[id]/route';
import { getAuthUser } from '@/lib/api-utils';
import { db } from '@/db';
import { storage } from '@/lib/providers';
import { uploadToCloudinary } from '@/lib/cloudinary';
import LocalStorageProvider from '@/lib/providers/storage/LocalStorageProvider';

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: vi.fn(),
  };
});

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/providers', () => ({
  storage: {
    upload: vi.fn().mockResolvedValue('student/achievements/cert-test-key.webp'),
    getUrl: vi.fn((key) => `https://storage.kucet.ac.in/${key}`),
    delete: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      students: {
        findFirst: vi.fn(),
      },
      studentAchievements: {
        findFirst: vi.fn().mockResolvedValue({
          id: 101,
          student_id: 42,
          achievement_type: 'Certification',
          title: 'AWS Certified',
          certificate_file_path: 'student/achievements/cert-test-key.webp',
        }),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([{ insertId: 101 }]),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
      })),
    })),
  },
}));

vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload: vi.fn().mockResolvedValue({
        public_id: 'kucet/certificates/test-cert',
        format: 'webp',
      }),
    },
  },
}));

// Helper to create base64 image data URI of exact byte length
function createBase64Image(byteLength, mimeType = 'image/jpeg') {
  const buffer = Buffer.alloc(byteLength, 0x41); // 'A' repeated
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

describe('Certificate Image Hard 1 MB Limit & MIME Validation', () => {
  const ONE_MB = 1048576; // Exactly 1,048,576 bytes

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/student/achievements Server-Side Guard', () => {
    it('returns 401 if user is not authenticated as student', async () => {
      getAuthUser.mockResolvedValue(null);
      const req = new Request('http://localhost:3000/api/student/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificate_base64: createBase64Image(500 * 1024) }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('rejects invalid/non-image MIME type (e.g. application/pdf)', async () => {
      getAuthUser.mockResolvedValue({ student_id: 42 });
      const req = new Request('http://localhost:3000/api/student/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          achievement_type: 'Certification',
          title: 'AWS Certified',
          academic_year: '2025-2026',
          achievement_level: 'National',
          certificate_base64: 'data:application/pdf;base64,JVBERi0xLjQKJ...',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid certificate image format');
    });

    it('rejects missing or empty certificate payload', async () => {
      getAuthUser.mockResolvedValue({ student_id: 42 });
      const req = new Request('http://localhost:3000/api/student/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          achievement_type: 'Certification',
          title: 'AWS Certified',
          academic_year: '2025-2026',
          achievement_level: 'National',
          certificate_base64: '',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Missing required fields');
    });

    it('accepts 500 KB certificate (512,000 bytes <= 1 MB)', async () => {
      getAuthUser.mockResolvedValue({ student_id: 42 });
      db.query.students.findFirst.mockResolvedValue({ id: 42, branch: 'CSE', admission_year: 2023 });
      const req = new Request('http://localhost:3000/api/student/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          achievement_type: 'Certification',
          title: 'AWS Certified',
          academic_year: '2025-2026',
          achievement_level: 'National',
          certificate_base64: createBase64Image(500 * 1024),
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(storage.upload).toHaveBeenCalled();
    });

    it('accepts 999 KB certificate (1,022,976 bytes <= 1 MB)', async () => {
      getAuthUser.mockResolvedValue({ student_id: 42 });
      db.query.students.findFirst.mockResolvedValue({ id: 42, branch: 'CSE', admission_year: 2023 });
      const req = new Request('http://localhost:3000/api/student/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          achievement_type: 'Competition',
          title: 'Smart India Hackathon',
          academic_year: '2025-2026',
          achievement_level: 'National',
          certificate_base64: createBase64Image(999 * 1024),
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(storage.upload).toHaveBeenCalled();
    });

    it('accepts boundary edge case: exactly 1,048,575 bytes (1 MB - 1 byte)', async () => {
      getAuthUser.mockResolvedValue({ student_id: 42 });
      db.query.students.findFirst.mockResolvedValue({ id: 42, branch: 'CSE', admission_year: 2023 });
      const req = new Request('http://localhost:3000/api/student/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          achievement_type: 'Certification',
          title: 'Oracle Java OCP',
          academic_year: '2025-2026',
          achievement_level: 'International',
          certificate_base64: createBase64Image(ONE_MB - 1),
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(storage.upload).toHaveBeenCalled();
    });

    it('accepts boundary edge case: exactly 1,048,576 bytes (exact 1 MB)', async () => {
      getAuthUser.mockResolvedValue({ student_id: 42 });
      db.query.students.findFirst.mockResolvedValue({ id: 42, branch: 'CSE', admission_year: 2023 });
      const req = new Request('http://localhost:3000/api/student/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          achievement_type: 'Certification',
          title: 'Oracle Java OCP',
          academic_year: '2025-2026',
          achievement_level: 'International',
          certificate_base64: createBase64Image(ONE_MB),
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(storage.upload).toHaveBeenCalled();
    });

    it('strictly rejects boundary violation: 1,048,577 bytes (1 MB + 1 byte)', async () => {
      getAuthUser.mockResolvedValue({ student_id: 42 });
      const req = new Request('http://localhost:3000/api/student/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          achievement_type: 'Certification',
          title: 'Boundary Test',
          academic_year: '2025-2026',
          achievement_level: 'National',
          certificate_base64: createBase64Image(ONE_MB + 1),
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Certificate image exceeds the 1 MB limit (1,048,576 bytes)');
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('strictly rejects 2 MB payload (2,097,152 bytes)', async () => {
      getAuthUser.mockResolvedValue({ student_id: 42 });
      const req = new Request('http://localhost:3000/api/student/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          achievement_type: 'Certification',
          title: '2MB Test',
          academic_year: '2025-2026',
          achievement_level: 'National',
          certificate_base64: createBase64Image(2 * 1024 * 1024),
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Certificate image exceeds the 1 MB limit (1,048,576 bytes)');
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('strictly rejects 5 MB payload (5,242,880 bytes)', async () => {
      getAuthUser.mockResolvedValue({ student_id: 42 });
      const req = new Request('http://localhost:3000/api/student/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          achievement_type: 'Certification',
          title: '5MB Test',
          academic_year: '2025-2026',
          achievement_level: 'National',
          certificate_base64: createBase64Image(5 * 1024 * 1024),
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Certificate image exceeds the 1 MB limit (1,048,576 bytes)');
      expect(storage.upload).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/student/achievements/[id] Server-Side Guard', () => {
    it('returns 401 if user is not authenticated as student', async () => {
      getAuthUser.mockResolvedValue(null);
      const req = new Request('http://localhost:3000/api/student/achievements/101', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      });
      const res = await PUT(req, { params: Promise.resolve({ id: 101 }) });
      expect(res.status).toBe(401);
    });

    it('rejects replacement certificate exceeding 1 MB', async () => {
      getAuthUser.mockResolvedValue({ student_id: 42 });
      const req = new Request('http://localhost:3000/api/student/achievements/101', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          achievement_type: 'Certification',
          title: 'Updated AWS Certified',
          academic_year: '2025-2026',
          certificate_base64: createBase64Image(ONE_MB + 500),
        }),
      });
      const res = await PUT(req, { params: Promise.resolve({ id: 101 }) });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Certificate image exceeds the 1 MB limit (1,048,576 bytes)');
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejects replacement certificate with invalid MIME format', async () => {
      getAuthUser.mockResolvedValue({ student_id: 42 });
      const req = new Request('http://localhost:3000/api/student/achievements/101', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          achievement_type: 'Certification',
          title: 'Updated AWS Certified',
          academic_year: '2025-2026',
          certificate_base64: 'data:application/pdf;base64,JVBERi0xLjQK',
        }),
      });
      const res = await PUT(req, { params: Promise.resolve({ id: 101 }) });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid certificate image format');
    });

    it('successfully accepts replacement certificate under 1 MB and cleans up old image', async () => {
      getAuthUser.mockResolvedValue({ student_id: 42 });
      storage.upload.mockResolvedValue('student/achievements/new-cert-key.webp');

      const req = new Request('http://localhost:3000/api/student/achievements/101', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          achievement_type: 'Certification',
          title: 'Updated AWS Certified',
          academic_year: '2025-2026',
          certificate_base64: createBase64Image(200 * 1024, 'image/webp'),
        }),
      });
      const res = await PUT(req, { params: Promise.resolve({ id: 101 }) });
      expect(res.status).toBe(200);
      expect(storage.upload).toHaveBeenCalled();
      expect(storage.delete).toHaveBeenCalledWith('student/achievements/cert-test-key.webp');
    });
  });

  describe('Storage Layer 1 MB Enforcement', () => {
    describe('uploadToCloudinary', () => {
      it('rejects Buffer exceeding 1,048,576 bytes', async () => {
        const largeBuffer = Buffer.alloc(ONE_MB + 1);
        await expect(uploadToCloudinary(largeBuffer, 'kucet/certificates/test.webp'))
          .rejects.toThrow(/File too large.*Maximum allowed is 1MB/);
      });

      it('rejects Base64 Data URI exceeding 1,048,576 bytes', async () => {
        const largeDataUri = createBase64Image(ONE_MB + 100);
        await expect(uploadToCloudinary(largeDataUri, 'kucet/certificates/test.webp'))
          .rejects.toThrow(/File too large.*Maximum allowed is 1MB/);
      });

      it('passes Buffer of exactly 1,048,576 bytes without size rejection', async () => {
        const validBuffer = Buffer.alloc(ONE_MB);
        const result = await uploadToCloudinary(validBuffer, 'certificates');
        expect(result).toBe('kucet/certificates/test-cert.webp');
      });
    });

    describe('LocalStorageProvider', () => {
      it('rejects Buffer exceeding 1,048,576 bytes', async () => {
        const provider = new LocalStorageProvider({ baseDir: 'temp' });
        const largeBuffer = Buffer.alloc(ONE_MB + 50);
        await expect(provider.upload(largeBuffer, 'test.webp'))
          .rejects.toThrow(/File too large.*Maximum allowed is 1MB/);
      });
    });
  });
});
