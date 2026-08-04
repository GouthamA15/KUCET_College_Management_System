// @ts-check
import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

/**
 * E2E tests for Faculty Attendance Deep-Linking & Refresh Persistence.
 *
 * Validates that the new nested App Router structure under
 * /clerk/faculty/attendance/ correctly handles:
 *  - Direct deep-link navigation
 *  - Browser refresh without losing navigation state
 *  - Back/Forward button navigation
 */
test.describe('Attendance Deep-Linking & Refresh Persistence', () => {
  /** @type {string} */
  let clerkToken;

  test.beforeAll(async () => {
    const jwtSecret = process.env.JWT_SECRET || 'temporary_secret_at_least_32_chars_long';
    const secret = new TextEncoder().encode(jwtSecret);
    clerkToken = await new SignJWT({
      id: 42,
      email: 'faculty@kucet.ac.in',
      name: 'MOCK FACULTY',
      role: 'clerk',
      clerk_role: 'faculty',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30m')
      .sign(secret);
  });

  /**
   * Helper: set clerk auth cookies and mock core APIs so
   * the app doesn't crash on missing backend.
   */
  async function bootstrapClerkSession(page) {
    // Set auth cookies
    await page.context().addCookies([
      { name: 'clerk_auth', value: clerkToken, domain: 'localhost', path: '/' },
      { name: 'clerk_logged_in', value: 'true', domain: 'localhost', path: '/' },
    ]);

    // Mock /api/clerk/me
    await page.route('/api/clerk/me', async (route) => {
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

    // Mock /api/clerk/faculty/assignments — always returns the same set
    await page.route('/api/clerk/faculty/assignments', async (route) => {
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
    await page.route('/api/clerk/faculty/interests', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ data: [] }) });
    });

    // Suppress image loads
    await page.route('**/*.{png,jpg,jpeg,svg}', (route) => route.fulfill({ status: 200, body: '' }));
  }

  test('subject list page loads at /clerk/faculty/attendance', async ({ page }) => {
    await bootstrapClerkSession(page);
    await page.goto('/clerk/faculty/attendance');

    // Should show the subject cards
    await expect(page.getByText('Operating Systems')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Database Management')).toBeVisible();
    
    // Should stay on the same URL
    expect(page.url()).toContain('/clerk/faculty/attendance');
    expect(page.url()).not.toContain('/clerk/faculty/attendance/');
  });

  test('clicking a subject navigates to /clerk/faculty/attendance/[id]', async ({ page }) => {
    await bootstrapClerkSession(page);
    await page.goto('/clerk/faculty/attendance');

    // Wait for and click the first subject
    await expect(page.getByText('Operating Systems')).toBeVisible({ timeout: 10000 });
    await page.getByText('Operating Systems').click();

    // Should navigate to the mode selector page
    await expect(page).toHaveURL(/\/clerk\/faculty\/attendance\/101/, { timeout: 10000 });
    await expect(page.getByText('Select Attendance Mode')).toBeVisible({ timeout: 10000 });
  });

  test('direct navigation to mode selector page works', async ({ page }) => {
    await bootstrapClerkSession(page);

    // Navigate directly to the mode selector — simulates bookmark or shared link
    await page.goto('/clerk/faculty/attendance/101');

    // Should render the mode selector, NOT redirect back to subject list
    await expect(page.getByText('Select Attendance Mode')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Operating Systems')).toBeVisible();
  });

  test('refreshing mode selector page stays on the same page', async ({ page }) => {
    await bootstrapClerkSession(page);
    await page.goto('/clerk/faculty/attendance/101');

    await expect(page.getByText('Select Attendance Mode')).toBeVisible({ timeout: 10000 });

    // Refresh the page
    await page.reload();

    // Should STILL show the mode selector — NOT redirect back
    await expect(page.getByText('Select Attendance Mode')).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('/clerk/faculty/attendance/101');
  });

  test('direct navigation to history page works and survives refresh', async ({ page }) => {
    await bootstrapClerkSession(page);
    
    // Mock the history API
    await page.route('/api/clerk/faculty/attendance/full-history*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    // Navigate directly to history page
    await page.goto('/clerk/faculty/attendance/101/history');

    await expect(page.getByText('Attendance History')).toBeVisible({ timeout: 10000 });

    // Refresh
    await page.reload();

    // Should still be on history page
    await expect(page.getByText('Attendance History')).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('/clerk/faculty/attendance/101/history');
  });

  test('direct navigation to take/manual page works and survives refresh', async ({ page }) => {
    await bootstrapClerkSession(page);

    // Mock student list and attendance APIs
    await page.route('/api/clerk/faculty/students*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });
    await page.route('/api/clerk/faculty/attendance/session*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: null }),
        });
      }
    });

    // Navigate directly to manual attendance page
    await page.goto('/clerk/faculty/attendance/101/take/manual');

    // Should show the attendance sheet, not redirect
    await expect(page.getByText('Manual Entry')).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('/clerk/faculty/attendance/101/take/manual');

    // Refresh
    await page.reload();

    // Should STILL be on the manual attendance page
    expect(page.url()).toContain('/clerk/faculty/attendance/101/take/manual');
  });

  test('invalid mode redirects to mode selector', async ({ page }) => {
    await bootstrapClerkSession(page);

    await page.goto('/clerk/faculty/attendance/101/take/invalid_mode');

    // Should redirect to the mode selector
    await expect(page).toHaveURL(/\/clerk\/faculty\/attendance\/101$/, { timeout: 10000 });
  });

  test('non-existent assignment shows "Not Found" state', async ({ page }) => {
    await bootstrapClerkSession(page);

    await page.goto('/clerk/faculty/attendance/99999');

    await expect(page.getByText('Assignment Not Found')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Back to Assignments')).toBeVisible();
  });

  test('browser back button returns to previous route', async ({ page }) => {
    await bootstrapClerkSession(page);

    // Start at subject list
    await page.goto('/clerk/faculty/attendance');
    await expect(page.getByText('Operating Systems')).toBeVisible({ timeout: 10000 });

    // Click to go to mode selector
    await page.getByText('Operating Systems').click();
    await expect(page).toHaveURL(/\/clerk\/faculty\/attendance\/101/, { timeout: 10000 });
    await expect(page.getByText('Select Attendance Mode')).toBeVisible({ timeout: 10000 });

    // Press browser back
    await page.goBack();

    // Should be back at subject list
    await expect(page.getByText('Select a subject to manage attendance')).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('/clerk/faculty/attendance');
    expect(page.url()).not.toMatch(/\/clerk\/faculty\/attendance\/\d+/);
  });
});
