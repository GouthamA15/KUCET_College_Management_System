// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Student Admission Flow', () => {
  const mockImagePath = path.join(__dirname, 'mock-image.png');

  test.beforeAll(async () => {
    // Create a mock image file for testing uploads
    if (!fs.existsSync(mockImagePath)) {
      const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
      fs.writeFileSync(mockImagePath, buffer);
    }
  });

  test.afterAll(async () => {
    if (fs.existsSync(mockImagePath)) {
      fs.unlinkSync(mockImagePath);
    }
  });

  test('should submit a student admission draft successfully', async ({ page }) => {
    // Mock image 404s to avoid noise and potential interruptions
    await page.route('**/*.{png,jpg,jpeg,svg}', route => route.fulfill({ status: 200, body: '' }));

    // Mock the admission submission API
    await page.route('/api/public/admission', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Success' }),
      });
    });

    await page.goto('/admission');

    // Fill personal information
    await page.fill('input[placeholder="FULL NAME"]', 'TEST STUDENT');
    await page.fill('input[placeholder="FATHER\'S FULL NAME"]', 'TEST FATHER');
    await page.fill('input[placeholder="MOTHER\'S FULL NAME"]', 'TEST MOTHER');
    
    // Selection
    await page.selectOption('select >> nth=0', 'EAMCET');
    await page.selectOption('select >> nth=1', 'CSE');
    
    await page.fill('input[placeholder="ENTRANCE RANK"]', '1234');
    await page.fill('input[placeholder="SUB CASTE"]', 'TEST CASTE');
    await page.fill('input[placeholder="e.g. OC_GEN_UR"]', 'OC_GEN_UR');
    
    // Date of Birth
    await page.fill('input[type="date"]', '2005-01-01');
    
    await page.fill('input[placeholder="RELIGION"]', 'HINDU');
    await page.fill('input[placeholder="MOTHER TONGUE"]', 'TELUGU');
    await page.fill('input[placeholder="TOTAL MARKS / CGPA"]', '950');
    await page.fill('input[placeholder="MARKS OBTAINED"]', '900');
    
    await page.fill('input[placeholder="ANNUAL INCOME"]', '100000');
    await page.fill('input[placeholder="XXXX XXXX XXXX"]', '1234 5678 9012');
    
    // Mobile numbers
    const studentMobiles = await page.$$('input[pattern="[0-9]{10}"]');
    await studentMobiles[0].fill('9876543210');
    await studentMobiles[1].fill('9876543211');
    
    await page.fill('input[type="email"]', `teststudent_${Date.now()}@example.com`);
    await page.fill('textarea', '123 Test Street, College Road, City');

    // Upload files
    const fileInputs = await page.$$('input[type="file"]');
    await fileInputs[0].setInputFiles(mockImagePath); // PFP
    await fileInputs[1].setInputFiles(mockImagePath); // Signature

    // Wait for internal state update (FileReader)
    await page.waitForTimeout(500);

    // Submit the form
    await page.click('button:has-text("Submit Admission Form")');

    // Wait for success message
    await expect(page.locator('h2')).toHaveText('Success!', { timeout: 15000 });
    await expect(page.locator('text=Your admission request has been submitted')).toBeVisible();
  });
});
