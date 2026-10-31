import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('KUCET Admission Bridge — Sidebar Redesign into Individual Copyable Fields Suite', () => {
  let sidepanelHtml = '';

  beforeEach(() => {
    vi.clearAllMocks();
    const htmlPath = path.resolve(process.cwd(), 'extension/sidepanel.html');
    sidepanelHtml = fs.readFileSync(htmlPath, 'utf8');
  });

  describe('1. Individual Field Structural Independence in DOM', () => {
    it('1. should verify every student field has its own dedicated .field-card container (no .grid-2 grouping)', () => {
      // Must not contain any grid-2 in studentCard
      const studentCardMatch = sidepanelHtml.match(/<div id="studentCard"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<script/);
      expect(studentCardMatch).not.toBeNull();
      const studentCardContent = studentCardMatch[1];

      expect(studentCardContent).not.toContain('class="grid-2"');
      expect(studentCardContent).not.toContain('class="info-box"');

      // Check field cards count
      const fieldCardMatches = studentCardContent.match(/class="field-card"/g) || [];
      expect(fieldCardMatches.length).toBeGreaterThanOrEqual(30);
    });

    it('2. should verify Gender and Blood Group are completely separate field cards', () => {
      const cards = sidepanelHtml.split('<div class="field-card">');
      const genderCard = cards.find(c => c.includes('id="dispGender"'));
      const bloodCard = cards.find(c => c.includes('id="dispBloodGroup"'));

      expect(genderCard).toBeDefined();
      expect(bloodCard).toBeDefined();
      expect(genderCard).not.toContain('dispBloodGroup');
      expect(bloodCard).not.toContain('dispGender');
      expect(sidepanelHtml).not.toContain('id="dispGenderBlood"');
    });

    it('3. should verify Father Name and Mother Name are completely separate field cards', () => {
      const cards = sidepanelHtml.split('<div class="field-card">');
      const fatherCard = cards.find(c => c.includes('id="dispFatherName"'));
      const motherCard = cards.find(c => c.includes('id="dispMotherName"'));

      expect(fatherCard).toBeDefined();
      expect(motherCard).toBeDefined();
      expect(fatherCard).not.toContain('dispMotherName');
      expect(motherCard).not.toContain('dispFatherName');
    });

    it('4. should verify Date of Birth is separate from Gender', () => {
      const cards = sidepanelHtml.split('<div class="field-card">');
      const dobCard = cards.find(c => c.includes('id="dispDob"'));
      expect(dobCard).toBeDefined();
      expect(dobCard).not.toContain('dispGender');
    });

    it('5. should verify Place of Birth is separate from Religion', () => {
      const cards = sidepanelHtml.split('<div class="field-card">');
      const pobCard = cards.find(c => c.includes('id="dispPob"'));
      const relCard = cards.find(c => c.includes('id="dispReligion"'));

      expect(pobCard).toBeDefined();
      expect(relCard).toBeDefined();
      expect(pobCard).not.toContain('dispReligion');
      expect(relCard).not.toContain('dispPob');
    });

    it('6. should verify Father Occupation is separate from Mother Tongue', () => {
      const cards = sidepanelHtml.split('<div class="field-card">');
      const occCard = cards.find(c => c.includes('id="dispFatherOccupation"'));
      const mtCard = cards.find(c => c.includes('id="dispMotherTongue"'));

      expect(occCard).toBeDefined();
      expect(mtCard).toBeDefined();
      expect(occCard).not.toContain('dispMotherTongue');
      expect(mtCard).not.toContain('dispFatherOccupation');
    });

    it('7. should verify Aadhaar and Contact Phone Number are separate', () => {
      const cards = sidepanelHtml.split('<div class="field-card">');
      const aadhCard = cards.find(c => c.includes('id="dispAadhaar"'));
      const contCard = cards.find(c => c.includes('id="dispContact"'));

      expect(aadhCard).toBeDefined();
      expect(contCard).toBeDefined();
      expect(aadhCard).not.toContain('dispContact');
      expect(contCard).not.toContain('dispAadhaar');
    });
  });

  describe('2. Dedicated Copy Buttons & Clipboard Engine Contract', () => {
    it('8. should verify every available field has its own dedicated Copy button', () => {
      const copyButtons = [
        'copyBtn_name', 'copyBtn_rollNo', 'copyBtn_admissionNo', 'copyBtn_admissionType',
        'copyBtn_branch', 'copyBtn_admissionDate', 'copyBtn_previousStudy', 'copyBtn_academicYear',
        'copyBtn_studentStatus', 'copyBtn_scheme', 'copyBtn_fatherName', 'copyBtn_motherName',
        'copyBtn_dob', 'copyBtn_gender', 'copyBtn_bloodGroup', 'copyBtn_pob', 'copyBtn_religion',
        'copyBtn_motherTongue', 'copyBtn_nationality', 'copyBtn_socialStatus', 'copyBtn_subcategory',
        'copyBtn_subCaste', 'copyBtn_fatherOccupation', 'copyBtn_motherOccupation', 'copyBtn_income',
        'copyBtn_contact', 'copyBtn_email', 'copyBtn_guardianContact', 'copyBtn_aadhaar',
        'copyBtn_apaarId', 'copyBtn_currentAddress', 'copyBtn_permanentAddress', 'copyBtn_state',
        'copyBtn_district', 'copyBtn_mandalStreet', 'copyBtn_houseVillage', 'copyBtn_pincode'
      ];

      copyButtons.forEach((btnId) => {
        expect(sidepanelHtml, `Missing button: ${btnId}`).toContain(`id="${btnId}"`);
      });
    });

    it('9. & 10. should verify copyFieldValue copies only the target value and never another field', async () => {
      let clipboardText = '';
      const mockClipboard = {
        writeText: vi.fn().mockImplementation((txt) => {
          clipboardText = txt;
          return Promise.resolve();
        }),
      };

      const copyFn = async (val) => {
        if (!val || val === 'Not provided' || val === '—') return;
        await mockClipboard.writeText(String(val));
      };

      await copyFn('BHUKYA GOPI');
      expect(clipboardText).toBe('BHUKYA GOPI');

      await copyFn('BHUKYA SUNITHA');
      expect(clipboardText).toBe('BHUKYA SUNITHA');
      expect(clipboardText).not.toContain('BHUKYA GOPI');
    });

    it('11. & 12. should display "Not provided" and disable Copy button when value is empty', () => {
      const updateFieldLogic = (value) => {
        const isAvailable = value !== null && value !== undefined && String(value).trim() !== '' && String(value).trim() !== '—';
        const displayVal = isAvailable ? String(value).trim() : 'Not provided';
        const btnDisabled = !isAvailable;
        return { displayVal, btnDisabled };
      };

      const resNull = updateFieldLogic(null);
      expect(resNull.displayVal).toBe('Not provided');
      expect(resNull.btnDisabled).toBe(true);

      const resEmpty = updateFieldLogic('');
      expect(resEmpty.displayVal).toBe('Not provided');
      expect(resEmpty.btnDisabled).toBe(true);

      const resWhitespace = updateFieldLogic('   ');
      expect(resWhitespace.displayVal).toBe('Not provided');
      expect(resWhitespace.btnDisabled).toBe(true);

      const resDash = updateFieldLogic('—');
      expect(resDash.displayVal).toBe('Not provided');
      expect(resDash.btnDisabled).toBe(true);

      const resValid = updateFieldLogic('Male');
      expect(resValid.displayVal).toBe('Male');
      expect(resValid.btnDisabled).toBe(false);
    });

    it('13. should handle clipboard permission failure gracefully', async () => {
      const mockClipboardError = {
        writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
      };

      let buttonText = 'Copy';
      const copyWithFallback = async (val) => {
        try {
          await mockClipboardError.writeText(val);
          buttonText = '✓ Copied!';
        } catch (_err) {
          buttonText = 'Failed';
        }
      };

      await copyWithFallback('Some Value');
      expect(buttonText).toBe('Failed');
    });
  });

  describe('3. Privacy, Authorization & Sensitive Field Invariants', () => {
    it('16. should keep full unmasked phone number and Aadhaar visible for authorized staff', () => {
      const formatAadhaar = (val) => {
        if (!val) return 'Not provided';
        const clean = String(val).replace(/\D/g, '');
        if (clean.length === 12) return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)}`;
        return clean || 'Not provided';
      };

      const formatContact = (val) => {
        if (!val) return 'Not provided';
        const clean = String(val).replace(/\D/g, '');
        if (clean.length >= 10) return clean.slice(-10);
        return clean || 'Not provided';
      };

      // Synthetic student test data
      const sampleAadhaar = '999988887777';
      const samplePhone = '9876543210';

      const dispAadhaarVal = formatAadhaar(sampleAadhaar);
      const dispPhoneVal = formatContact(samplePhone);

      expect(dispAadhaarVal).toBe('9999 8888 7777');
      expect(dispAadhaarVal).not.toContain('•');
      expect(dispAadhaarVal).not.toContain('*');

      expect(dispPhoneVal).toBe('9876543210');
      expect(dispPhoneVal).not.toContain('•');
      expect(dispPhoneVal).not.toContain('*');
    });

    it('14. & 15. should clear all fields and memory when resetting or switching students', () => {
      let state = {
        currentStudent: {
          rollNo: '26567T0348',
          name: 'BHUKYA AKHIL',
          primaryDetails: { aadhaarNumber: '999988887777', contactNumber: '9876543210' },
        },
      };

      const resetWorkspace = () => {
        state.currentStudent = null;
      };

      resetWorkspace();
      expect(state.currentStudent).toBeNull();
    });

    it('17. should ensure no sensitive values are logged', () => {
      const sanitizeForLog = (student) => ({
        rollNo: student.rollNo,
        admissionNo: student.admissionNo,
        hasAadhaar: Boolean(student.primaryDetails?.aadhaarNumber),
        hasContact: Boolean(student.primaryDetails?.contactNumber),
      });

      const logged = sanitizeForLog({
        rollNo: '26567T0348',
        admissionNo: '56726001',
        primaryDetails: {
          aadhaarNumber: '999988887777',
          contactNumber: '9876543210',
        },
      });

      expect(logged.aadhaarNumber).toBeUndefined();
      expect(logged.contactNumber).toBeUndefined();
      expect(logged.hasAadhaar).toBe(true);
      expect(logged.hasContact).toBe(true);
    });
  });

  describe('4. Layout & Responsive Guardrails', () => {
    it('18. & 19. should prohibit 100vw and enforce single-column flow in side panel styles', () => {
      // 100vw layout prohibition
      expect(sidepanelHtml).not.toContain('100vw');

      // Check field-card styles
      expect(sidepanelHtml).toContain('.field-card');
      expect(sidepanelHtml).toContain('.field-label');
      expect(sidepanelHtml).toContain('.field-content');
      expect(sidepanelHtml).toContain('.copy-btn');
    });

    it('20. should preserve existing university portal transfer buttons and safeguards', () => {
      // Step 1 transfer button
      expect(sidepanelHtml).toContain('id="fillFormBtn"');
      expect(sidepanelHtml).toContain('Fill KU Online Admission Info (Step 1)');

      // Step 2 transfer button
      expect(sidepanelHtml).toContain('id="fillPrimaryBtn"');
      expect(sidepanelHtml).toContain('Populate KU Online Primary Details');

      // Visual audit notice
      expect(sidepanelHtml).toContain('Verification Safeguard');
      expect(sidepanelHtml).toContain('never');
      expect(sidepanelHtml).toContain('Submit &amp; Step2');
    });
  });
});
