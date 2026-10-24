'use client';

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileSignature, 
  Upload, 
  X, 
  Check
} from 'lucide-react';

/**
 * Authoritative signature examples metadata for KUCET College Student ID & Examination Verification.
 * All paths reference local static assets in public/assets/guidance/.
 */
export const SIGNATURE_EXAMPLES = [
  {
    id: 'acceptable_clear',
    classification: 'ACCEPTABLE',
    isAccepted: true,
    title: 'ACCEPTABLE — Clear signature',
    badgeText: '✓ ACCEPTABLE',
    badgeColor: 'bg-emerald-600 text-white',
    borderColor: 'border-emerald-500 ring-2 ring-emerald-500/20',
    headerBg: 'bg-emerald-50 text-emerald-900 border-b border-emerald-100',
    src: '/assets/guidance/student-signature-acceptable-1.png',
    alt: 'Example of acceptable clear student signature: handwritten naturally in dark ink on clean white background',
    summary: 'The signature should be clearly visible, readable and written naturally on a clean, light background.',
    bulletPoints: [
      'Written naturally with dark blue or black ink',
      'Clean, plain white paper with sharp contrast',
      'Complete signature with all strokes visible',
      'Sharp focus and even lighting without harsh shadows',
      'Upload the genuine handwritten signature of the student',
    ],
  },
  {
    id: 'acceptable_framed',
    classification: 'ACCEPTABLE',
    isAccepted: true,
    title: 'ACCEPTABLE — Properly framed signature',
    badgeText: '✓ ACCEPTABLE',
    badgeColor: 'bg-emerald-600 text-white',
    borderColor: 'border-emerald-500 ring-2 ring-emerald-500/20',
    headerBg: 'bg-emerald-50 text-emerald-900 border-b border-emerald-100',
    src: '/assets/guidance/student-signature-acceptable-2.png',
    alt: 'Example of acceptable properly framed student signature: centered with balanced margins and correct horizontal orientation',
    summary: 'The complete signature should be visible, correctly oriented and sufficiently clear for examination verification.',
    bulletPoints: [
      'Correct horizontal orientation (upright, left-to-right)',
      'Centered neatly with balanced, comfortable white margins',
      'Sufficient clarity and resolution for examination hall verification',
      'No cut-off strokes or obscured letters at image boundaries',
    ],
  },
  {
    id: 'incorrect_crop',
    classification: 'NOT ACCEPTABLE',
    isAccepted: false,
    title: 'NOT ACCEPTABLE — Incorrect cropping',
    badgeText: '✗ NOT ACCEPTABLE',
    badgeColor: 'bg-rose-600 text-white',
    borderColor: 'border-rose-400',
    headerBg: 'bg-rose-50 text-rose-900 border-b border-rose-100',
    src: '/assets/guidance/student-signature-incorrect-crop.png',
    alt: 'Example of unacceptable incorrectly cropped signature: excessive dark surroundings, bad margins, or signature cut off',
    summary: 'Upload the complete signature with appropriate margins. Do not cut off parts of the signature, leave it excessively small within a large blank image, or include unnecessary surrounding areas.',
    bulletPoints: [
      'Do not include large dark table surfaces, walls, or shadows',
      'Do not leave the signature tiny inside a massive empty image',
      'Do not crop tightly across letters or cut off starting/ending strokes',
      'Crop neatly around the signature on clean white paper',
    ],
  },
  {
    id: 'incorrect_orientation',
    classification: 'NOT ACCEPTABLE',
    isAccepted: false,
    title: 'NOT ACCEPTABLE — Wrong orientation',
    badgeText: '✗ NOT ACCEPTABLE',
    badgeColor: 'bg-rose-600 text-white',
    borderColor: 'border-rose-400',
    headerBg: 'bg-rose-50 text-rose-900 border-b border-rose-100',
    src: '/assets/guidance/student-signature-incorrect-orientation.png',
    alt: 'Example of unacceptable wrong orientation signature: signature rotated sideways, vertical, or upside-down',
    summary: 'Ensure your signature is upright and correctly oriented before uploading. Do not upload a sideways, rotated or upside-down image.',
    bulletPoints: [
      'Do not upload vertical or sideways rotated images',
      'Signature must read horizontally from left to right',
      'Rotate your image right-side up before uploading',
      'Do not rely on automated rotation',
    ],
  },
];

/**
 * Authoritative signature acceptance & rejection guidelines.
 * Shared across Admission and Student Profile Edit workflows.
 */
export const SIGNATURE_ACCEPTED_RULES = [
  'Your own genuine handwritten signature in dark blue or black ink',
  'A clean image against a plain, light or white background with sharp contrast',
  'A horizontal, upright image with writing oriented correctly (left-to-right)',
  'The complete signature without cropped edges, cut-off strokes, or obscured letters',
  'A sufficiently large, legible signature neatly centered with balanced margins',
  'A sharp and unedited photograph without shadows, filters, or excessive empty space',
];

export const SIGNATURE_REJECTED_RULES = [
  "Another person's signature, or a printed/typed signature presented as handwritten",
  'A signature that is rotated, sideways, vertical, or upside-down',
  'A heavily cropped signature cutting off letters or starting/ending strokes',
  'A blurry, faded, low-contrast image, or a photo taken in dim lighting',
  'A signature photographed against dark, patterned, or ruled notebook paper',
  'A photograph containing unnecessary surroundings, table surfaces, or other objects',
  'An image with filters, decorative borders, or effects that obscure the actual strokes',
];

export const SIGNATURE_FILE_REQUIREMENTS = {
  formats: ['JPG', 'PNG', 'WebP'],
  formatsLabel: 'JPG, PNG, WebP',
  maxSizeBytes: 1048576,
  maxSizeLabel: '1 MB',
};

/**
 * Reusable Signature Checklist Component (Accepted vs. Rejected rules)
 */
export function SignatureGuidanceChecklist({ className = '' }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 ${className}`}>
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          What to Upload (Accepted)
        </h4>
        <ul className="text-xs text-slate-700 space-y-1.5 pl-1 leading-relaxed">
          {SIGNATURE_ACCEPTED_RULES.map((rule, idx) => (
            <li key={idx} className="flex items-start gap-1.5">
              <span className="text-emerald-600 font-bold shrink-0">✓</span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
          What NOT to Upload (Rejected)
        </h4>
        <ul className="text-xs text-slate-700 space-y-1.5 pl-1 leading-relaxed">
          {SIGNATURE_REJECTED_RULES.map((rule, idx) => (
            <li key={idx} className="flex items-start gap-1.5">
              <span className="text-rose-600 font-bold shrink-0">✗</span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Reusable Signature Visual Examples Cards Grid
 */
export function SignatureExamplesCards({ className = '' }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {SIGNATURE_EXAMPLES.map((ex) => (
        <div 
          key={ex.id}
          className={`rounded-xl border ${ex.isAccepted ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-rose-200'} bg-white overflow-hidden shadow-sm flex flex-col justify-between`}
        >
          <div>
            <div className={`p-2.5 ${ex.isAccepted ? 'bg-emerald-50 text-emerald-900 border-b border-emerald-100' : 'bg-rose-50 text-rose-900 border-b border-rose-100'} flex items-center justify-between`}>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${ex.isAccepted ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                {ex.isAccepted ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                {ex.isAccepted ? 'ACCEPTABLE' : 'UNACCEPTABLE'}
              </span>
              <span className="text-[10px] font-bold uppercase truncate max-w-[120px]">
                {ex.classification}
              </span>
            </div>

            <div className="p-3 bg-slate-50 flex items-center justify-center border-b border-slate-100 h-44">
              <div className="relative h-36 w-full max-w-[200px] shadow-sm rounded overflow-hidden bg-white border border-slate-200">
                <Image
                  src={ex.src}
                  alt={ex.alt}
                  fill
                  sizes="(max-width: 768px) 160px, 200px"
                  className="object-contain p-1"
                />
              </div>
            </div>

            <div className="p-3 space-y-1.5">
              <p className="text-xs font-bold text-slate-900 leading-tight">
                {ex.title}
              </p>
              <p className="text-[11px] text-slate-600 leading-normal">
                {ex.summary}
              </p>
            </div>
          </div>

          <div className={`p-2 text-[10px] font-semibold text-center border-t ${ex.isAccepted ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
            {ex.isAccepted ? '✓ Exam Hall Ready' : '✗ Will Require Re-upload'}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Reusable Complete Signature Guidance Content Section
 */
export function SignatureGuidanceSection({ warningNotice, className = '' }) {
  return (
    <div className={`space-y-6 ${className}`}>
      {warningNotice || <ExaminationVerificationWarning />}
      <SignatureGuidanceChecklist />
      <div>
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
          Visual Reference Examples
        </h3>
        <SignatureExamplesCards />
      </div>
    </div>
  );
}

/**
 * Prominent Examination Verification Warning Alert Box
 */
export function ExaminationVerificationWarning({ className = '' }) {
  return (
    <div 
      role="alert" 
      className={`bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5 text-amber-600" aria-hidden="true" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-amber-900">
            Official Examination Verification Notice
          </h4>
          <p className="text-xs sm:text-sm text-amber-800 mt-1 leading-relaxed">
            <strong className="font-semibold text-amber-950">Important:</strong> Your uploaded signature will be used to verify your identity during <strong className="font-semibold text-amber-950">KUCET mid-semester and semester examinations</strong>. Please upload your own clear, complete and correctly oriented handwritten signature.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Interactive Signature Guidance Modal Dialog
 * Opens when student clicks the signature placeholder, "View Signature Requirements",
 * or triggers signature update in student profile settings.
 */
export function SignatureGuidanceModal({ 
  open, 
  isOpen, 
  onClose, 
  onCancel, 
  onSelectSignature, 
  onContinue,
  title = 'Student Signature Requirements for Examination Verification',
  subtitle = 'Review acceptable vs. unacceptable signature uploads before submitting',
  warningNotice,
  actionText = 'Choose Signature',
  cancelText = 'Close',
  ariaLabelledBy = 'signature-guidance-modal-title',
  ariaDescribedBy,
}) {
  const isModalOpen = open ?? isOpen ?? false;
  const handleClose = onClose ?? onCancel;
  const handleSelect = onSelectSignature ?? onContinue;

  const modalRef = useRef(null);
  const actionButtonRef = useRef(null);
  const previouslyFocusedElement = useRef(null);

  useEffect(() => {
    if (!isModalOpen) return;

    // Save previous active element to restore focus on close
    previouslyFocusedElement.current = typeof document !== 'undefined' ? document.activeElement : null;

    // Prevent background scrolling
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Auto-focus primary action button
    const focusTimer = setTimeout(() => {
      if (actionButtonRef.current?.focus) {
        actionButtonRef.current.focus();
      } else if (modalRef.current?.focus) {
        modalRef.current.focus();
      }
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocusedElement.current?.focus) {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [isModalOpen, handleClose]);

  if (!isModalOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      tabIndex={-1}
      ref={modalRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose?.();
      }}
    >
      <div 
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0b3578] shrink-0">
              <FileSignature className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id={ariaLabelledBy} className="text-base sm:text-xl font-bold text-[#0b2447]">
                {title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                {subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close guidance dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Prominent Warning Callout */}
          {warningNotice || <ExaminationVerificationWarning />}

          {/* Quick Checklist */}
          <SignatureGuidanceChecklist />

          {/* Detailed 4 Examples Grid */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
              Visual Reference Examples
            </h3>
            <SignatureExamplesCards />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-slate-500 text-center sm:text-left">
            Accepted formats: <strong>JPG, PNG, WebP</strong> (Max 1MB).
          </p>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              {cancelText}
            </button>
            <button
              ref={actionButtonRef}
              type="button"
              onClick={() => {
                handleClose?.();
                handleSelect?.();
              }}
              aria-label="Continue and choose signature"
              className="w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#0b3578] hover:bg-[#0a2d66] active:bg-[#092554] rounded-lg shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#0b3578]/50"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              {actionText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Client-side safe validation helper for uploaded signature
 * Validates format, non-emptiness, size, and decodability.
 * Includes non-destructive heuristic checks for dimension/aspect ratio.
 */
export async function validateStudentSignatureFile(file) {
  if (!file) {
    return { valid: false, error: 'No signature file selected.' };
  }

  // 1. File emptiness check
  if (file.size === 0) {
    return { valid: false, error: 'The selected signature file is empty.' };
  }

  // 2. Format validation (JPEG, PNG, WEBP)
  const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!acceptedTypes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'Unsupported file format. Please upload a JPEG, PNG, or WebP signature.',
    };
  }

  // 3. Raw file size pre-check (Reject files over 15MB before trying to process)
  if (file.size > 15 * 1024 * 1024) {
    return {
      valid: false,
      error: 'File size is too large (over 15MB). Please choose a smaller signature image.',
    };
  }

  // 4. Image decoding validation (Catch corrupt/fake files)
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      return resolve({ valid: true });
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();

    img.onload = () => {
      const dimensions = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(objectUrl);

      // Verify minimum resolution for examination verification
      if (dimensions.width < 80 || dimensions.height < 30) {
        return resolve({
          valid: false,
          error: `Signature resolution is too low (${dimensions.width}x${dimensions.height}px). Minimum 80x30px required.`,
        });
      }

      // Non-destructive heuristic check for orientation:
      // Signatures are normally wider than tall (aspect ratio >= 1.0).
      // If height > width * 1.5, it may be a vertically rotated image.
      let warning = null;
      if (dimensions.height > dimensions.width * 1.5) {
        warning = 'The uploaded image appears to be vertical. Please verify that your signature is upright and not rotated sideways.';
      }

      resolve({ valid: true, dimensions, warning });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        valid: false,
        error: 'Unable to decode signature image. The file appears to be corrupted or is not a valid image format.',
      });
    };

    img.src = objectUrl;
  });
}
