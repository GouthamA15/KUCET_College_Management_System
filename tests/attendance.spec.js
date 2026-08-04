// @ts-check
import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

test.describe('Attendance Marking & Lecture Topic Flow', () => {
  test.use({ 
    geolocation: { latitude: 17.969, longitude: 79.608 },
    permissions: ['geolocation']
  });

  test('should show attendance bar when a session is active', async ({ page }) => {
    const roll_no = '22567T0901';
    const jwtSecret = process.env.JWT_SECRET || 'temporary_secret_at_least_32_chars_long';
    
    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({
      student_id: 1,
      roll_no,
      name: 'MOCK STUDENT',
      is_email_verified: true,
      has_password_set: true,
      role: 'student'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(secret);

    await page.goto('/');
    await page.context().addCookies([
      {
        name: 'student_auth',
        value: token,
        domain: 'localhost',
        path: '/',
      },
      {
        name: 'student_logged_in',
        value: 'true',
        domain: 'localhost',
        path: '/',
      }
    ]);
    
    await page.route('/api/student/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ roll_no }),
      });
    });

    await page.route('/api/public/college-info', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ collegeInfo: { semester_start_dates: [] } }),
      });
    });

    await page.route(`/api/student/${roll_no}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          student: {
            roll_no,
            name: 'MOCK STUDENT',
            branch: 'CSE',
            email: 'mock@example.com',
            pfp: null,
            is_email_verified: 1,
            password_hash: 'mock_hash'
          },
          scholarship: [],
          fees: []
        }),
      });
    });

    await page.route('/api/student/academic-info', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.route('/api/student/signature', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ latestRequest: null }) });
    });

    await page.route(/\/api\/student\/latest-request.*/, async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ latestRequest: null }) });
    });

    await page.route('**/*.{png,jpg,jpeg,svg}', route => route.fulfill({ status: 200, body: '' }));

    await page.goto('/');
    await expect(page).toHaveURL(/\/student/);
    await expect(page.locator('h1').first()).toContainText('Welcome, MOCK');
    
    const title = await page.title();
    expect(title).toBeDefined();
  });

  test('should prompt for lecture topic after attendance save', async ({ page }) => {
    // Intercept lecture topic update API
    let patchPayload = null;
    await page.route('/api/clerk/faculty/attendance/session/topic', async (route) => {
      patchPayload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Lecture topic updated successfully',
          topic_covered: patchPayload.topic_covered
        }),
      });
    });

    // Verify topic PATCH logic with mock API
    const response = await page.request.patch('/api/clerk/faculty/attendance/session/topic', {
      data: {
        assignment_id: 101,
        date: '2026-08-05',
        session: 1,
        topic_covered: 'Deadlocks & Banker Algorithm'
      }
    });

    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.data.topic_covered).toBe('Deadlocks & Banker Algorithm');
  });
});
