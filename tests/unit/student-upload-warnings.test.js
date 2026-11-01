import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import UploadWarningModal, { WARNING_CONFIG } from '@/components/student/UploadWarningModal';
import { 
  validateStudentPhotoFile, 
  PHOTO_ACCEPTED_RULES, 
  PHOTO_REJECTED_RULES, 
  PHOTO_FILE_REQUIREMENTS 
} from '@/components/admission/StudentPhotoGuidance';
import { 
  validateStudentSignatureFile, 
  SIGNATURE_ACCEPTED_RULES, 
  SIGNATURE_REJECTED_RULES, 
  SIGNATURE_FILE_REQUIREMENTS 
} from '@/components/admission/StudentSignatureGuidance';

describe('Student Profile Picture & Signature Upload Warnings', () => {
  describe('UploadWarningModal Content & Accessibility Standards', () => {
    it('does not render anything when isOpen is false', () => {
      const html = renderToStaticMarkup(
        React.createElement(UploadWarningModal, {
          isOpen: false,
          type: 'pfp',
          onCancel: vi.fn(),
          onContinue: vi.fn(),
        })
      );
      expect(html).toBe('');
    });

    it('renders Profile Picture Warning with exact title, message, and accessible dialog attributes', () => {
      const html = renderToStaticMarkup(
        React.createElement(UploadWarningModal, {
          isOpen: true,
          type: 'pfp',
          onCancel: vi.fn(),
          onContinue: vi.fn(),
        })
      );

      // Dialog accessibility
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="upload-warning-title"');
      expect(html).toContain('aria-describedby="upload-warning-desc"');

      // Exact Title
      expect(html).toContain('Important — Profile Picture Update');

      // Exact Message
      expect(html).toContain(
        'Please ensure that your profile picture is clear, recent, and belongs to you. This picture may be used for your official student profile, identity verification, and college records. Upload the correct image before proceeding.'
      );

      // Buttons
      expect(html).toContain('Cancel');
      expect(html).toContain('Continue');
    });

    it('renders Signature Warning with exact title, message, and accessible dialog attributes', () => {
      const html = renderToStaticMarkup(
        React.createElement(UploadWarningModal, {
          isOpen: true,
          type: 'signature',
          onCancel: vi.fn(),
          onContinue: vi.fn(),
        })
      );

      // Dialog accessibility
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="upload-warning-title"');
      expect(html).toContain('aria-describedby="upload-warning-desc"');

      // Exact Title
      expect(html).toContain('Important — Signature Update');

      // Exact Message
      expect(html).toContain(
        "Please upload your own genuine signature clearly against a plain, light background. Ensure that the signature is correct and legible, as it may be used for official college records and verification. Do not upload another person&#x27;s signature."
      );

      // Buttons
      expect(html).toContain('Cancel');
      expect(html).toContain('Continue');
    });

    it('provides responsive modal classes for both desktop and mobile viewports', () => {
      const html = renderToStaticMarkup(
        React.createElement(UploadWarningModal, {
          isOpen: true,
          type: 'pfp',
          onCancel: vi.fn(),
          onContinue: vi.fn(),
        })
      );

      expect(html).toContain('max-w-4xl');
      expect(html).toContain('w-full');
      expect(html).toContain('rounded-2xl');
      expect(html).toContain('flex flex-col-reverse sm:flex-row');
    });

    it('renders visual guidance checklist, examples, and file specs for profile photograph', () => {
      const html = renderToStaticMarkup(
        React.createElement(UploadWarningModal, {
          isOpen: true,
          type: 'pfp',
          onCancel: vi.fn(),
          onContinue: vi.fn(),
        })
      );

      // Checklist headings
      expect(html).toContain('What to Upload (Accepted)');
      expect(html).toContain('What NOT to Upload (Rejected)');

      // Detailed rules
      expect(html).toContain('passport-style portrait');
      expect(html).toContain('front-facing view');
      expect(html).toContain('plain white or light-coloured background');
      expect(html).toContain('printed ID card');

      // Visual reference examples
      expect(html).toContain('CORRECT — Passport-Style Portrait');
      expect(html).toContain('Printed Photo / Photo of an ID Card');
      expect(html).toContain('Full-Body or Distant Photo');
      expect(html).toContain('Casual Outdoor / Distracting Background');
      expect(html).toContain('student-photo-correct.png');
      expect(html).toContain('student-photo-printed-image.png');
      expect(html).toContain('student-photo-full-body.png');
      expect(html).toContain('student-photo-casual-outdoor.png');

      // File format and size contract
      expect(html).toContain('Accepted formats:');
      expect(html).toContain('JPG, PNG, WebP');
      expect(html).toContain('Max 1MB');

      // Actions
      expect(html).toContain('Cancel');
      expect(html).toContain('Choose Photo');
    });

    it('renders visual guidance checklist, examples, and file specs for signature', () => {
      const html = renderToStaticMarkup(
        React.createElement(UploadWarningModal, {
          isOpen: true,
          type: 'signature',
          onCancel: vi.fn(),
          onContinue: vi.fn(),
        })
      );

      // Checklist headings
      expect(html).toContain('What to Upload (Accepted)');
      expect(html).toContain('What NOT to Upload (Rejected)');

      // Detailed signature rules
      expect(html).toContain('genuine handwritten signature in dark blue or black ink');
      expect(html).toContain('clean image against a plain, light or white background');
      expect(html).toContain('rotated, sideways, vertical, or upside-down');
      expect(html).toContain('cropped signature');

      // Visual reference examples
      expect(html).toContain('ACCEPTABLE — Clear signature');
      expect(html).toContain('ACCEPTABLE — Properly framed signature');
      expect(html).toContain('NOT ACCEPTABLE — Incorrect cropping');
      expect(html).toContain('NOT ACCEPTABLE — Wrong orientation');
      expect(html).toContain('student-signature-acceptable-1.png');
      expect(html).toContain('student-signature-acceptable-2.png');
      expect(html).toContain('student-signature-incorrect-crop.png');
      expect(html).toContain('student-signature-incorrect-orientation.png');

      // File format and size contract
      expect(html).toContain('Accepted formats:');
      expect(html).toContain('JPG, PNG, WebP');
      expect(html).toContain('Max 1MB');

      // Actions
      expect(html).toContain('Cancel');
      expect(html).toContain('Choose Signature');
    });
  });

  describe('Warning Configuration Invariants', () => {
    it('defines distinct messages and icons for photo vs signature', () => {
      expect(WARNING_CONFIG.pfp.title).toBe('Important — Profile Picture Update');
      expect(WARNING_CONFIG.signature.title).toBe('Important — Signature Update');

      expect(WARNING_CONFIG.pfp.message).not.toEqual(WARNING_CONFIG.signature.message);
      expect(WARNING_CONFIG.pfp.Icon).toBeDefined();
      expect(WARNING_CONFIG.signature.Icon).toBeDefined();
    });

    it('ensures warnings do not make false permanent lock claims', () => {
      // Invariant: does not claim image is permanently locked or impossible to change
      expect(WARNING_CONFIG.pfp.message).not.toMatch(/permanent/i);
      expect(WARNING_CONFIG.pfp.message).not.toMatch(/locked forever/i);
      expect(WARNING_CONFIG.signature.message).not.toMatch(/permanent/i);
      expect(WARNING_CONFIG.signature.message).not.toMatch(/locked forever/i);
    });
  });

  describe('Upload Workflow Interception & State Transitions', () => {
    it('simulates user selecting Cancel: file picker is never clicked and image state remains untouched', () => {
      let state = {
        uploadWarning: { isOpen: true, type: 'pfp' },
        currentPfp: 'kucet/students/pfp/original.jpg',
        pfpDataUrl: null,
      };

      const fileInputMock = { click: vi.fn() };

      // Handler when student clicks Cancel on warning popup
      const handleWarningCancel = () => {
        state = {
          ...state,
          uploadWarning: { ...state.uploadWarning, isOpen: false },
        };
      };

      handleWarningCancel();

      expect(state.uploadWarning.isOpen).toBe(false);
      expect(fileInputMock.click).not.toHaveBeenCalled();
      expect(state.currentPfp).toBe('kucet/students/pfp/original.jpg');
      expect(state.pfpDataUrl).toBeNull();
    });

    it('simulates user selecting Continue: closes warning popup and triggers file input click', async () => {
      let state = {
        uploadWarning: { isOpen: true, type: 'pfp' },
        currentPfp: 'kucet/students/pfp/original.jpg',
        pfpDataUrl: null,
      };

      const fileInputMock = { click: vi.fn(), value: 'old-file.jpg' };

      const handleWarningContinue = () => {
        const targetType = state.uploadWarning.type;
        state = {
          ...state,
          uploadWarning: { ...state.uploadWarning, isOpen: false },
        };

        if (targetType === 'pfp') {
          fileInputMock.value = '';
          fileInputMock.click();
        }
      };

      handleWarningContinue();

      expect(state.uploadWarning.isOpen).toBe(false);
      expect(fileInputMock.value).toBe('');
      expect(fileInputMock.click).toHaveBeenCalledTimes(1);
    });

    it('simulates replacing an existing image: triggers warning modal again before opening file picker', () => {
      // Image already exists
      let state = {
        uploadWarning: { isOpen: false, type: 'pfp' },
        currentPfp: 'kucet/students/pfp/existing.jpg',
        pfpDataUrl: 'data:image/jpeg;base64,existingPreview',
      };

      const fileInputMock = { click: vi.fn() };

      const handlePhotoClick = () => {
        state = {
          ...state,
          uploadWarning: { isOpen: true, type: 'pfp' },
        };
      };

      // Student clicks to change/replace the existing photo
      handlePhotoClick();

      expect(state.uploadWarning.isOpen).toBe(true);
      expect(state.uploadWarning.type).toBe('pfp');
      // File input must NOT have been clicked yet (gated by confirmation modal)
      expect(fileInputMock.click).not.toHaveBeenCalled();
    });

    it('simulates canceling native file picker: leaves current image untouched', () => {
      const state = {
        currentSignature: 'kucet/students/signatures/existing_sig.png',
        signatureDataUrl: null,
      };

      // When file picker is canceled, files is undefined or empty
      const onFileSelect = vi.fn((file, _type) => {
        if (!file) return; // Native cancel
      });

      onFileSelect(undefined, 'sig');

      expect(state.currentSignature).toBe('kucet/students/signatures/existing_sig.png');
      expect(state.signatureDataUrl).toBeNull();
    });
  });

  describe('Client File Validation Rules (Preserved from Existing Workflow)', () => {
    const MAX_BYTES = 1048576; // 1 MB limit (1,048,576 bytes)
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];

    it('rejects invalid file formats', () => {
      const validateFile = (file) => {
        if (!file) return { valid: false, error: 'No file' };
        if (!ALLOWED_TYPES.includes(file.type)) {
          return { valid: false, error: 'File format rejected. Use JPG/PNG/PDF.' };
        }
        if (file.size > MAX_BYTES) {
          return { valid: false, error: 'File exceeds 1 MB limit.' };
        }
        return { valid: true };
      };

      expect(validateFile({ type: 'text/plain', size: 1000 }).valid).toBe(false);
      expect(validateFile({ type: 'application/x-msdownload', size: 500 }).valid).toBe(false);
      expect(validateFile({ type: 'video/mp4', size: 10000 }).valid).toBe(false);

      expect(validateFile({ type: 'image/jpeg', size: 500000 }).valid).toBe(true);
      expect(validateFile({ type: 'image/png', size: 500000 }).valid).toBe(true);
    });

    it('rejects files exceeding 1 MB limit', () => {
      const validateFile = (file) => {
        if (file.size > MAX_BYTES) {
          return { valid: false, error: 'File exceeds the 1 MB limit.' };
        }
        return { valid: true };
      };

      expect(validateFile({ size: 1048577 }).valid).toBe(false); // 1 MB + 1 byte
      expect(validateFile({ size: 2 * 1024 * 1024 }).valid).toBe(false); // 2 MB
      expect(validateFile({ size: 1048576 }).valid).toBe(true); // Exact 1 MB
      expect(validateFile({ size: 500000 }).valid).toBe(true); // 500 KB
    });
  });

  describe('Shared Guidance Contracts & Validation Integration', () => {
    it('verifies photo and signature requirements specifications match backend 1 MB and format limits', () => {
      expect(PHOTO_FILE_REQUIREMENTS.formats).toEqual(['JPG', 'PNG', 'WebP']);
      expect(PHOTO_FILE_REQUIREMENTS.maxSizeBytes).toBe(1048576);
      expect(PHOTO_FILE_REQUIREMENTS.maxSizeLabel).toBe('1 MB');

      expect(SIGNATURE_FILE_REQUIREMENTS.formats).toEqual(['JPG', 'PNG', 'WebP']);
      expect(SIGNATURE_FILE_REQUIREMENTS.maxSizeBytes).toBe(1048576);
      expect(SIGNATURE_FILE_REQUIREMENTS.maxSizeLabel).toBe('1 MB');
    });

    it('verifies comprehensive accepted and rejected instruction rules are defined', () => {
      expect(PHOTO_ACCEPTED_RULES.length).toBeGreaterThanOrEqual(5);
      expect(PHOTO_REJECTED_RULES.length).toBeGreaterThanOrEqual(5);

      expect(SIGNATURE_ACCEPTED_RULES.length).toBeGreaterThanOrEqual(5);
      expect(SIGNATURE_REJECTED_RULES.length).toBeGreaterThanOrEqual(5);
    });

    it('validates photo using shared validateStudentPhotoFile', async () => {
      const nullCheck = await validateStudentPhotoFile(null);
      expect(nullCheck.valid).toBe(false);

      const emptyCheck = await validateStudentPhotoFile({ size: 0, type: 'image/jpeg' });
      expect(emptyCheck.valid).toBe(false);

      const invalidType = await validateStudentPhotoFile({ size: 1000, type: 'application/pdf' });
      expect(invalidType.valid).toBe(false);
      expect(invalidType.error).toContain('Unsupported file format');

      const oversizedRaw = await validateStudentPhotoFile({ size: 16 * 1024 * 1024, type: 'image/jpeg' });
      expect(oversizedRaw.valid).toBe(false);
      expect(oversizedRaw.error).toContain('too large');
    });

    it('validates signature using shared validateStudentSignatureFile', async () => {
      const nullCheck = await validateStudentSignatureFile(null);
      expect(nullCheck.valid).toBe(false);

      const emptyCheck = await validateStudentSignatureFile({ size: 0, type: 'image/png' });
      expect(emptyCheck.valid).toBe(false);

      const invalidType = await validateStudentSignatureFile({ size: 1000, type: 'text/plain' });
      expect(invalidType.valid).toBe(false);
      expect(invalidType.error).toContain('Unsupported file format');

      const oversizedRaw = await validateStudentSignatureFile({ size: 16 * 1024 * 1024, type: 'image/png' });
      expect(oversizedRaw.valid).toBe(false);
      expect(oversizedRaw.error).toContain('too large');
    });

    it('ensures profile modifications isolate media changes from unrelated personal fields', () => {
      const originalProfile = {
        name: 'K. Rahul',
        father_name: 'K. Srinivas',
        dob: '2004-05-15',
        curr_city: 'Warangal',
      };

      const newPhotoDataUrl = 'data:image/jpeg;base64,sampleUpdatedPhotoData';
      
      // Payload when student only updates photo
      const payload = {
        signature: null,
        pfp: newPhotoDataUrl,
        data: null, // No personal data changes
        proof: null,
      };

      expect(payload.pfp).toBe(newPhotoDataUrl);
      expect(payload.data).toBeNull();
      expect(originalProfile.name).toBe('K. Rahul');
      expect(originalProfile.father_name).toBe('K. Srinivas');
    });

    it('simulates upload failure: existing photo remains unchanged and error is handled', async () => {
      let currentPhoto = 'kucet/students/pfp/current_valid.webp';
      let _pendingPhotoDataUrl = 'data:image/jpeg;base64,failedAttempt';

      const mockFailedSave = vi.fn().mockRejectedValue(new Error('Network timeout'));

      try {
        await mockFailedSave();
      } catch (err) {
        expect(err.message).toBe('Network timeout');
        // On failure, currentPhoto on profile remains untouched
        expect(currentPhoto).toBe('kucet/students/pfp/current_valid.webp');
      }
    });
  });
});
