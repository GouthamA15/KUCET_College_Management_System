process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/public/student/[rollno]/route';
import { encrypt } from '@/lib/encryption';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Public Student Identification API & Privacy Audit Suite', () => {
  const mockActiveStudent = {
    id: 999, // Internal DB ID - must NEVER be exposed
    roll_no: '24567T0942',
    name: 'Goutham Arra',
    mobile: encrypt('9876543210'),
    student_status: 'ACTIVE',
    academic_status: 'ACTIVE',
    father_name: 'Venkateshwarlu',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. returns 200 with strictly allowlisted public student fields', async () => {
    const { db } = await import('@/db');
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockActiveStudent]),
          }),
        }),
      }),
    });

    const req = new Request('http://localhost:3000/api/public/student/24567T0942');
    const res = await GET(req, { params: Promise.resolve({ rollno: '24567T0942' }) });

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();

    const d = json.data;
    // Expected allowlisted institutional fields
    expect(d.rollNo).toBe('24567T0942');
    expect(d.hallTicketNumber).toBe('24567T0942');
    expect(d.studentName).toBe('GOUTHAM ARRA');
    expect(d.fatherName).toBe('VENKATESHWARLU');
    expect(d.course).toBe('B.Tech (CSE)');
    expect(d.branch).toBe('CSE');
    expect(d.branchFullName).toBe('Computer Science & Engineering');
    expect(d.academicYear).toBe('2024-2028');
    expect(d.admissionYear).toBe('2024');
    expect(d.validUpto).toBe('2024-2028');
    expect(d.collegeName).toBe('KU COLLEGE OF ENGINEERING & TECHNOLOGY');
    expect(d.collegeAddress).toBe('Kakatiya University Campus, Vidyaranyapuri, Warangal 506 009');
    expect(d.verificationStatus).toBe('VERIFIED INSTITUTIONAL STUDENT');

    // Phone number must be masked to only the last 4 digits
    expect(d.maskedContact).toBe('******3210');
  });

  it('2. STRICT PRIVACY AUDIT: confirms absence of sensitive private fields', async () => {
    const { db } = await import('@/db');
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockActiveStudent]),
          }),
        }),
      }),
    });

    const req = new Request('http://localhost:3000/api/public/student/24567T0942');
    const res = await GET(req, { params: Promise.resolve({ rollno: '24567T0942' }) });
    const json = await res.json();
    const d = json.data;

    // Strict Negative Assertions for Private Data Protection:
    expect(d.pfp).toBeUndefined();
    expect(d.photo).toBeUndefined();
    expect(d.photoUrl).toBeUndefined();
    expect(d.photoKey).toBeUndefined();

    expect(d.address).toBeUndefined();
    expect(d.permanentAddress).toBeUndefined();
    expect(d.currentAddress).toBeUndefined();
    expect(d.perm_house_no).toBeUndefined();

    expect(d.mobile).toBeUndefined();
    expect(d.phone).toBeUndefined();
    expect(d.studentPhone).toBeUndefined();

    expect(d.bloodGroup).toBeUndefined();
    expect(d.blood_group).toBeUndefined();

    expect(d.aadhaar).toBeUndefined();
    expect(d.aadhaar_no).toBeUndefined();
    expect(d.aadhaarHash).toBeUndefined();

    expect(d.apaar).toBeUndefined();
    expect(d.apaar_id).toBeUndefined();

    expect(d.email).toBeUndefined();

    // Internal database primary key must NEVER leak
    expect(d.id).toBeUndefined();
    expect(d.student_id).toBeUndefined();
    expect(d.studentId).toBeUndefined();
    expect(JSON.stringify(json)).not.toContain('999'); // mockActiveStudent.id
  });

  it('3. returns 400 Bad Request for malformed or invalid roll numbers', async () => {
    const req = new Request('http://localhost:3000/api/public/student/INVALID_ROLL');
    const res = await GET(req, { params: Promise.resolve({ rollno: 'INVALID_ROLL' }) });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Invalid institutional roll number format/i);
  });

  it('4. returns 404 Not Found when student does not exist or is inactive', async () => {
    const { db } = await import('@/db');
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No records found
          }),
        }),
      }),
    });

    const req = new Request('http://localhost:3000/api/public/student/26567T0001');
    const res = await GET(req, { params: Promise.resolve({ rollno: '26567T0001' }) });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found or not currently active/i);
  });

  it('5. returns correct Cache-Control header for public verification', async () => {
    const { db } = await import('@/db');
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockActiveStudent]),
          }),
        }),
      }),
    });

    const req = new Request('http://localhost:3000/api/public/student/24567T0942');
    const res = await GET(req, { params: Promise.resolve({ rollno: '24567T0942' }) });

    expect(res.headers.get('Cache-Control')).toContain('public');
    expect(res.headers.get('Cache-Control')).toContain('max-age=300');
  });
});
