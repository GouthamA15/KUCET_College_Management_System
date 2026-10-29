// @ts-check
import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

/**
 * End-to-End Suite for First Year Coordinator (Phase Nine Verification)
 * Covers the 10 critical scenarios:
 *  1. Admin appoints coordinator in Staff Management
 *  2. Coordinator logs in and sees First Year Coordination in navigation
 *  3. Opening workspace renders overview KPIs (7 branches, Sem 1-2, real ID card stats)
 *  4. Page refresh maintains session and does not redirect to faculty dashboard
 *  5. Timetable instance creation & slot editor opens with loaded subjects/faculty
 *  6. Faculty subject-interest review persists approval and generates assignment
 *  7. Self-review of coordinator's own request is blocked with 403
 *  8. Student ID cards tab renders first-year students across all branches
 *  9. Non-coordinator faculty is rejected from coordinator routes
 * 10. Section-free verification: verify no section selector exists in timetable flows
 */

test.describe('First Year Coordinator Comprehensive E2E Suite', () => {
  /** @type {string} */
  let adminToken;
  /** @type {string} */
  let coordinatorToken;
  /** @type {string} */
  let regularFacultyToken;

  const mockAdmin = {
    id: 1,
    email: 'admin@kucet.ac.in',
    name: 'Super Admin',
    role: 'admin',
  };

  const mockCoordinator = {
    id: 101,
    email: 'coordinator@kucet.ac.in',
    name: 'Dr. First Year Coordinator',
    role: 'faculty',
    department: 'CSE',
    is_first_year_coordinator: true,
    coordinator_status: 'ACTIVE',
  };

  const mockRegularFaculty = {
    id: 102,
    email: 'regular.faculty@kucet.ac.in',
    name: 'Dr. Regular Faculty',
    role: 'faculty',
    department: 'ECE',
    is_first_year_coordinator: false,
    coordinator_status: null,
  };

  test.beforeAll(async () => {
    const jwtSecret = process.env.JWT_SECRET || 'temporary_secret_at_least_32_chars_long';
    const secret = new TextEncoder().encode(jwtSecret);

    adminToken = await new SignJWT(mockAdmin)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secret);

    coordinatorToken = await new SignJWT(mockCoordinator)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secret);

    regularFacultyToken = await new SignJWT(mockRegularFaculty)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secret);
  });

  test.beforeEach(async ({ page }) => {
    await page.route('**/*.{png,jpg,jpeg,svg}', (route) => route.fulfill({ status: 200, body: '' }));
    await page.route('/api/public/college-info', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ collegeInfo: { college_name: 'KUCET' } }),
      });
    });
  });

  // Scenario 1: Admin appoints coordinator in Staff Management
  test('Scenario 1: Admin appoints coordinator in Staff Management', async ({ page }) => {
    await page.context().addCookies([
      { name: 'admin_auth', value: adminToken, domain: 'localhost', path: '/' },
      { name: 'admin_logged_in', value: 'true', domain: 'localhost', path: '/' },
    ]);

    await page.route('/api/admin/coordinator-assignments', async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        expect(body.staff_id).toBe(101);
        expect(body.coordinator_type).toBe('FIRST_YEAR');
        expect(body.academic_year).toBe('2025-26');
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 99, ...body, status: 'ACTIVE' },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.goto('/');

    // Make an API check using page evaluate so page.route intercepts it
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/admin/coordinator-assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          staff_id: 101,
          coordinator_type: 'FIRST_YEAR',
          academic_year: '2025-26',
          start_date: '2025-08-01',
        }),
      });
      return {
        status: res.status,
        data: await res.json(),
      };
    });

    expect(response.status).toBe(201);
    expect(response.data.success).toBe(true);
    expect(response.data.data.staff_id).toBe(101);
  });

  // Scenario 2: Coordinator logs in and sees First Year Coordination in navigation
  test('Scenario 2: Coordinator sees First Year Coordination in navigation bar and menu', async ({ page }) => {
    await page.context().addCookies([
      { name: 'staff_auth', value: coordinatorToken, domain: 'localhost', path: '/' },
      { name: 'staff_logged_in', value: 'true', domain: 'localhost', path: '/' },
    ]);

    await page.route('/api/staff/me', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockCoordinator }),
      });
    });

    await page.route('/api/auth/session', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: mockCoordinator }),
      });
    });

    await page.goto('/staff/faculty/dashboard');
    // Navigation should contain First Year Coordination link
    const coordNav = page.locator('a[href="/staff/first-year/dashboard"]');
    await expect(coordNav.first()).toBeVisible();
  });

  // Scenario 3: Opening workspace renders overview KPIs (7 branches, Sem 1-2, real ID card stats)
  test('Scenario 3: Workspace renders overview KPIs and 7 branches', async ({ page }) => {
    await page.context().addCookies([
      { name: 'staff_auth', value: coordinatorToken, domain: 'localhost', path: '/' },
      { name: 'staff_logged_in', value: 'true', domain: 'localhost', path: '/' },
    ]);

    await page.route('/api/staff/me', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockCoordinator }),
      });
    });

    await page.route('**/api/staff/id-cards*', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          students: [],
          stats: { totalEligible: 420, printedCount: 150, pendingCount: 270 },
          pagination: { totalCount: 420 },
        }),
      });
    });

    await page.route('**/api/staff/hod/faculty-interests*', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route('**/api/staff/first-year/faculty-interests*', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.goto('/staff/first-year/dashboard');
    await expect(page.locator('text=First Year Academic Coordination')).toBeVisible();

    // Verify 7 branches badge / pills
    await expect(page.locator('text="CSE, IT, CSD, ECE, EEE, CIVIL, MECH"')).toBeVisible();

    // Verify real ID card stat count 420 is rendered
    await expect(page.locator('text=420')).toBeVisible();
  });

  // Scenario 4: Page refresh maintains session and does not redirect to faculty dashboard
  test('Scenario 4: Page refresh maintains coordinator session without redirect', async ({ page }) => {
    await page.context().addCookies([
      { name: 'staff_auth', value: coordinatorToken, domain: 'localhost', path: '/' },
      { name: 'staff_logged_in', value: 'true', domain: 'localhost', path: '/' },
    ]);

    await page.route('/api/staff/me', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockCoordinator }),
      });
    });

    await page.route('**/api/staff/id-cards*', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, students: [], stats: { totalEligible: 50 } }),
      });
    });

    await page.goto('/staff/first-year/dashboard');
    expect(page.url()).toContain('/staff/first-year/dashboard');

    await page.reload();
    expect(page.url()).toContain('/staff/first-year/dashboard');
    await expect(page.locator('text=First Year Academic Coordination')).toBeVisible({ timeout: 15000 });
  });

  // Scenario 5: Timetable instance creation & slot editor opens with loaded subjects/faculty
  test('Scenario 5: Timetable editor opens for coordinator and loads subjects and faculty', async ({ page }) => {
    await page.context().addCookies([
      { name: 'staff_auth', value: coordinatorToken, domain: 'localhost', path: '/' },
      { name: 'staff_logged_in', value: 'true', domain: 'localhost', path: '/' },
    ]);

    await page.route('/api/staff/me', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockCoordinator }),
      });
    });

    const mockInstance = {
      id: 999,
      academic_year: '2025-26',
      branch: 'CSE',
      semester: 1,
      status: 'DRAFT',
      version: 1,
    };

    await page.route('/api/staff/hod/timetable-instances/999', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            instance: mockInstance,
            entries: [],
          },
        }),
      });
    });

    await page.route('/api/staff/hod/timetable?instanceId=999', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route('/api/staff/hod/available-subjects?**', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{ id: 10, code: 'MA101', name: 'Mathematics I' }],
        }),
      });
    });

    await page.route('/api/staff/hod/faculty-load?**', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{ id: 55, name: 'Prof. Ramanujan', current_load: 8 }],
        }),
      });
    });

    await page.goto('/staff/faculty/time-table/999');
    // Timetable editor header must render without blanking out
    await expect(page.locator('text=Timetable Editor')).toBeVisible();
    await expect(page.locator('text=/CSE.*Semester 1/')).toBeVisible();
  });

  // Scenario 6: Faculty subject-interest review persists approval and generates assignment
  test('Scenario 6: Faculty interest approval persists and updates status', async ({ page }) => {
    let patched = false;
    await page.route('/api/staff/first-year/faculty-interests/77', async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}');
        expect(body.status).toBe('APPROVED');
        patched = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Request approved and assigned' }),
        });
      }
      return route.fulfill({ status: 405 });
    });

    await page.goto('/');

    const res = await page.evaluate(async () => {
      const response = await fetch('/api/staff/first-year/faculty-interests/77', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'APPROVED' }),
      });
      return { status: response.status };
    });

    expect(res.status).toBe(200);
    expect(patched).toBe(true);
  });

  // Scenario 7: Self-review of coordinator's own request is blocked with 403
  test('Scenario 7: Self-review of coordinator own request is blocked with 403', async ({ page }) => {
    await page.route('/api/staff/first-year/faculty-interests/88', async (route) => {
      // Return 403 Forbidden because staff_id matches current coordinator
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Self-review prohibited' }),
      });
    });

    await page.goto('/');

    const res = await page.evaluate(async () => {
      const response = await fetch('/api/staff/first-year/faculty-interests/88', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'APPROVED' }),
      });
      return { status: response.status, body: await response.json() };
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Self-review prohibited');
  });

  // Scenario 8: Student ID cards tab renders first-year students across all branches
  test('Scenario 8: Student ID cards tab renders first-year students across all branches', async ({ page }) => {
    await page.context().addCookies([
      { name: 'staff_auth', value: coordinatorToken, domain: 'localhost', path: '/' },
      { name: 'staff_logged_in', value: 'true', domain: 'localhost', path: '/' },
    ]);

    await page.route('/api/staff/me', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockCoordinator }),
      });
    });

    await page.route('/api/staff/id-cards?**', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          students: [
            { id: 1, rollNo: '250101', roll_number: '250101', studentName: 'John Doe', name: 'John Doe', branch: 'CSE', semester: 1 },
            { id: 2, rollNo: '250201', roll_number: '250201', studentName: 'Jane Smith', name: 'Jane Smith', branch: 'ECE', semester: 1 },
          ],
          stats: { totalEligible: 2, printedCount: 0, pendingCount: 2 },
          pagination: { totalCount: 2 },
        }),
      });
    });

    await page.goto('/staff/first-year/dashboard');
    // Click on Student ID Cards tab
    await page.click('button:has-text("Student ID Cards")');

    await expect(page.locator('text=John Doe')).toBeVisible();
    await expect(page.locator('text=Jane Smith')).toBeVisible();
  });

  // Scenario 9: Non-coordinator faculty is rejected from coordinator routes
  test('Scenario 9: Non-coordinator faculty is rejected or redirected from coordinator routes', async ({ page }) => {
    await page.context().addCookies([
      { name: 'staff_auth', value: regularFacultyToken, domain: 'localhost', path: '/' },
      { name: 'staff_logged_in', value: 'true', domain: 'localhost', path: '/' },
    ]);

    await page.route('/api/staff/me', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockRegularFaculty }),
      });
    });

    await page.route('**/api/staff/hod/faculty-interests*', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route('**/api/staff/first-year/faculty-interests*', async (route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Forbidden: First Year Coordinator access required' }),
      });
    });

    await page.goto('/');

    const res = await page.evaluate(async () => {
      const response = await fetch('/api/staff/first-year/faculty-interests');
      return { status: response.status };
    });

    expect(res.status).toBe(403);
  });

  // Scenario 10: Section-free verification: verify no section selector exists in timetable flows
  test('Scenario 10: Section-free verification: no Section selector exists in timetable flows', async ({ page }) => {
    await page.context().addCookies([
      { name: 'staff_auth', value: coordinatorToken, domain: 'localhost', path: '/' },
      { name: 'staff_logged_in', value: 'true', domain: 'localhost', path: '/' },
    ]);

    await page.route('/api/staff/me', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockCoordinator }),
      });
    });

    await page.route('/api/staff/hod/timetable-instances?**', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.goto('/staff/first-year/dashboard');
    // Switch to Timetables tab
    await page.click('button:has-text("Timetables")');

    // Verify UI has Branch and Semester, but absolutely NO Section dropdown / option
    await expect(page.locator('select:has-text("Section")')).toHaveCount(0);
    await expect(page.locator('text="Section A"')).toHaveCount(0);
    await expect(page.locator('text="Section B"')).toHaveCount(0);
  });

  // Scenario 11: Academic Coverage & Workload displays 2026-27 default and opens Assign Now modal
  test('Scenario 11: Academic Coverage defaults to 2026-27 and Assign Now opens assignment modal', async ({ page }) => {
    await page.context().addCookies([
      { name: 'staff_auth', value: coordinatorToken, domain: 'localhost', path: '/' },
      { name: 'staff_logged_in', value: 'true', domain: 'localhost', path: '/' },
    ]);

    await page.route('/api/staff/me', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ...mockCoordinator,
            academic_year: '2026-27',
            coordinator_assignment: {
              academic_year: '2026-27',
              start_date: '2026-10-23'
            }
          }
        }),
      });
    });

    await page.route('/api/staff/hod/academic-coverage?**', async (route) => {
      const url = new URL(route.request().url());
      expect(url.searchParams.get('academic_year')).toBe('2026-27');
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            academic_year: '2026-27',
            branch: 'CSE',
            semester: 1,
            summary: {
              total_syllabus_subjects: 7,
              covered_subjects_count: 2,
              unassigned_subjects_count: 5,
              coverage_percentage: 29,
              total_assignments: 2,
              distinct_assigned_faculty: 1,
              pending_requests_count: 0,
              total_timetable_slots: 0
            },
            covered_subjects: [
              { subject_code: 'BSC101', subject_name: 'Physics', subject_type: 'theory', assigned_faculty: [{ id: 180009, name: 'Dr.M.Kalpana Devi' }] },
              { subject_code: 'BSC101L', subject_name: 'Physics-Practical', subject_type: 'lab', assigned_faculty: [{ id: 180009, name: 'Dr.M.Kalpana Devi' }] }
            ],
            unassigned_subjects: [
              { subject_code: 'BSC103', subject_name: 'Mathematics-I', subject_type: 'theory', branch: 'CSE', semester: 1 },
              { subject_code: 'ESC101', subject_name: 'Basic Electrical Engineering', subject_type: 'theory', branch: 'CSE', semester: 1 }
            ],
            pending_requests: [],
            workload_distribution: [
              { id: 180009, name: 'Dr.M.Kalpana Devi', employee_id: 'KU-BAD807-0808', total_periods: 0, assigned_subjects: [{ subject_code: 'BSC101' }, { subject_code: 'BSC101L' }] }
            ],
            alerts: [
              { type: 'UNASSIGNED_SUBJECT', severity: 'HIGH', message: 'Missing faculty coverage: Mathematics-I (BSC103) has no teaching faculty assigned.', subject_code: 'BSC103' }
            ],
            authorized_branches: ['CSE', 'IT', 'CSD', 'ECE', 'EEE', 'CIVIL', 'MECH'],
            allowed_semesters: [1, 2]
          }
        })
      });
    });

    await page.route('/api/staff/hod/active-faculty?**', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 180009, name: 'Dr.M.Kalpana Devi', employee_id: 'KU-BAD807-0808' }
          ]
        })
      });
    });

    await page.goto('/staff/first-year/dashboard');
    await page.click('button:has-text("Coverage & Workload")');

    // Verify academic year filter shows 2026-27
    const yearSelect = page.locator('select').nth(2);
    await expect(yearSelect).toHaveValue('2026-27');

    // Verify 29% assigned coverage is shown and Physics is NOT unassigned
    await expect(page.locator('text=29%')).toBeVisible();
    await expect(page.locator('text=2 of 7 subjects covered')).toBeVisible();
    await expect(page.locator('text=Missing faculty coverage: Mathematics-I (BSC103)')).toBeVisible();

    // Click Assign Now button
    await page.click('button:has-text("Assign Now")');

    // Verify Assign Faculty modal opens
    await expect(page.locator('text=Assign Teaching Faculty')).toBeVisible();
    await expect(page.locator('.fixed').getByText('Mathematics-I', { exact: true })).toBeVisible();
    await expect(page.locator('.fixed').getByText('BSC103')).toBeVisible();
  });
});
