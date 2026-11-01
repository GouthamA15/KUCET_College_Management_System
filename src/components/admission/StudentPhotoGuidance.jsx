'use client';

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Camera, 
  Upload, 
  Info, 
  X, 
  Check
} from 'lucide-react';

/**
 * Authoritative photo examples metadata for KUCET College ID Card generation.
 * All paths reference local static assets in public/assets/guidance/.
 */
export const PHOTO_EXAMPLES = [
  {
    id: 'correct',
    classification: 'CORRECT',
    isAccepted: true,
    title: 'CORRECT — Passport-Style Portrait',
    badgeText: '✓ ACCEPTED PHOTO',
    badgeColor: 'bg-emerald-600 text-white',
    borderColor: 'border-emerald-500 ring-2 ring-emerald-500/20',
    headerBg: 'bg-emerald-50 text-emerald-900 border-b border-emerald-100',
    src: '/assets/guidance/student-photo-correct.png',
    alt: 'Example of correct passport-style student photograph: front-facing portrait with head and shoulders visible, looking straight at camera against plain white background',
    summary: 'Clear, front-facing passport-style portrait with head and shoulders visible against a plain background.',
    bulletPoints: [
      'Face looking directly into the camera',
      'Head and shoulders clearly visible in passport framing',
      'Plain, light or uncluttered background',
      'Sharp focus, natural contrast, and even lighting',
      'Face centered, unobstructed, and clearly identifiable',
      'Recent, genuine photograph of the student',
      'Upload the original digital photograph file',
    ],
  },
  {
    id: 'printed_photo',
    classification: 'INCORRECT',
    isAccepted: false,
    title: 'Printed Photo / Photo of an ID Card',
    badgeText: '✗ DO NOT USE',
    badgeColor: 'bg-rose-600 text-white',
    borderColor: 'border-rose-400',
    headerBg: 'bg-rose-50 text-rose-900 border-b border-rose-100',
    src: '/assets/guidance/student-photo-printed-image.png',
    alt: 'Example of incorrect photograph: phone photo taken of a printed paper photo lying on a patterned cloth surface with borders and glare',
    summary: 'Never photograph an existing printed photo, laminated paper, another screen, or old ID card.',
    bulletPoints: [
      'Do not photograph an existing printed photo or ID card',
      'Avoid visible borders, paper edges, reflections, or glare',
      'Avoid patterned or fabric backgrounds under the photo',
      'Upload the original digital portrait file directly',
    ],
  },
  {
    id: 'full_body',
    classification: 'INCORRECT',
    isAccepted: false,
    title: 'Full-Body or Distant Photo',
    badgeText: '✗ DO NOT USE',
    badgeColor: 'bg-rose-600 text-white',
    borderColor: 'border-rose-400',
    headerBg: 'bg-rose-50 text-rose-900 border-b border-rose-100',
    src: '/assets/guidance/student-photo-full-body.png',
    alt: 'Example of incorrect photograph: distant full-body shot of student standing outdoors where face is far too small to identify on an ID card',
    summary: 'Never upload a full-body photograph. The face must be large enough to verify identity clearly.',
    bulletPoints: [
      'Do not upload a full-body or distant picture',
      'Face is too small and will blur when printed on the card',
      'Must be a tight head-and-shoulders portrait crop',
      'Ensure the face occupies 60% to 70% of the image frame',
    ],
  },
  {
    id: 'casual_outdoor',
    classification: 'INCORRECT',
    isAccepted: false,
    title: 'Casual Outdoor / Distracting Background',
    badgeText: '✗ DO NOT USE',
    badgeColor: 'bg-rose-600 text-white',
    borderColor: 'border-rose-400',
    headerBg: 'bg-rose-50 text-rose-900 border-b border-rose-100',
    src: '/assets/guidance/student-photo-casual-outdoor.png',
    alt: 'Example of incorrect photograph: casual outdoor snapshot of student sitting at an outdoor table with trees, foliage, and angled pose',
    summary: 'Avoid casual snapshots, social media selfies, angled poses, sunglasses, or busy outdoor scenery.',
    bulletPoints: [
      'Avoid distracting backgrounds with trees, buildings, or furniture',
      'Avoid angled, tilted, or seated side-profile poses',
      'Do not apply social media filters, stickers, or heavy blur',
      'Face must be straightforward and clearly lit',
    ],
  },
];

/**
 * Authoritative photo acceptance & rejection guidelines.
 * Shared across Admission and Student Profile Edit workflows.
 */
export const PHOTO_ACCEPTED_RULES = [
  'An original, recent passport-style portrait (JPG, PNG, or WebP)',
  'A straight-on, front-facing view of the student with both eyes open',
  'A head-and-shoulders portrait with face clearly visible and centered',
  'A plain white or light-coloured background with natural, even lighting',
  'Good lighting and sharp focus where face occupies 60% to 70% of the frame',
  'A clean photograph without filters, decorative effects, borders, or distracting objects',
];

export const PHOTO_REJECTED_RULES = [
  'A photograph of an existing printed ID card, paper print, or another screen',
  'A screenshot of a photograph or photo taken of another photo',
  'Full-body or distant photographs where the face is too small to recognize',
  'Casual group photographs, selfies with filters, or social media snapshots',
  'Outdoor photographs with distracting foliage, buildings, or furniture',
  'Images with sunglasses, face-obscuring objects, heavy shadows, or extreme angles',
  'Blurry, pixelated, excessively dark, or overexposed images',
  'Images of another person, or photos with borders and heavy editing',
];

export const PHOTO_FILE_REQUIREMENTS = {
  formats: ['JPG', 'PNG', 'WebP'],
  formatsLabel: 'JPG, PNG, WebP',
  maxSizeBytes: 1048576,
  maxSizeLabel: '1 MB',
};

/**
 * Prominent Physical ID-Card Warning Alert Box
 */
export function PhysicalIDCardWarning({ className = '' }) {
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
            Important Notice for College ID Card Printing
          </h4>
          <p className="text-xs sm:text-sm text-amber-800 mt-1 leading-relaxed">
            Your uploaded photograph will be printed directly onto your official <strong className="font-semibold text-amber-950">physical KUCET student ID card</strong>. 
            Please ensure your photograph is clear, recent, sharp, and passport-style before submitting to prevent rejection of your admission application.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Photo Guidance Grid Component
 * Displays the 4 reference examples in a responsive grid before or alongside the upload field.
 */
export function PhotoGuidanceGrid({ onOpenModal }) {
  const correctExample = PHOTO_EXAMPLES.find(ex => ex.isAccepted);
  const incorrectExamples = PHOTO_EXAMPLES.filter(ex => !ex.isAccepted);

  return (
    <section aria-labelledby="photo-guidance-heading" className="space-y-4">
      {/* Header and Callout */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold tracking-wide uppercase mb-2">
              <Camera className="w-3.5 h-3.5" aria-hidden="true" />
              ID Card Photo Specifications
            </div>
            <h3 id="photo-guidance-heading" className="text-lg sm:text-xl font-bold text-slate-900">
              Upload Your Student Photograph
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Please upload a clear, recent passport-style photograph. This photograph will be used to print your physical KUCET college ID card. Follow the examples below to avoid rejection of your photograph.
            </p>
          </div>

          {onOpenModal && (
            <button
              type="button"
              onClick={onOpenModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer shrink-0 shadow-sm"
              aria-label="Open detailed photo guidance popup"
            >
              <Info className="w-4 h-4" aria-hidden="true" />
              View Photo Requirements
            </button>
          )}
        </div>

        {/* Physical ID Card Warning */}
        <PhysicalIDCardWarning className="mt-4" />

        {/* Grid of 4 Examples */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: ACCEPTED / GOOD */}
          <article 
            className={`rounded-xl border-2 ${correctExample.borderColor} bg-white overflow-hidden shadow-sm flex flex-col justify-between`}
            aria-label="Accepted passport photo example"
          >
            <div>
              <div className="p-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-600 text-white text-[11px] font-bold tracking-wide">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  ACCEPTED
                </span>
                <span className="text-[11px] font-bold text-emerald-800 uppercase">GOOD EXAMPLE</span>
              </div>

              {/* Image Container with preserved aspect ratio without aggressive cropping */}
              <div className="p-4 bg-slate-50 flex items-center justify-center border-b border-slate-100 h-48">
                <div className="relative h-40 w-32 shadow-md rounded-md overflow-hidden bg-white border border-slate-200">
                  <Image
                    src={correctExample.src}
                    alt={correctExample.alt}
                    fill
                    sizes="(max-width: 768px) 128px, 160px"
                    className="object-contain"
                  />
                </div>
              </div>

              <div className="p-4 space-y-2.5">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  Passport Portrait
                </h4>
                <p className="text-[11px] sm:text-xs text-slate-600 leading-normal">
                  {correctExample.summary}
                </p>
                <ul className="space-y-1.5 pt-1 text-[11px] text-slate-700">
                  {correctExample.bulletPoints.slice(0, 4).map((pt, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-3 bg-emerald-50/50 border-t border-emerald-100/60 text-[11px] font-semibold text-emerald-800 text-center">
              ✓ Ready for ID Card Printing
            </div>
          </article>

          {/* Cards 2-4: REJECTED / BAD */}
          {incorrectExamples.map((ex) => (
            <article 
              key={ex.id}
              className="rounded-xl border border-rose-200 bg-white overflow-hidden shadow-sm flex flex-col justify-between"
              aria-label={`Unacceptable photo example: ${ex.title}`}
            >
              <div>
                <div className="p-3 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-600 text-white text-[11px] font-bold tracking-wide">
                    <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    DO NOT USE
                  </span>
                  <span className="text-[11px] font-bold text-rose-800 uppercase">UNACCEPTABLE</span>
                </div>

                {/* Image Container with preserved aspect ratio */}
                <div className="p-4 bg-slate-50 flex items-center justify-center border-b border-slate-100 h-48">
                  <div className="relative h-40 w-32 shadow-sm rounded-md overflow-hidden bg-white border border-slate-200">
                    <Image
                      src={ex.src}
                      alt={ex.alt}
                      fill
                      sizes="(max-width: 768px) 128px, 160px"
                      className="object-contain"
                    />
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <X className="w-4 h-4 text-rose-500 shrink-0" aria-hidden="true" />
                    {ex.title}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 leading-normal">
                    {ex.summary}
                  </p>
                  <ul className="space-y-1.5 pt-1 text-[11px] text-slate-600">
                    {ex.bulletPoints.slice(0, 3).map((pt, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-rose-500 font-bold">✗</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-3 bg-rose-50/50 border-t border-rose-100/60 text-[11px] font-semibold text-rose-700 text-center">
                ✗ Rejection Risk: Unusable for ID Card
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Reusable Photo Checklist Component (Accepted vs. Rejected rules)
 */
export function PhotoGuidanceChecklist({ className = '' }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 ${className}`}>
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          What to Upload (Accepted)
        </h4>
        <ul className="text-xs text-slate-700 space-y-1.5 pl-1 leading-relaxed">
          {PHOTO_ACCEPTED_RULES.map((rule, idx) => (
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
          {PHOTO_REJECTED_RULES.map((rule, idx) => (
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
 * Reusable Photo Visual Examples Cards Grid
 */
export function PhotoExamplesCards({ className = '' }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {PHOTO_EXAMPLES.map((ex) => (
        <div 
          key={ex.id}
          className={`rounded-xl border ${ex.isAccepted ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-rose-200'} bg-white overflow-hidden shadow-sm flex flex-col justify-between`}
        >
          <div>
            <div className={`p-2.5 ${ex.isAccepted ? 'bg-emerald-50 text-emerald-900 border-b border-emerald-100' : 'bg-rose-50 text-rose-900 border-b border-rose-100'} flex items-center justify-between`}>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${ex.isAccepted ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                {ex.isAccepted ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                {ex.isAccepted ? 'GOOD' : 'AVOID'}
              </span>
              <span className="text-[10px] font-bold uppercase truncate max-w-[120px]">
                {ex.classification}
              </span>
            </div>

            <div className="p-3 bg-slate-50 flex items-center justify-center border-b border-slate-100 h-44">
              <div className="relative h-36 w-28 shadow-sm rounded overflow-hidden bg-white border border-slate-200">
                <Image
                  src={ex.src}
                  alt={ex.alt}
                  fill
                  sizes="112px"
                  className="object-contain"
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
            {ex.isAccepted ? '✓ Recommended' : '✗ Will Be Rejected'}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Reusable Complete Photo Guidance Content Section
 */
export function PhotoGuidanceSection({ warningNotice, className = '' }) {
  return (
    <div className={`space-y-6 ${className}`}>
      {warningNotice || <PhysicalIDCardWarning />}
      <PhotoGuidanceChecklist />
      <div>
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
          Visual Reference Examples
        </h3>
        <PhotoExamplesCards />
      </div>
    </div>
  );
}

/**
 * Interactive Photo Guidance Modal Dialog
 * Opens when student clicks "View Photo Requirements", clicks the empty upload placeholder,
 * or triggers photo update in student profile settings.
 */
export function PhotoGuidanceModal({ 
  open, 
  isOpen, 
  onClose, 
  onCancel, 
  onSelectPhoto, 
  onContinue,
  title = 'Student Photograph Requirements for College ID Card',
  subtitle = 'Review acceptable vs. unacceptable photos before uploading',
  warningNotice,
  actionText = 'Choose Photo',
  cancelText = 'Close',
  ariaLabelledBy = 'photo-guidance-modal-title',
  ariaDescribedBy,
}) {
  const isModalOpen = open ?? isOpen ?? false;
  const handleClose = onClose ?? onCancel;
  const handleSelect = onSelectPhoto ?? onContinue;

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
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <Camera className="w-5 h-5" aria-hidden="true" />
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
          {warningNotice || <PhysicalIDCardWarning />}

          {/* Quick Checklist */}
          <PhotoGuidanceChecklist />

          {/* Detailed 4 Examples Grid */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
              Visual Reference Examples
            </h3>
            <PhotoExamplesCards />
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
              aria-label="Continue and choose photo"
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
 * Client-side safe validation helper for uploaded photograph
 */
export async function validateStudentPhotoFile(file) {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  // 1. File emptiness check
  if (file.size === 0) {
    return { valid: false, error: 'The selected file is empty.' };
  }

  // 2. Format validation (JPEG, PNG, WEBP)
  const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!acceptedTypes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'Unsupported file format. Please upload a JPEG, PNG, or WebP photograph.',
    };
  }

  // 3. Raw file size pre-check (Reject files over 15MB before trying to process)
  if (file.size > 15 * 1024 * 1024) {
    return {
      valid: false,
      error: 'File size is too large (over 15MB). Please choose a smaller photo.',
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

      // Verify minimum resolution for recognizable ID printing (at least 100x100)
      if (dimensions.width < 100 || dimensions.height < 100) {
        return resolve({
          valid: false,
          error: `Image resolution is too low (${dimensions.width}x${dimensions.height}px). Minimum 100x100px required for ID card printing.`,
        });
      }

      resolve({ valid: true, dimensions });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        valid: false,
        error: 'Unable to decode image. The file appears to be corrupted or is not a valid image format.',
      });
    };

    img.src = objectUrl;
  });
}
