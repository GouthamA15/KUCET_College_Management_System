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
    page.on('console', msg => console.info('PAGE LOG:', msg.text()));
    await expect(page.getByRole('heading', { name: /B.TECH/ })).toBeVisible();

    // Fill personal information
    await page.getByLabel('1. Name of the Student (as per memo)').fill('TEST STUDENT');
    await page.getByLabel("2. Father's Name (as per memo)").fill('TEST FATHER');
    await page.getByLabel("3. Mother's Name (as per memo)").fill('TEST MOTHER');
    
    // Selection
    await page.getByLabel('4. Entrance Exam & Branch').first().selectOption('TG EAPCET');
    await page.getByLabel('Branch', { exact: true }).selectOption({ label: 'CSE' });
    
    await page.getByLabel('7. Category').selectOption('OC');
    await page.getByLabel('11. Gender').selectOption('Male');
    
    await page.getByLabel('5. TG ECET / TG EAPCET Rank Details').fill('1234');
    await page.getByLabel('8. Sub Caste').fill('TEST CASTE');
    await page.getByLabel('9. Seat Allotted Category').fill('OC_GEN_UR');
    
    // Date of Birth
    await page.getByLabel('10. Date of Birth').fill('2005-01-01');
    
    await page.getByLabel('13. Religion').selectOption('HINDU');
    await page.getByLabel('14. Mother Tongue').fill('TELUGU');
    await page.getByLabel('16. SSC / 10th Marks').fill('950');
    await page.getByLabel('17. Intermediate (for TG EAPCET) / Diploma (for TG ECET) Marks').fill('900');
    
    // Nationality
    await page.getByLabel('12. Nationality').fill('INDIAN');
    
    // Annual Income (Now back to input with formatting)
    await page.getByLabel('20. Annual Income').selectOption('Less than 1,00,000');

    await page.getByLabel('21. Student Aadhaar Number').fill('1234 5678 9012');
    
    // Mobile numbers
    await page.getByLabel('22. Student Mobile Number').fill('9876543210');
    await page.getByLabel('23. Father / Guardian Mobile Number').fill('9876543211');
    
    await page.getByLabel('24. Mail ID of the Student').fill(`teststudent_${Date.now()}@example.com`);
    
    // Current Address
    await page.locator('#curr_house_no').fill('123');
    await page.locator('#curr_street').fill('Test Street');
    await page.locator('#curr_city').fill('City');
    await page.locator('#curr_state').fill('Telangana');
    await page.locator('#curr_pincode').fill('506001');
    await page.locator('#curr_country').fill('India');
    
    // Mark as permanent
    await page.getByLabel('Mark as permanent address').check();

    // Upload files
    const fileInputs = await page.locator('input[type="file"]');
    await fileInputs.first().setInputFiles(mockImagePath); // PFP
    await fileInputs.last().setInputFiles(mockImagePath); // Signature

    // Wait for internal state update (FileReader) to finish compressing images
    await page.waitForTimeout(1000);

    // Accept legal consent
    await page.locator('#legal_consent').check();

    // Submit the form
    await page.getByRole('button', { name: 'Submit Application' }).click();

    // Wait for success message
    await expect(page.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Your admission request has been submitted')).toBeVisible();
  });
});
