// @ts-check
import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

test.describe('Admin Academic Archive Management System E2E Flow', () => {
  /** @type {string} */
  let adminToken;

  test.beforeAll(async () => {
    const jwtSecret = process.env.JWT_SECRET || 'temporary_secret_at_least_32_chars_long';
    const secret = new TextEncoder().encode(jwtSecret);
    adminToken = await new SignJWT({
      id: 1,
      email: 'admin@kucet.ac.in',
      name: 'SUPER ADMIN',
      role: 'admin',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30m')
      .sign(secret);
  });

  async function bootstrapAdminSession(page) {
    // Add auth cookies before first navigation
    await page.context().addCookies([
      { name: 'admin_auth', value: adminToken, domain: 'localhost', path: '/' },
      { name: 'admin_logged_in', value: 'true', domain: 'localhost', path: '/' },
    ]);

    // Mock AdminContext satellite APIs to prevent hang during page initialization
    await page.route('/api/admin/verify', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ admin: { id: 1, email: 'admin@kucet.ac.in', name: 'SUPER ADMIN', role: 'admin' } }),
      });
    });

    await page.route('/api/admin/staff', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });

    await page.route('/api/admin/student-stats', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
    });

    await page.route('/api/public/college-info', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ collegeInfo: {} }) });
    });

    await page.route('/api/admin/faculty/interests', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });

    // Mock Admin Overview API
    await page.route('/api/admin/archive', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          metrics: {
            activeStudents: 150,
            archivedStudents: 450,
            activeAttendance: 12000,
            archivedAttendance: 85000,
            activeMarks: 2400,
            archivedMarks: 18000,
            activePayments: 450,
            archivedPayments: 3200,
            totalCompletedJobs: 14,
            totalStorageSizeBytes: 104857600,
            totalArchivedRecordsCount: 106200,
            totalArchivedMediaCount: 820,
            lastJobDate: '2026-08-01T10:00:00.000Z',
          },
          policies: [
            { id: 1, entity_type: 'ATTENDANCE', auto_archive_enabled: true, retention_months: 6, description: 'Archive attendance after 6 months.' },
            { id: 2, entity_type: 'MARKS', auto_archive_enabled: true, retention_months: 6, description: 'Archive internal marks after final results.' },
          ],
        }),
      });
    });

    // Mock Archive Audit Logs History API
    await page.route('/api/admin/archive/history*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          logs: [
            {
              id: 101,
              job_id: 'JOB-SEM-2026-0801',
              archive_type: 'SEMESTER',
              branch: 'CSE',
              semester: 5,
              academic_year: '2025-26',
              affected_students_count: 0,
              affected_records_count: 1200,
              affected_media_count: 15,
              storage_size_bytes: 5242880,
              archived_by: 'admin@kucet.ac.in',
              execution_time_ms: 1420,
              status: 'COMPLETED',
            },
          ],
        }),
      });
    });

    // Mock Archive Search API
    await page.route('/api/admin/archive/search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          students: [
            {
              id: 99,
              original_student_id: 42,
              roll_no: '228W1A0599',
              name: 'Archived Test Alumni',
              branch: 'CSE',
              batch: '2022-2026',
              archived_at: '2026-07-01T12:00:00.000Z',
            },
          ],
          attendance: [],
          marks: [],
          payments: [],
        }),
      });
    });

    // Mock Archive Restore Preview & Execute API
    await page.route('/api/admin/archive/restore', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          student: {
            id: 99,
            roll_no: '228W1A0599',
            name: 'Archived Test Alumni',
            branch: 'CSE',
            batch: '2022-2026',
            archived_at: '2026-07-01T12:00:00.000Z',
          },
          counts: {
            attendance: 45,
            marks: 12,
            payments: 4,
          },
        }),
      });
    });

    // Suppress heavy static assets
    await page.route('**/*.{png,jpg,jpeg,svg}', (route) => route.fulfill({ status: 200, body: '' }));
  }

  test('should load Admin Archive Center dashboard and render archive metrics', async ({ page }) => {
    await bootstrapAdminSession(page);
    await page.goto('/admin/archive');

    // 1. Verify Header
    await expect(page.getByRole('heading', { name: /Academic Archive Management Center/i })).toBeVisible({ timeout: 15000 });

    // 2. Verify Stats Cards
    await expect(page.getByText('Current Active Students')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Archived Alumni Students')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('100 MB')).toBeVisible({ timeout: 10000 });

    // 3. Verify Tabs are present (with exact matching to avoid submit button collision)
    await expect(page.getByRole('button', { name: 'Semester Archival', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Alumni Registry Archive', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search & Restore', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retention Rules', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Execution Audit Logs', exact: true })).toBeVisible();
  });

  test('should allow searching archived records and viewing alumni student preview', async ({ page }) => {
    await bootstrapAdminSession(page);
    await page.goto('/admin/archive');

    // Switch to Search & Restore tab
    await page.getByRole('button', { name: 'Search & Restore', exact: true }).click();

    // Fill search input
    const searchInput = page.getByPlaceholder(/Search by Roll No/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('228W1A0599');

    // Click Search Archive button
    await page.getByRole('button', { name: /Search Archive/i }).click();

    // Verify search result row
    await expect(page.getByText('Archived Test Alumni')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('228W1A0599')).toBeVisible();

    // Click Preview & Restore button
    const previewBtn = page.getByRole('button', { name: /Preview & Restore/i }).first();
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();

    // Verify Modal
    await expect(page.getByRole('heading', { name: /Archived Student Profile Preview/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Confirm & Restore Student/i })).toBeVisible();
  });
});
