// @ts-check
import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

test.describe('Attendance Marking Flow', () => {
  test.use({ 
    geolocation: { latitude: 17.969, longitude: 79.608 },
    permissions: ['geolocation']
  });

  test('should show attendance bar when a session is active', async ({ page }) => {
    // A valid KUCET roll number format is YY567TBBSS (Regular) or YY567BBSSL (Lateral)
    // 22 = 2022, 567 = KUCET, T = Regular, 09 = CSE, 01 = Serial
    const roll_no = '22567T0901';
    const jwtSecret = process.env.JWT_SECRET || 'temporary_secret_at_least_32_chars_long';
    
    // Generate a valid mock JWT
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

    // Set the auth cookie AND the required companion cookie to bypass redirects
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
    
    // Mock authentication and student data APIs
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
            password_hash: 'hashed_password'
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
        body: JSON.stringify({ 
          data: [{
            assignment_id: 101,
            subject_name: 'SOFTWARE ENGINEERING',
            subject_code: 'CS301'
          }] 
        }),
      });
    });

    await page.route('/api/student/signature', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ latestRequest: null }) });
    });

    await page.route(/\/api\/student\/latest-request.*/, async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ latestRequest: null }) });
    });

    // Mock image 404s to avoid noise
    await page.route('**/*.{png,jpg,jpeg,svg}', route => route.fulfill({ status: 200, body: '' }));

    await page.route('/api/student/current-activity', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ active: false }),
      });
    });

    await page.route(/\/api\/student\/attendance\/active-sessions.*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{
            assignment_id: 101,
            session_id: 202,
            subject_name: 'SOFTWARE ENGINEERING',
            subject_code: 'CS301',
            faculty_name: 'DR. SMITH',
            attendance_date: new Date().toISOString()
          }]
        }),
      });
    });

    // Go to student portal and wait for it to load
    await page.goto('/', { waitUntil: 'networkidle' });

    // Verify successful login (redirects to /student/profile)
    await expect(page).toHaveURL(/\/student\/profile/);
    
    // Check if the name is visible in the profile card
    await expect(page.locator('text=MOCK STUDENT')).toBeVisible();

    // Check if the attendance bar is visible
    await expect(page.locator('text=Attendance Verification Required')).toBeVisible();
    await expect(page.locator('text=SOFTWARE ENGINEERING')).toBeVisible();
    
    const title = await page.title();
    expect(title).toBeDefined();
  });
});
