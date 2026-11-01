// @ts-check
import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

test.describe('Student Profile Photo and Signature Guidance E2E Flow', () => {
  const testStudent = {
    id: 101,
    roll_no: '22567T0901',
    name: 'Goutham Test Student',
    email: 'student@kucet.ac.in',
    student_status: 'ACTIVE',
    academic_status: 'ACTIVE',
    academic_offset_years: 0
  };

  /** @type {string} */
  let studentToken;

  test.beforeAll(async () => {
    const jwtSecret = process.env.JWT_SECRET || 'temporary_secret_at_least_32_chars_long';
    const secret = new TextEncoder().encode(jwtSecret);
    studentToken = await new SignJWT({
      student_id: testStudent.id,
      roll_no: testStudent.roll_no,
      name: testStudent.name,
      is_email_verified: true,
      has_password_set: true,
      role: 'student',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30m')
      .sign(secret);
  });

  test.beforeEach(async ({ page }) => {
    // Set auth cookies BEFORE navigating
    await page.context().addCookies([
      {
        name: 'student_auth',
        value: studentToken,
        domain: 'localhost',
        path: '/',
      },
      {
        name: 'student_logged_in',
        value: 'true',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Mock /api/student/me
    await page.route('**/api/student/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          roll_no: testStudent.roll_no,
          student_id: testStudent.id,
          name: testStudent.name,
          email: testStudent.email,
          role: 'student'
        }),
      });
    });

    // Mock /api/public/college-info
    await page.route('**/api/public/college-info', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ collegeInfo: { id: 1, name: 'KUCET', short_name: 'KUCET', branches: [] } }),
      });
    });

    // Mock /api/student/latest-request
    await page.route('**/api/student/latest-request*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ request: null }),
      });
    });

    // Mock /api/student/academic-info
    await page.route('**/api/student/academic-info*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], semester: 1, academicYear: '2026-27' }),
      });
    });

    // Mock /api/student/signature GET
    await page.route('**/api/student/signature', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            signature: null,
            pfp: null,
            latestRequest: null,
            history: [],
            details: {
              student: { name: testStudent.name, roll_no: testStudent.roll_no },
              personal: {
                father_name: 'Srinivas Test',
                mother_name: 'Laxmi Test',
                dob: '2004-05-15',
                curr_city: 'Warangal',
                curr_state: 'Telangana',
                is_current_same_as_permanent: true
              },
              academic: {}
            }
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock student profile data in context
    await page.route(`**/api/student/${testStudent.roll_no}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          student: {
            ...testStudent,
            is_email_verified: 1,
            password_hash: 'mock_hash',
          },
          background: null,
          details: null,
          images: null
        }),
      });
    });
  });

  test('verifies profile photograph guidance modal displays institutional warnings, checklists, visual examples, and triggers file selection', async ({ page }) => {
    await page.goto('/student/settings/edit-profile');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('Edit Profile');

    // Click on Profile Photo placeholder / change button
    const photoContainer = page.locator('text=Change Photo').first();
    await photoContainer.click();

    // Verify Modal Header & Dialog Accessibility
    const dialog = page.locator('div[role="dialog"][aria-labelledby="upload-warning-title"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#upload-warning-title')).toContainText('Important — Profile Picture Update');

    // Verify Institutional Warning Notice
    const institutionalWarning = dialog.locator('#upload-warning-desc');
    await expect(institutionalWarning).toBeVisible();
    await expect(institutionalWarning).toContainText('official student profile, identity verification, and college records');

    // Verify What to Upload (Accepted) & What NOT to Upload (Rejected)
    await expect(dialog).toContainText('What to Upload (Accepted)');
    await expect(dialog).toContainText('What NOT to Upload (Rejected)');
    await expect(dialog).toContainText('passport-style portrait');
    await expect(dialog).toContainText('front-facing view');
    await expect(dialog).toContainText('plain white or light-coloured background');
    await expect(dialog).toContainText('printed ID card');

    // Verify Visual Reference Examples
    await expect(dialog).toContainText('Visual Reference Examples');
    await expect(dialog).toContainText('CORRECT — Passport-Style Portrait');
    await expect(dialog).toContainText('Printed Photo / Photo of an ID Card');
    await expect(dialog).toContainText('Full-Body or Distant Photo');
    await expect(dialog).toContainText('Casual Outdoor / Distracting Background');

    // Verify File Format & Max Size requirements
    await expect(dialog).toContainText('Accepted formats: JPG, PNG, WebP (Max 1MB).');

    // Test Cancel Action: Closes modal without triggering upload
    const cancelButton = dialog.locator('button', { hasText: 'Cancel' });
    await cancelButton.click();
    await expect(dialog).not.toBeVisible();

    // Reopen modal and test Choose Photo Action triggers file chooser
    await photoContainer.click();
    await expect(dialog).toBeVisible();

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      dialog.locator('button', { hasText: 'Choose Photo' }).click(),
    ]);

    expect(fileChooser).toBeDefined();
    await expect(dialog).not.toBeVisible();
  });

  test('verifies signature guidance modal displays institutional warnings, checklists, visual examples, and triggers file selection', async ({ page }) => {
    await page.goto('/student/settings/edit-profile');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('Edit Profile');

    // Click on Signature upload card
    const signatureCard = page.locator('text=Upload Signature');
    await signatureCard.click();

    // Verify Modal Header & Dialog Accessibility
    const dialog = page.locator('div[role="dialog"][aria-labelledby="upload-warning-title"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#upload-warning-title')).toContainText('Important — Signature Update');

    // Verify Institutional Warning Notice
    const institutionalWarning = dialog.locator('#upload-warning-desc');
    await expect(institutionalWarning).toBeVisible();
    await expect(institutionalWarning).toContainText('genuine signature');
    await expect(institutionalWarning).toContainText('official college records and verification');

    // Verify What to Upload (Accepted) & What NOT to Upload (Rejected)
    await expect(dialog).toContainText('What to Upload (Accepted)');
    await expect(dialog).toContainText('What NOT to Upload (Rejected)');
    await expect(dialog).toContainText('genuine handwritten signature');
    await expect(dialog).toContainText('dark blue or black ink');
    await expect(dialog).toContainText('rotated, sideways, vertical, or upside-down');

    // Verify Visual Reference Examples
    await expect(dialog).toContainText('Visual Reference Examples');
    await expect(dialog).toContainText('ACCEPTABLE — Clear signature');
    await expect(dialog).toContainText('ACCEPTABLE — Properly framed signature');
    await expect(dialog).toContainText('NOT ACCEPTABLE — Incorrect cropping');
    await expect(dialog).toContainText('NOT ACCEPTABLE — Wrong orientation');

    // Verify File Format & Max Size requirements
    await expect(dialog).toContainText('Accepted formats: JPG, PNG, WebP (Max 1MB).');

    // Test Cancel Action: Closes modal
    const cancelButton = dialog.locator('button', { hasText: 'Cancel' });
    await cancelButton.click();
    await expect(dialog).not.toBeVisible();

    // Reopen modal and test Choose Signature Action triggers file chooser
    await signatureCard.click();
    await expect(dialog).toBeVisible();

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      dialog.locator('button', { hasText: 'Choose Signature' }).click(),
    ]);

    expect(fileChooser).toBeDefined();
    await expect(dialog).not.toBeVisible();
  });

  test('verifies responsive layout on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/student/settings/edit-profile');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('Edit Profile');

    // Click mobile change photo button
    const changeButton = page.locator('button:has-text("Change Photo")').first();
    await changeButton.click();

    const dialog = page.locator('div[role="dialog"][aria-labelledby="upload-warning-title"]');
    await expect(dialog).toBeVisible();

    // Action button should be visible and clickable in mobile viewport
    const choosePhotoButton = dialog.locator('button:has-text("Choose Photo")');
    await expect(choosePhotoButton).toBeVisible();

    // Cancel button should be visible and clickable
    const cancelButton = dialog.locator('button:has-text("Cancel")');
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();
    await expect(dialog).not.toBeVisible();
  });
});
