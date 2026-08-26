// @ts-check
import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

/**
 * E2E tests for Faculty Attendance Deep-Linking & Refresh Persistence.
 *
 * Validates that the new nested App Router structure under
 * /staff/faculty/attendance/ correctly handles:
 *  - Direct deep-link navigation
 *  - Browser refresh without losing navigation state
 *  - Back/Forward button navigation
 */
test.describe('Attendance Deep-Linking & Refresh Persistence', () => {
  /** @type {string} */
  let staffToken;

  test.beforeAll(async () => {
    const jwtSecret = process.env.JWT_SECRET || 'temporary_secret_at_least_32_chars_long';
    const secret = new TextEncoder().encode(jwtSecret);
    staffToken = await new SignJWT({
      id: 42,
      email: 'faculty@kucet.ac.in',
      name: 'MOCK FACULTY',
      role: 'faculty',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30m')
      .sign(secret);
  });

  /**
   * Helper: set staff auth cookies and mock core APIs so
   * the app doesn't crash on missing backend.
   */
  async function bootstrapStaffSession(page) {
    // Set auth cookies
    await page.context().addCookies([
      { name: 'staff_auth', value: staffToken, domain: 'localhost', path: '/' },
      { name: 'staff_logged_in', value: 'true', domain: 'localhost', path: '/' },
    ]);

    // Mock /api/staff/me
    await page.route('/api/staff/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 42,
            email: 'faculty@kucet.ac.in',
            name: 'MOCK FACULTY',
            role: 'faculty',
            department: 'CSE',
          },
        }),
      });
    });

    // Mock /api/public/college-info
    await page.route('/api/public/college-info', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          collegeInfo: { college_name: 'KUCET', semester_start_dates: [] },
        }),
      });
    });

    // Mock /api/staff/faculty/assignments — always returns the same set
    await page.route('/api/staff/faculty/assignments', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 101,
              subject_name: 'Operating Systems',
              subject_code: 'CS301',
              branch: 'CSE',
              semester: 5,
              academic_year: '2026-27',
              is_active: true,
            },
            {
              id: 202,
              subject_name: 'Database Management',
              subject_code: 'CS302',
              branch: 'CSE',
              semester: 5,
              academic_year: '2026-27',
              is_active: false,
            },
          ],
        }),
      });
    });

    // Mock faculty interest & other satellite APIs
    await page.route('/api/staff/faculty/interests', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ data: [] }) });
    });

    // Suppress image loads
    await page.route('**/*.{png,jpg,jpeg,svg}', (route) => route.fulfill({ status: 200, body: '' }));
  }

  test('subject list page loads at /staff/faculty/academics', async ({ page }) => {
    await bootstrapStaffSession(page);
    await page.goto('/staff/faculty/academics');

    // Should show the subject cards
    await expect(page.getByText('Operating Systems')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Database Management')).toBeVisible();
    
    // Should stay on the same URL
    expect(page.url()).toContain('/staff/faculty/academics');
  });

  test('clicking a subject navigates to /staff/faculty/attendance/[id]', async ({ page }) => {
    await bootstrapStaffSession(page);
    await page.goto('/staff/faculty/academics');

    // Wait for and click the Attendance button within the card
    await expect(page.getByText('Operating Systems')).toBeVisible({ timeout: 10000 });
    // Card has two buttons: Attendance and Evaluation. We find the one in the same card.
    await page.locator('div').filter({ hasText: 'Operating Systems' }).getByRole('button', { name: 'Attendance' }).first().click();

    // Should navigate to the mode selector page
    await expect(page).toHaveURL(/\/staff\/faculty\/attendance\/101/, { timeout: 10000 });
    await expect(page.getByText('Select Attendance Mode')).toBeVisible({ timeout: 10000 });
  });

  test('direct navigation to mode selector page works', async ({ page }) => {
    await bootstrapStaffSession(page);

    // Navigate directly to the mode selector — simulates bookmark or shared link
    await page.goto('/staff/faculty/attendance/101');

    // Should render the mode selector, NOT redirect back to subject list
    await expect(page.getByText('Select Attendance Mode')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Operating Systems', { exact: true })).toBeVisible();
  });

  test('refreshing mode selector page stays on the same page', async ({ page }) => {
    await bootstrapStaffSession(page);
    await page.goto('/staff/faculty/attendance/101');

    await expect(page.getByText('Select Attendance Mode')).toBeVisible({ timeout: 10000 });

    // Refresh the page
    await page.reload();

    // Should STILL show the mode selector — NOT redirect back
    await expect(page.getByText('Select Attendance Mode')).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('/staff/faculty/attendance/101');
  });

  test('direct navigation to history page works and survives refresh', async ({ page }) => {
    await bootstrapStaffSession(page);
    
    // Mock the history API
    await page.route('/api/staff/faculty/attendance/full-history*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { attendance: [], uniqueDates: [] } }),
      });
    });

    // Navigate directly to history page
    await page.goto('/staff/faculty/attendance/101/history');

    await expect(page.getByRole('heading', { name: 'Attendance History', exact: true })).toBeVisible({ timeout: 10000 });

    // Refresh
    await page.reload();

    // Should still be on history page
    await expect(page.getByRole('heading', { name: 'Attendance History', exact: true })).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('/staff/faculty/attendance/101/history');
  });

  test('direct navigation to take/manual page works and survives refresh', async ({ page }) => {
    await bootstrapStaffSession(page);

    // Mock student list and attendance APIs
    await page.route('/api/staff/faculty/students*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });
    await page.route('/api/staff/faculty/attendance/session*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: null }),
        });
      }
    });

    // Navigate directly to manual attendance page
    await page.goto('/staff/faculty/attendance/101/take/manual');

    // Should show the attendance sheet, not redirect
    await expect(page.getByText('Manual Entry')).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('/staff/faculty/attendance/101/take/manual');

    // Refresh
    await page.reload();

    // Should STILL be on the manual attendance page
    expect(page.url()).toContain('/staff/faculty/attendance/101/take/manual');
  });

  test('invalid mode redirects to mode selector', async ({ page }) => {
    await bootstrapStaffSession(page);

    await page.goto('/staff/faculty/attendance/101/take/invalid_mode');

    // Should redirect to the mode selector
    await expect(page).toHaveURL(/\/staff\/faculty\/attendance\/101$/, { timeout: 10000 });
  });

  test('non-existent assignment shows "Not Found" state', async ({ page }) => {
    await bootstrapStaffSession(page);

    await page.goto('/staff/faculty/attendance/99999');

    await expect(page.getByText('Assignment Not Found')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Back to Academics')).toBeVisible();
  });

  test('browser back button returns to previous route', async ({ page }) => {
    await bootstrapStaffSession(page);

    // Start at subject list
    await page.goto('/staff/faculty/academics');
    await expect(page.getByText('Operating Systems')).toBeVisible({ timeout: 10000 });

    // Click to go to mode selector
    await page.locator('div').filter({ hasText: 'Operating Systems' }).getByRole('button', { name: 'Attendance' }).first().click();
    await expect(page).toHaveURL(/\/staff\/faculty\/attendance\/101/, { timeout: 10000 });
    await expect(page.getByText('Select Attendance Mode')).toBeVisible({ timeout: 10000 });

    // Press browser back
    await page.goBack();

    // Should be back at subject list
    await expect(page.getByText('Manage your active instructional assignments')).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('/staff/faculty/academics');
  });
});
