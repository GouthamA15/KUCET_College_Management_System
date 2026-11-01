import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapBloodGroupToPortal } from '@/lib/admission-bridge/derivation';
import fs from 'fs';
import path from 'path';

describe('KUCET Admission Bridge — Final Release Polish, UX, Reliability & Performance Suite', () => {
  let contentJs = '';
  let sidepanelJs = '';
  let sidepanelHtml = '';

  beforeEach(() => {
    vi.clearAllMocks();
    contentJs = fs.readFileSync(path.resolve(process.cwd(), 'extension/content.js'), 'utf8');
    sidepanelJs = fs.readFileSync(path.resolve(process.cwd(), 'extension/sidepanel.js'), 'utf8');
    sidepanelHtml = fs.readFileSync(path.resolve(process.cwd(), 'extension/sidepanel.html'), 'utf8');
  });

  describe('1. Blood Group Fallback & Strict Mapping Specifications', () => {
    it('should correctly map all standard valid Blood Groups (A+, A-, B+, B-, AB+, AB-, O+, O-)', () => {
      const groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
      groups.forEach(g => {
        const res = mapBloodGroupToPortal(g);
        expect(res.portalOption).toBe(g);
        expect(res.status).toBe('VERIFIED');
      });
    });

    it('should normalize lowercase and spaced valid Blood Groups', () => {
      expect(mapBloodGroupToPortal('a+').portalOption).toBe('A+');
      expect(mapBloodGroupToPortal('b -').portalOption).toBe('B-');
      expect(mapBloodGroupToPortal(' ab + ').portalOption).toBe('AB+');
      expect(mapBloodGroupToPortal('o+').portalOption).toBe('O+');
    });

    it('should map null, undefined, empty string, and whitespace-only to Not-Available', () => {
      expect(mapBloodGroupToPortal(null).portalOption).toBe('Not-Available');
      expect(mapBloodGroupToPortal(undefined).portalOption).toBe('Not-Available');
      expect(mapBloodGroupToPortal('').portalOption).toBe('Not-Available');
      expect(mapBloodGroupToPortal('   ').portalOption).toBe('Not-Available');
      expect(mapBloodGroupToPortal(null).status).toBe('NOT_AVAILABLE');
    });

    it('should map explicitly unavailable strings to Not-Available', () => {
      expect(mapBloodGroupToPortal('Not available').portalOption).toBe('Not-Available');
      expect(mapBloodGroupToPortal('Not-Available').portalOption).toBe('Not-Available');
      expect(mapBloodGroupToPortal('N/A').portalOption).toBe('Not-Available');
      expect(mapBloodGroupToPortal('NA').portalOption).toBe('Not-Available');
      expect(mapBloodGroupToPortal('NONE').portalOption).toBe('Not-Available');
      expect(mapBloodGroupToPortal('UNKNOWN').portalOption).toBe('Not-Available');
    });

    it('should NEVER silently convert unknown non-empty values into Not-Available', () => {
      const unmapped = mapBloodGroupToPortal('XYZ_INVALID');
      expect(unmapped.portalOption).toBeNull();
      expect(unmapped.status).toBe('UNMAPPED');
      expect(unmapped.warning).toContain('Requires manual verification');
    });

    it('should verify content script contains strict Blood Group selection logic and never leaves -Select- selected', () => {
      expect(contentJs).toContain('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_ddBlood');
      expect(contentJs).toContain('targetOption = \'Not-Available\'');
      expect(contentJs).toContain('Blood Group requires manual verification: unmapped value');
      expect(contentJs).toContain('Missing \'Not-Available\' option in portal dropdown');
      expect(contentJs).toContain('Blood Group verification failed: default "-Select-" remains selected');
    });
  });

  describe('2. Profile Photograph & Signature Upload Reliability', () => {
    it('should verify the established filename convention is enforced (${admissionNo}.jpg and ${admissionNo}(1).jpg)', () => {
      expect(sidepanelJs).toContain('photoName = s.photo?.expectedFilename');
      expect(sidepanelJs).toContain('sigName = s.signature?.expectedFilename');
      expect(sidepanelJs).toContain('${admissionNo}.jpg');
      expect(sidepanelJs).toContain('${admissionNo}(1).jpg');
    });

    it('should verify content script attaches media to correct, non-swapped inputs', () => {
      expect(contentJs).toContain('ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_fuStudentPhoto');
      expect(contentJs).toContain('ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_ChkStudentPhoto');
      expect(contentJs).toContain('ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_fusign');
      expect(contentJs).toContain('ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_ChkSignature');

      // Verify photo attachment uses photo input and sign attachment uses sign input
      const photoBlock = contentJs.slice(contentJs.indexOf('// 8. Photo Attachment'), contentJs.indexOf('// 9. Signature Attachment'));
      expect(photoBlock).toContain('fuStudentPhoto');
      expect(photoBlock).not.toContain('fusign');

      const sigBlock = contentJs.slice(contentJs.indexOf('// 9. Signature Attachment'), contentJs.indexOf('// Clear pending postback'));
      expect(sigBlock).toContain('fusign');
      expect(sigBlock).not.toContain('fuStudentPhoto');
    });

    it('should report upload status as "Attached — awaiting portal confirmation"', () => {
      expect(contentJs).toContain('Attached — awaiting portal confirmation');
    });

    it('should verify separate image states and independent retry buttons in sidepanel DOM', () => {
      expect(sidepanelHtml).toContain('id="photoBadge"');
      expect(sidepanelHtml).toContain('id="sigBadge"');
      expect(sidepanelHtml).toContain('id="retryPhotoBtn"');
      expect(sidepanelHtml).toContain('id="retrySigBtn"');
    });

    it('should verify independent retry functions exist for both photo and signature', () => {
      expect(sidepanelJs).toContain('handleRetryAttachPhoto');
      expect(sidepanelJs).toContain('handleRetryAttachSig');
      expect(sidepanelJs).toContain('PORTAL_ATTACH_STUDENT_MEDIA');
    });

    it('should verify temporary object URLs are revoked to prevent memory leaks', () => {
      expect(sidepanelJs).toContain('URL.revokeObjectURL(photoThumb.src)');
      expect(sidepanelJs).toContain('URL.revokeObjectURL(sigThumb.src)');
    });
  });

  describe('3. Scope Invariants: Education & Fee Details and Documents Exclusion', () => {
    it('should confirm Education & Fee Details and Documents are strictly outside extension automation', () => {
      expect(contentJs).not.toContain('Education & Fee');
      expect(contentJs).not.toContain('TabPanel3'); // TabContainer panel for Education/Fee
      expect(contentJs).not.toContain('tbpnlEdu');
      expect(contentJs).not.toContain('tbpnlDocs');
    });

    it('should verify the extension tutorial explicitly explains the scope exclusion', () => {
      const tutorialJs = fs.readFileSync(path.resolve(process.cwd(), 'extension/tutorial.js'), 'utf8');
      expect(tutorialJs).toContain('Scope Restriction: Education & Fee Details and Documents are handled by browser autofill');
    });

    it('should verify the extension preserves the Inviolable Safeguard: NEVER auto-submits university form', () => {
      expect(sidepanelHtml).toContain('It will <strong>never</strong> submit the form');
      expect(contentJs).not.toContain('BtnSubmit_Click');
      expect(contentJs).not.toContain('.click() on submit button');
    });
  });

  describe('4. UI/UX, Navigation & Staff Oversight', () => {
    it('should verify staff identity badge in header', () => {
      expect(sidepanelHtml).toContain('id="staffIdentityBadge"');
      expect(sidepanelJs).toContain('staffIdentityBadge.textContent = staffName');
    });

    it('should verify clear portal connection states (Connected, Reconnecting, Portal Tab Unavailable)', () => {
      expect(sidepanelJs).toContain('Connected (Btechreg.aspx)');
      expect(sidepanelJs).toContain('Portal Tab Not Found');
    });

    it('should verify duplicate click prevention on all action buttons', () => {
      expect(sidepanelJs).toContain('isTransferringStep1');
      expect(sidepanelJs).toContain('isTransferringStep2');
      expect(sidepanelJs).toContain('isRetryingPhoto');
      expect(sidepanelJs).toContain('isRetryingSig');
    });

    it('should verify old student information is cleared on lookup failure to prevent cross-student contamination', () => {
      const catchBlock = sidepanelJs.slice(sidepanelJs.indexOf('handleFetchStudent'), sidepanelJs.indexOf('renderStudentDetails'));
      expect(catchBlock).toContain('currentStudent = null');
      expect(catchBlock).toContain('optimizedPhoto = null');
      expect(catchBlock).toContain('optimizedSignature = null');
    });
  });
});
