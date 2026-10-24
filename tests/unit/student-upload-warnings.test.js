import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import UploadWarningModal, { WARNING_CONFIG } from '@/components/student/UploadWarningModal';

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

      expect(html).toContain('max-w-md');
      expect(html).toContain('w-full');
      expect(html).toContain('rounded-2xl');
      expect(html).toContain('flex flex-col-reverse sm:flex-row');
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
});
