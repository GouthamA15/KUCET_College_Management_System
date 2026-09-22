// @ts-check
import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

test.describe('Student Achievements E2E Flow', () => {
  const testStudent = {
    id: 101,
    roll_no: '22567T0901',
    name: 'Goutham Test Student',
    email: 'student@kucet.ac.in',
    student_status: 'ACTIVE',
    academic_status: 'ACTIVE',
    academic_offset_years: 0
  };

  const mockCollegeInfo = {
    id: 1,
    name: 'KU COLLEGE OF ENGINEERING & TECHNOLOGY',
    short_name: 'KUCET',
    branches: [
      { code: '09', name: 'CSE' }
    ]
  };

  const mockAchievements = [
    {
      id: 1,
      student_id: 101,
      achievement_type: 'Certification',
      title: 'AWS Certified Cloud Practitioner',
      issuing_organization: 'Amazon Web Services',
      academic_year: '2026-27',
      achievement_date: '2026-08-15',
      achievement_level: 'International',
      certificate_file_path: 'students/achievements/mock-cert.png',
      certificate_mime_type: 'image/png'
    }
  ];

  /** @type {string} */
  let studentToken;

  test.beforeAll(async () => {
    // Generate a valid student JWT for the test session
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

    // Mock /api/public/college-info
    await page.route('/api/public/college-info', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ collegeInfo: mockCollegeInfo }),
      });
    });

    // Mock student profile endpoint
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

    // Mock subjects fetching (used in academics page)
    await page.route('**/api/student/academic-info*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          semester: 1,
          academicYear: '2026-27'
        }),
      });
    });

    // Mock signature & latest-request endpoints
    await page.route('**/api/student/signature', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ latestRequest: null }) });
    });
    await page.route(/\/api\/student\/latest-request.*/, async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ latestRequest: null }) });
    });

    // Mock student/me endpoint
    await page.route('**/api/student/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: testStudent.id,
          roll_no: testStudent.roll_no,
          name: testStudent.name,
          email: testStudent.email,
          student_status: testStudent.student_status,
          academic_status: testStudent.academic_status,
          academic_offset_years: testStudent.academic_offset_years,
          is_email_verified: 1,
          has_password_set: true,
          mobile: null,
          personal_details: null,
        }),
      });
    });
  });

  test('should display empty state when no achievements exist', async ({ page }) => {
    await page.route('/api/student/achievements', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
    });

    await page.goto('/student/academics');
    
    // Switch to Achievements tab
    await page.click('button:has-text("Achievements")');

    // Wait for the empty state to appear
    await expect(page.locator('text="No achievements added yet"')).toBeVisible();
    await expect(page.locator('button:has-text("Add Achievement")')).toBeVisible();
  });

  test('should render existing achievements', async ({ page }) => {
    await page.route('/api/student/achievements', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAchievements),
        });
      }
    });

    await page.goto('/student/academics');
    
    // Switch to Achievements tab
    await page.click('button:has-text("Achievements")');

    // The mock achievement should be visible
    await expect(page.locator('text="AWS Certified Cloud Practitioner"')).toBeVisible();
    await expect(page.locator('text="Amazon Web Services"')).toBeVisible();
  });

  test('should add a new achievement', async ({ page }) => {
    let requestCount = 0;
    
    await page.route('/api/student/achievements', async (route) => {
      if (route.request().method() === 'GET') {
        if (requestCount === 0) {
          // Initially empty
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
        }
      } else if (route.request().method() === 'POST') {
        requestCount++;
        const postData = JSON.parse(route.request().postData());
        
        // Mock the response of successful creation
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 2,
            student_id: 101,
            achievement_type: postData.achievement_type,
            title: postData.title,
            issuing_organization: postData.issuing_organization,
            academic_year: postData.academic_year,
            achievement_level: postData.achievement_level
          }),
        });
      }
    });

    await page.goto('/student/academics');
    
    // Switch to Achievements tab
    await page.click('button:has-text("Achievements")');
    
    // Click Add Achievement
    await page.click('button:has-text("Add Achievement")');

    // Fill the modal form
    await page.selectOption('select[name="achievement_type"]', 'Hackathon');
    await page.fill('input[name="title"]', 'Hackathon Winner');
    await page.fill('input[name="issuing_organization"]', 'MLH');
    await page.selectOption('select[name="achievement_level"]', 'National');
    
    // Set academic year (we assume it generates current year)
    // We just select the first available option
    const yearSelect = page.locator('select[name="academic_year"]');
    await yearSelect.selectOption({ index: 1 }); // Index 0 is disabled 'Select year'

    // Mock file upload (base64 string handling requires actual file if input type="file")
    // Let's create a dummy image file and upload it
    const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    await page.setInputFiles('input[type="file"]', {
      name: 'test-cert.png',
      mimeType: 'image/png',
      buffer
    });

    // Save
    await page.click('button:has-text("Save Achievement")');

    // The modal should close and the new card should render immediately
    await expect(page.locator('text="Hackathon Winner"')).toBeVisible();
    await expect(page.locator('text="MLH"')).toBeVisible();
  });

  test('should delete an achievement', async ({ page }) => {
    let deleteCalled = false;
    
    await page.route('/api/student/achievements', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAchievements), // 1 achievement initially
        });
      }
    });

    await page.route('/api/student/achievements/1', async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Achievement deleted' }),
        });
      }
    });

    await page.goto('/student/academics');
    
    // Switch to Achievements tab
    await page.click('button:has-text("Achievements")');

    // The mock achievement should be visible
    await expect(page.locator('text="AWS Certified Cloud Practitioner"')).toBeVisible();

    // Click Delete button
    await page.click('button[title="Delete Achievement"]');

    // Wait for confirmation modal and click Delete inside it
    await expect(page.locator('text="Delete Achievement?"')).toBeVisible();
    await page.click('button:has-text("Delete")');

    // The modal should close and the UI should be empty
    await expect(page.locator('text="Delete Achievement?"')).not.toBeVisible();
    await expect(page.locator('text="No achievements added yet"')).toBeVisible();
    
    // Verify backend was called
    expect(deleteCalled).toBe(true);
  });
});

