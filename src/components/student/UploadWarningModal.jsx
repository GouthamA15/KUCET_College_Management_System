'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Camera, PenTool, X } from 'lucide-react';

export const WARNING_CONFIG = {
  pfp: {
    title: 'Important — Profile Picture Update',
    message:
      'Please ensure that your profile picture is clear, recent, and belongs to you. This picture may be used for your official student profile, identity verification, and college records. Upload the correct image before proceeding.',
    Icon: Camera,
    iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
  },
  signature: {
    title: 'Important — Signature Update',
    message:
      "Please upload your own genuine signature clearly against a plain, light background. Ensure that the signature is correct and legible, as it may be used for official college records and verification. Do not upload another person's signature.",
    Icon: PenTool,
    iconBg: 'bg-blue-50 text-[#0b3578] border-blue-200',
  },
};

export default function UploadWarningModal({
  isOpen,
  type = 'pfp',
  onCancel,
  onContinue,
}) {
  const continueButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Auto-focus the Continue button on open
    const timer = setTimeout(() => {
      continueButtonRef.current?.focus();
    }, 50);

    // Escape key listener
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const config = WARNING_CONFIG[type] || WARNING_CONFIG.pfp;
  const { title, message, Icon, iconBg } = config;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel?.();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-warning-title"
        aria-describedby="upload-warning-desc"
        className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 transition-all select-none"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
          aria-label="Cancel and close dialog"
        >
          <X size={18} />
        </button>

        {/* Header with Icon */}
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl border shrink-0 ${iconBg}`}>
            <Icon size={24} />
          </div>
          <div className="flex-1 pr-4">
            <h3
              id="upload-warning-title"
              className="text-base sm:text-lg font-bold text-[#0b2447] leading-snug"
            >
              {title}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-semibold text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200/60 w-fit">
              <AlertTriangle size={12} className="shrink-0 text-amber-600" />
              <span>Official Institutional Record</span>
            </div>
          </div>
        </div>

        {/* Body Message */}
        <p
          id="upload-warning-desc"
          className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-4 mb-6"
        >
          {message}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            Cancel
          </button>
          <button
            ref={continueButtonRef}
            type="button"
            onClick={onContinue}
            className="w-full sm:flex-1 px-4 py-2.5 rounded-lg bg-[#0b3578] text-white font-semibold text-xs sm:text-sm hover:bg-[#0a2d66] active:bg-[#092554] transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0b3578]/50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
