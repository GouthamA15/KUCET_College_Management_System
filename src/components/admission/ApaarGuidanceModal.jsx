'use client';

import React, { useEffect, useRef } from 'react';
import { 
  X, 
  ExternalLink, 
  CheckCircle2, 
  ShieldCheck, 
  Info, 
  BookOpen
} from 'lucide-react';

/**
 * APAAR Guidance Modal for the student admission application page (/admission).
 * Informs prospective and newly admitting students that APAAR ID submission is
 * strictly optional during admission and never blocks draft finalization, roll number
 * generation, or student dashboard access.
 *
 * Adheres strictly to KUCET CMS guidance modal standards established in
 * StudentPhotoGuidance.jsx and StudentSignatureGuidance.jsx.
 */
export function ApaarGuidanceModal({ open, onClose }) {
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previouslyFocusedElement = useRef(null);

  useEffect(() => {
    if (!open) return;

    // Save previous active element to restore focus on close
    previouslyFocusedElement.current = typeof document !== 'undefined' ? document.activeElement : null;

    // Prevent background scrolling on mobile & desktop
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Auto-focus close button on open for accessibility
    const focusTimer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
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
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apaar-guidance-title"
      tabIndex={-1}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div 
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col transform transition-all animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header — Consistent with KUCET CMS Modal Design Standard */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0b3578] shrink-0">
              <BookOpen className="w-5 h-5 text-[#0b3578]" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0b3578] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  NEP 2020 Guidance
                </span>
              </div>
              <h2 id="apaar-guidance-title" className="text-base sm:text-lg font-bold text-[#0b2447] mt-0.5">
                APAAR ID Guidance &amp; Application Note
              </h2>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close guidance dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body — Internally scrollable with proper mobile padding */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto text-slate-700 text-xs sm:text-sm flex-1 overscroll-contain">
          {/* Key Assurance Alert: NOT Mandatory for Admission */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <h3 className="font-bold text-emerald-900 text-xs sm:text-sm">
                APAAR ID Is Completely Optional During Admission
              </h3>
              <p className="text-xs text-emerald-800 leading-relaxed">
                You do <strong>not</strong> need an APAAR ID to submit your admission form. Leaving this field blank will <strong>never</strong> block your application submission, draft finalization, university roll number assignment, or student portal access.
              </p>
            </div>
          </div>

          {/* Explanation */}
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 flex items-center gap-2 text-xs sm:text-sm">
              <Info className="w-4 h-4 text-[#0b3578] shrink-0" aria-hidden="true" />
              <span>What is an APAAR ID?</span>
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed pl-6">
              APAAR (Automated Permanent Academic Account Registry) is the Government of India&apos;s 12-digit &quot;One Nation, One Student ID&quot; under the Academic Bank of Credits (ABC) initiative. It unifies academic records, credit transfers, and scholarship processing.
            </p>
          </div>

          {/* What if you don't have a roll number yet */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
            <h4 className="font-bold text-[#0b3578] text-xs uppercase tracking-wide flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#0b3578] shrink-0" aria-hidden="true" />
              <span>Haven&apos;t Received a University Roll Number Yet?</span>
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              If you are a newly admitted student, DigiLocker may ask for a university roll number to generate your card. <strong>Do not worry:</strong> leave the field empty now. Once your admission is confirmed and KUCET issues your official roll number, you can easily register your APAAR ID through your Student Dashboard at <code className="bg-white border px-1.5 py-0.5 rounded text-[11px] font-mono text-[#0b3578]">/student/apaar</code>.
            </p>
          </div>

          {/* How to get it via DigiLocker */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">
              Steps to Generate via DigiLocker (If you wish to obtain it now)
            </h4>
            <ol className="text-xs text-slate-600 space-y-2 list-decimal pl-4 bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 leading-relaxed">
              <li>
                Visit the official DigiLocker portal at{' '}
                <a 
                  href="https://www.digilocker.gov.in" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[#0b3578] font-bold underline inline-flex items-center gap-0.5 hover:text-blue-700"
                >
                  digilocker.gov.in <ExternalLink className="w-3 h-3 inline" />
                </a>.
              </li>
              <li>Sign in using your mobile number linked to Aadhaar.</li>
              <li>Under <strong>Search Documents</strong>, search for <em>&quot;Academic Bank of Credits&quot;</em> or <em>&quot;APAAR&quot;</em>.</li>
              <li>Select Institution as <strong>Kakatiya University</strong> and enter your entrance exam hall ticket or provisional admission number if roll number is not yet assigned.</li>
              <li>Submit Aadhaar e-KYC consent to retrieve your 12-digit virtual card.</li>
            </ol>
          </div>
        </div>

        {/* Modal Footer — Clean responsive stacking */}
        <div className="bg-slate-50/80 border-t border-slate-200 p-4 sm:p-5 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <a
            href="https://www.digilocker.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-[#0b3578] hover:underline py-1 sm:py-0"
          >
            Visit DigiLocker Portal <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-[#0b3578] hover:bg-[#082654] rounded-lg shadow-sm transition cursor-pointer text-center"
          >
            Return to Admission Form
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApaarGuidanceModal;
