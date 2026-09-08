import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiUtils from '@/lib/api-utils';
import { db } from '@/db';
import { GET as getBugs } from '@/app/api/bugs/route';

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      bugReports: {
        findMany: vi.fn(),
      },
    },
  },
}));

describe('Bug Reports API Data Sanitization Test Suite', () => {
  const sampleReports = [
    {
      id: 1,
      description: 'Button not clickable on mobile view',
      screenshot_url: 'bugs/screenshots/sample.png',
      type: 'BUG',
      status: 'OPEN',
      severity: 'HIGH',
      submitted_by: '21004T0915',
      user_type: 'student',
      affected_page: '/student/dashboard',
      browser_info: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
      created_at: new Date('2026-09-01'),
      updated_at: new Date('2026-09-01'),
    },
    {
      id: 2,
      description: 'Dark mode preference request',
      screenshot_url: null,
      type: 'FEATURE_REQUEST',
      status: 'OPEN',
      severity: 'LOW',
      submitted_by: 'faculty.advisor@kucet.ac.in',
      user_type: 'staff',
      affected_page: '/staff/academics',
      browser_info: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0',
      created_at: new Date('2026-09-02'),
      updated_at: new Date('2026-09-02'),
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should sanitize PII and omit browser_info for unauthenticated public requests', async () => {
    vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValue(null);
    vi.spyOn(db.query.bugReports, 'findMany').mockResolvedValue(sampleReports);

    const res = await getBugs(new Request('http://localhost/api/bugs'));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toHaveLength(2);
    // browser_info must be stripped
    expect(data[0].browser_info).toBeUndefined();
    expect(data[1].browser_info).toBeUndefined();

    // Roll number must be masked
    expect(data[0].submitted_by).toBe('2100****');
    // Email must be masked
    expect(data[1].submitted_by).toBe('fa***@kucet.ac.in');
  });

  it('should return full unmasked reports and browser_info for authenticated admins', async () => {
    vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });
    vi.spyOn(db.query.bugReports, 'findMany').mockResolvedValue(sampleReports);

    const res = await getBugs(new Request('http://localhost/api/bugs'));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toHaveLength(2);
    expect(data[0].browser_info).toBeDefined();
    expect(data[0].submitted_by).toBe('21004T0915');
    expect(data[1].submitted_by).toBe('faculty.advisor@kucet.ac.in');
  });
});
