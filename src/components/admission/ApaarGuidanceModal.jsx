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
 */
export function ApaarGuidanceModal({ open, onClose }) {
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    // Focus close button on open for accessibility
    closeButtonRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apaar-guidance-title"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target)) {
          onClose();
        }
      }}
    >
      <div 
        ref={modalRef}
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-[#0b3578] text-white px-6 py-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <BookOpen className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-white/10 px-2 py-0.5 rounded">
                NEP 2020 Guidance
              </span>
              <h2 id="apaar-guidance-title" className="text-lg font-bold text-white mt-1">
                APAAR ID Guidance &amp; Application Note
              </h2>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-slate-700 text-sm">
          {/* Key Assurance Alert: NOT Mandatory for Admission */}
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-bold text-emerald-900 text-sm">
                APAAR ID Is Completely Optional During Admission
              </h3>
              <p className="text-xs text-emerald-800 leading-relaxed">
                You do <strong>not</strong> need an APAAR ID to submit your admission form. Leaving this field blank will <strong>never</strong> block your application submission, draft finalization, university roll number assignment, or student portal access.
              </p>
            </div>
          </div>

          {/* Explanation */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-[#0b3578]" />
              What is an APAAR ID?
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              APAAR (Automated Permanent Academic Account Registry) is the Government of India&apos;s 12-digit &quot;One Nation, One Student ID&quot; under the Academic Bank of Credits (ABC) initiative. It unifies academic records, credit transfers, and scholarship processing.
            </p>
          </div>

          {/* What if you don't have a roll number yet */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
            <h4 className="font-bold text-[#0b3578] text-xs uppercase tracking-wide flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#0b3578]" />
              Haven&apos;t Received a University Roll Number Yet?
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              If you are a newly admitted student, DigiLocker may ask for a university roll number to generate your card. <strong>Do not worry:</strong> leave the field empty now. Once your admission is confirmed and KUCET issues your official roll number, you can easily register your APAAR ID through your Student Dashboard at <code className="bg-white border px-1 py-0.5 rounded text-[11px] font-mono text-[#0b3578]">/student/apaar</code>.
            </p>
          </div>

          {/* How to get it via DigiLocker */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide text-slate-500">
              Steps to Generate via DigiLocker (If you wish to obtain it now)
            </h4>
            <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside bg-slate-50 p-4 rounded-xl border border-slate-200">
              <li>Visit the official DigiLocker portal at <a href="https://www.digilocker.gov.in" target="_blank" rel="noopener noreferrer" className="text-[#0b3578] font-bold underline inline-flex items-center gap-0.5">digilocker.gov.in <ExternalLink className="w-3 h-3 inline" /></a>.</li>
              <li>Sign in using your mobile number linked to Aadhaar.</li>
              <li>Under <strong>Search Documents</strong>, search for <em>&quot;Academic Bank of Credits&quot;</em> or <em>&quot;APAAR&quot;</em>.</li>
              <li>Select Institution as <strong>Kakatiya University</strong> and enter your entrance exam hall ticket or provisional admission number if roll number is not yet assigned.</li>
              <li>Submit Aadhaar e-KYC consent to retrieve your 12-digit virtual card.</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <a
            href="https://www.digilocker.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0b3578] hover:underline"
          >
            Visit DigiLocker Portal <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 text-xs font-bold uppercase tracking-wider text-white bg-[#0b3578] hover:bg-[#082654] rounded-lg shadow-sm transition"
          >
            Return to Admission Form
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApaarGuidanceModal;
