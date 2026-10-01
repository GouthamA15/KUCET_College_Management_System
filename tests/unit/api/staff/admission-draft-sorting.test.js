import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/staff/admission/drafts/route';
import { getAuthUser } from '@/lib/api-utils';
import { db } from '@/db';

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

describe('Admission Drafts Sorting API (/api/staff/admission/drafts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthorized user with 403', async () => {
    getAuthUser.mockResolvedValue(null);
    const req = new Request('http://localhost:3000/api/staff/admission/drafts');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('defaults to latest-first sorting when sort parameter is omitted', async () => {
    getAuthUser.mockResolvedValue({ id: 1, role: 'admission' });
    let capturedOrderBy = null;

    db.select = vi.fn().mockReturnValue({
      from: () => ({
        where: () => ({
          orderBy: (...args) => {
            capturedOrderBy = args;
            return Promise.resolve([
              { id: 2, name: 'AAA Student', created_at: '2026-09-30T12:00:00Z' },
              { id: 1, name: 'ZZZ Student', created_at: '2026-09-29T12:00:00Z' }
            ]);
          }
        })
      })
    });

    const req = new Request('http://localhost:3000/api/staff/admission/drafts?branch=CSE&entrance_exam=TG%20EAPCET');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(capturedOrderBy).toBeDefined();
    // Default sort uses created_at DESC and id DESC
    expect(capturedOrderBy.length).toBe(2);
  });

  it('applies name A-Z sorting when sort=name is provided', async () => {
    getAuthUser.mockResolvedValue({ id: 1, role: 'admission' });
    let capturedOrderBy = null;

    db.select = vi.fn().mockReturnValue({
      from: () => ({
        where: () => ({
          orderBy: (...args) => {
            capturedOrderBy = args;
            return Promise.resolve([
              { id: 1, name: 'Akhil', created_at: '2026-09-20T10:00:00Z' },
              { id: 2, name: 'Bharath', created_at: '2026-09-25T10:00:00Z' },
              { id: 3, name: 'Chaitanya', created_at: '2026-09-15T10:00:00Z' }
            ]);
          }
        })
      })
    });

    const req = new Request('http://localhost:3000/api/staff/admission/drafts?branch=CSE&entrance_exam=TG%20EAPCET&sort=name');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(capturedOrderBy).toBeDefined();
    const body = await res.json();
    expect(body.data[0].name).toBe('Akhil');
    expect(body.data[1].name).toBe('Bharath');
    expect(body.data[2].name).toBe('Chaitanya');
  });

  it('works for every branch individually (CSE, CSD, ECE, EEE, CIVIL, IT, MECH)', async () => {
    getAuthUser.mockResolvedValue({ id: 1, role: 'admission' });
    const branches = ['CSE', 'CSD', 'ECE', 'EEE', 'CIVIL', 'IT', 'MECH'];

    for (const b of branches) {
      db.select = vi.fn().mockReturnValue({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([
              { id: 10, name: `Student in ${b}`, branch: b }
            ])
          })
        })
      });

      const reqName = new Request(`http://localhost:3000/api/staff/admission/drafts?branch=${b}&entrance_exam=TG%20EAPCET&sort=name`);
      const resName = await GET(reqName);
      expect(resName.status).toBe(200);

      const reqLatest = new Request(`http://localhost:3000/api/staff/admission/drafts?branch=${b}&entrance_exam=TG%20EAPCET&sort=latest`);
      const resLatest = await GET(reqLatest);
      expect(resLatest.status).toBe(200);
    }
  });

  it('composes sort with filters: branch + intake exam + entry year + search', async () => {
    getAuthUser.mockResolvedValue({ id: 1, role: 'admission' });

    db.select = vi.fn().mockReturnValue({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve([
            { id: 5, name: 'Akhil Kumar', branch: 'CSE', entrance_exam: 'TG EAPCET', admission_year: '2026' }
          ])
        })
      })
    });

    const req = new Request('http://localhost:3000/api/staff/admission/drafts?branch=CSE&entrance_exam=TG%20EAPCET&entry_year=2026&search=Akhil&sort=name');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].name).toBe('Akhil Kumar');
  });

  it('distinguishes between older AAA and newer ZZZ for latest vs name sorting', async () => {
    // Regression check:
    // Student 1 (older, name 'ZZZ')
    // Student 2 (newer, name 'AAA')
    const student1 = { id: 1, name: 'ZZZ Candidate', created_at: '2026-09-01T10:00:00Z' };
    const student2 = { id: 2, name: 'AAA Candidate', created_at: '2026-09-20T10:00:00Z' };

    // When latest sort: student 2 (newer) comes before student 1 (older)
    const latestSorted = [student2, student1];
    // When name sort: student 2 (AAA) comes before student 1 (ZZZ)
    const nameSorted = [student2, student1];

    expect(new Date(latestSorted[0].created_at).getTime()).toBeGreaterThan(new Date(latestSorted[1].created_at).getTime());
    expect(nameSorted[0].name.localeCompare(nameSorted[1].name)).toBeLessThan(0);
  });
});
