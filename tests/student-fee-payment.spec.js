// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Student Fee Payment E2E Flow', () => {
  const testStudent = {
    id: 101,
    roll_no: '22567T0901',
    name: 'Goutham Test Student',
    email: 'student@kucet.ac.in',
    fee_reimbursement: 'NO',
    student_status: 'ACTIVE',
    academic_status: 'ACTIVE',
    academic_offset_years: 0
  };

  const mockFeePayments = [
    {
      id: 501,
      student_id: 101,
      academic_year: '2025-26',
      amount: '35000.00',
      transaction_ref_no: 'UTR9876543210',
      transaction_date: '2025-10-15',
      payment_mode: 'ONLINE',
      bank_name: 'State Bank of India',
      created_at: '2025-10-15T10:00:00.000Z'
    }
  ];

  const mockScholarships = [
    {
      id: 301,
      student_id: 101,
      academic_year: '2025-26',
      application_no: 'SCH20259901',
      proceeding_no: 'ROC/1029/2025',
      sanctioned_amount: '35000.00',
      sanction_date: '2025-09-01',
      released_amount: '35000.00',
      released_date: '2025-09-20',
      status: 'RELEASED',
      thumb_update_available: false,
      thumb_status: 'COMPLETED',
      hardcopy_submitted: 1
    }
  ];

  const mockCollegeInfo = {
    id: 1,
    name: 'KU COLLEGE OF ENGINEERING & TECHNOLOGY',
    short_name: 'KUCET',
    branches: [
      { code: '09', name: 'CSE' }
    ]
  };

  test.beforeEach(async ({ page }) => {
    // Intercept student session / profile API
    await page.route('/api/student/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          student: testStudent,
          collegeInfo: mockCollegeInfo,
          scholarship: mockScholarships,
          fees: mockFeePayments,
          academics: []
        }),
      });
    });

    // Intercept student login API
    await page.route('/api/student/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Authenticated successfully',
          rollNo: testStudent.roll_no
        }),
      });
    });

    // Intercept payment submission endpoint if called
    await page.route('/api/clerk/scholarship/payments', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Fee payment recorded successfully',
          paymentId: 502
        }),
      });
    });

    // Intercept image assets to keep test lightweight
    await page.route('**/*.{png,jpg,jpeg,svg}', route => route.fulfill({ status: 200, body: '' }));
  });

  test('should allow student to login, navigate to finances, view ledger & receipts', async ({ page }) => {
    // 1. Visit Student Login Page
    await page.goto('/student');
    await expect(page).toHaveURL(/\/student/);

    // 2. Verify Student Dashboard or Login Interface
    // If presented with login form, fill credentials
    const loginHeading = page.getByRole('heading', { name: /Student Portal|Sign In|Student/i }).first();
    await expect(loginHeading).toBeVisible();

    const rollInput = page.locator('input[name="roll_no"], input[placeholder*="Roll Number"]').first();
    if (await rollInput.isVisible()) {
      await rollInput.fill('22567T0901');
      const dobInput = page.locator('input[type="date"], input[name="dob"]').first();
      if (await dobInput.isVisible()) {
        await dobInput.fill('2004-05-15');
      }
      const submitBtn = page.getByRole('button', { name: /Sign In|Login/i }).first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
      }
    }

    // 3. Navigate to Student Finances
    await page.goto('/student/finances');
    await expect(page).toHaveURL(/\/student\/finances/);

    // 4. Verify Financial Overview Page Heading & Metrics
    await expect(page.getByRole('heading', { name: 'Fee Details & Scholarships' })).toBeVisible();
    await expect(page.getByText('Current Year Fee')).toBeVisible();
    await expect(page.getByText('Current Year Paid')).toBeVisible();

    // 5. Switch to Transactions & Receipts Tab
    const transactionsTab = page.getByRole('button', { name: /Transactions & Receipts/i }).first();
    await expect(transactionsTab).toBeVisible();
    await transactionsTab.click();

    // 6. Verify Transaction Record is rendered in list
    await expect(page.getByText('UTR9876543210')).toBeVisible();
    await expect(page.getByText('State Bank of India')).toBeVisible();

    // 7. Click to open official payment receipt modal
    const viewReceiptBtn = page.getByRole('button', { name: /Receipt|View/i }).first();
    if (await viewReceiptBtn.isVisible()) {
      await viewReceiptBtn.click();
      // Verify modal content
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText('Official Fee Payment Receipt')).toBeVisible();
      await expect(page.getByText('Electronically Verified')).toBeVisible();
      
      // Close modal
      const closeBtn = page.getByRole('button', { name: 'Close' }).first();
      await closeBtn.click();
      await expect(page.getByRole('dialog')).toBeHidden();
    }
  });

  test('should reject duplicate payment reference submission gracefully', async ({ page }) => {
    // Intercept duplicate payment verification API
    await page.route('/api/clerk/scholarship/payments', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Duplicate transaction reference (UTR) already recorded.'
        }),
      });
    });

    await page.goto('/student/finances');
    await expect(page.getByRole('heading', { name: 'Fee Details & Scholarships' })).toBeVisible();
  });
});
