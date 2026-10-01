// @ts-check
import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

test.describe('Admission Draft Sorting Toggle E2E', () => {
  let admissionToken;

  test.beforeAll(async () => {
    const jwtSecret = process.env.JWT_SECRET || 'temporary_secret_at_least_32_chars_long';
    const secret = new TextEncoder().encode(jwtSecret);
    admissionToken = await new SignJWT({
      id: 15,
      email: 'admission@kucet.ac.in',
      name: 'MOCK ADMISSION CLERK',
      role: 'admission',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30m')
      .sign(secret);
  });

  async function bootstrapAdmissionSession(page) {
    await page.context().addCookies([
      { name: 'staff_auth', value: admissionToken, domain: 'localhost', path: '/' },
      { name: 'staff_logged_in', value: 'true', domain: 'localhost', path: '/' },
    ]);

    await page.route('/api/staff/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 15,
            email: 'admission@kucet.ac.in',
            name: 'MOCK ADMISSION CLERK',
            role: 'admission',
          },
        }),
      });
    });

    await page.route('/api/public/college-info', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          collegeInfo: { college_name: 'KUCET', semester_start_dates: [] },
        }),
      });
    });

    // Mock admission drafts
    await page.route(/\/api\/staff\/admission\/drafts(\?.*)?$/, async (route) => {
      const url = new URL(route.request().url());
      const sort = url.searchParams.get('sort') || 'latest';
      const branch = url.searchParams.get('branch') || 'ALL';

      const mockDrafts = [
        { id: 1, name: 'Zahir Khan', branch: branch === 'ALL' ? 'CSE' : branch, entrance_exam: 'TG EAPCET', created_at: '2026-09-01T10:00:00Z', application_no: 'APP001', exam_rank: 100 },
        { id: 2, name: 'Anil Kumar', branch: branch === 'ALL' ? 'CSE' : branch, entrance_exam: 'TG EAPCET', created_at: '2026-09-20T10:00:00Z', application_no: 'APP002', exam_rank: 50 },
        { id: 3, name: 'Bharath Reddy', branch: branch === 'ALL' ? 'CSE' : branch, entrance_exam: 'TG EAPCET', created_at: '2026-09-10T10:00:00Z', application_no: 'APP003', exam_rank: 75 },
      ];

      const sorted = [...mockDrafts].sort((a, b) => {
        if (sort === 'name') {
          return a.name.localeCompare(b.name);
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: sorted }),
      });
    });
  }

  test('sorting toggle is visible in Admission Intake/Draft, defaults to Latest, and toggles Name A-Z', async ({ page }) => {
    await bootstrapAdmissionSession(page);
    await page.goto('/staff/admission/requests?tab=admissions');

    // Verify Sort by Name toggle exists
    const sortToggleLabel = page.getByText('Sort by Name');
    await expect(sortToggleLabel).toBeVisible();

    // Default state: Latest
    await expect(page.getByText('Latest')).toBeVisible();

    // Names in default order: newest (Anil Kumar: Sept 20) -> (Bharath Reddy: Sept 10) -> (Zahir Khan: Sept 1)
    const studentRows = page.locator('h3.font-medium');
    await expect(studentRows.first()).toHaveText('Anil Kumar');

    // Toggle ON -> Sort by Name
    await page.getByText('Sort by Name').click();

    // Now indicator shows A → Z
    await expect(page.getByText('A → Z')).toBeVisible();

    // Alphabetical order: Anil Kumar -> Bharath Reddy -> Zahir Khan
    await expect(studentRows.first()).toHaveText('Anil Kumar');
    await expect(studentRows.nth(1)).toHaveText('Bharath Reddy');
    await expect(studentRows.nth(2)).toHaveText('Zahir Khan');
  });

  test('sorting toggle preserves sort mode across branch filter changes', async ({ page }) => {
    await bootstrapAdmissionSession(page);
    await page.goto('/staff/admission/requests?tab=admissions');

    // Wait for initial render
    await expect(page.getByText('Sort by Name')).toBeVisible();
    await expect(page.getByText('Latest')).toBeVisible();

    // Toggle Sort by Name ON
    await page.getByText('Sort by Name').click();
    await expect(page.getByText('A → Z')).toBeVisible();

    // Change branch to CSE
    const branchSelect = page.locator('select').nth(1);
    await branchSelect.selectOption('CSE');

    // Verify sort mode is preserved as A → Z
    await expect(page.getByText('A → Z')).toBeVisible();

    // Change branch to ECE
    await branchSelect.selectOption('ECE');
    await expect(page.getByText('A → Z')).toBeVisible();
  });

  test('sorting toggle does NOT appear on Rejected tab or Finalize Admissions', async ({ page }) => {
    await bootstrapAdmissionSession(page);

    // 1. Rejected tab
    await page.goto('/staff/admission/requests?tab=rejected');
    await expect(page.getByText('Sort by Name')).not.toBeVisible();

    // 2. Finalize Admissions page
    await page.goto('/staff/admission/finalize');
    await expect(page.getByText('Sort by Name')).not.toBeVisible();
  });
});
