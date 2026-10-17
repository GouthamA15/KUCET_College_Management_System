import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/student/requests/image/[request_id]/route';
import { getAuthUser } from '@/lib/api-utils';
import { db } from '@/db';
import { serveAssetResponse } from '@/lib/server-assets';
import { NextResponse } from 'next/server';

vi.mock('@/lib/api-utils', () => ({
  getAuthUser: vi.fn(),
}));

vi.mock('@/lib/server-assets', () => ({
  serveAssetResponse: vi.fn().mockImplementation((val) => {
    return new NextResponse(Buffer.from('fake-image-bytes'), {
      status: 200,
      headers: { 'Content-Type': 'image/jpeg' },
    });
  }),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      studentRequests: {
        findFirst: vi.fn(),
      },
      studentRequestImages: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('GET /api/student/requests/image/[request_id] Security & Access Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    getAuthUser.mockResolvedValue(null);
    const req = new Request('http://localhost:3000/api/student/requests/image/105');
    const res = await GET(req, { params: Promise.resolve({ request_id: '105' }) });
    expect(res.status).toBe(401);
  });

  it('authorizes super admin and serves the asset', async () => {
    getAuthUser.mockResolvedValue({ role: 'admin', id: 1 });
    db.query.studentRequestImages.findFirst.mockResolvedValue({
      payment_screenshot: 'kucet/certificates/payments/pay_105.jpg',
    });

    const req = new Request('http://localhost:3000/api/student/requests/image/105');
    const res = await GET(req, { params: Promise.resolve({ request_id: '105' }) });
    expect(res.status).toBe(200);
    expect(serveAssetResponse).toHaveBeenCalledWith(
      'kucet/certificates/payments/pay_105.jpg',
      expect.anything()
    );
  });

  it('authorizes HOD staff to inspect payment screenshots in Document Verification', async () => {
    getAuthUser.mockResolvedValue({ role: 'hod', id: 25, is_hod: true, staffId: 25 });
    db.query.studentRequestImages.findFirst.mockResolvedValue({
      payment_screenshot: 'kucet/certificates/payments/pay_105.jpg',
    });

    const req = new Request('http://localhost:3000/api/student/requests/image/105');
    const res = await GET(req, { params: Promise.resolve({ request_id: '105' }) });
    expect(res.status).toBe(200);
  });

  it('authorizes Admission and Scholarship staff', async () => {
    for (const role of ['admission', 'admission_clerk', 'scholarship', 'scholarship_clerk']) {
      getAuthUser.mockResolvedValue({ role, id: 30, staffId: 30 });
      db.query.studentRequestImages.findFirst.mockResolvedValue({
        payment_screenshot: 'kucet/certificates/payments/pay_105.jpg',
      });

      const req = new Request('http://localhost:3000/api/student/requests/image/105');
      const res = await GET(req, { params: Promise.resolve({ request_id: '105' }) });
      expect(res.status).toBe(200);
    }
  });

  it('authorizes owner student to view their own payment screenshot', async () => {
    getAuthUser.mockResolvedValue({ role: 'student', student_id: 88, roll_no: '21051A0501' });
    db.query.studentRequests.findFirst.mockResolvedValue({ student_id: 88 });
    db.query.studentRequestImages.findFirst.mockResolvedValue({
      payment_screenshot: 'kucet/certificates/payments/pay_105.jpg',
    });

    const req = new Request('http://localhost:3000/api/student/requests/image/105');
    const res = await GET(req, { params: Promise.resolve({ request_id: '105' }) });
    expect(res.status).toBe(200);
  });

  it('blocks another student from viewing someone else payment screenshot with 403', async () => {
    getAuthUser.mockResolvedValue({ role: 'student', student_id: 99, roll_no: '21051A0599' });
    db.query.studentRequests.findFirst.mockResolvedValue({ student_id: 88 }); // Different student

    const req = new Request('http://localhost:3000/api/student/requests/image/105');
    const res = await GET(req, { params: Promise.resolve({ request_id: '105' }) });
    expect(res.status).toBe(403);
  });

  it('returns 404 if payment screenshot record does not exist', async () => {
    getAuthUser.mockResolvedValue({ role: 'admission', id: 10, staffId: 10 });
    db.query.studentRequestImages.findFirst.mockResolvedValue(null);

    const req = new Request('http://localhost:3000/api/student/requests/image/105');
    const res = await GET(req, { params: Promise.resolve({ request_id: '105' }) });
    expect(res.status).toBe(404);
  });
});
