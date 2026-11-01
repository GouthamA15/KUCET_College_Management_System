'use client';

import React from 'react';
import { AlertTriangle, Camera, PenTool } from 'lucide-react';
import { PhotoGuidanceModal } from '@/components/admission/StudentPhotoGuidance';
import { SignatureGuidanceModal } from '@/components/admission/StudentSignatureGuidance';

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

/**
 * Reusable Institutional Record Warning Callout
 * Preserves the official institutional warning requirements for profile edits.
 */
export function InstitutionalWarningNotice({ type = 'pfp' }) {
  const config = WARNING_CONFIG[type] || WARNING_CONFIG.pfp;
  return (
    <div 
      role="alert" 
      className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-xs"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5 text-amber-600" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wide">
            Official Institutional Record
          </div>
          <p 
            id="upload-warning-desc"
            className="text-xs sm:text-sm text-amber-900/90 mt-1 leading-relaxed"
          >
            {config.message}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Enhanced Student Profile Upload Warning Modal
 * Bridges the student profile-edit page with the rich visual guidance
 * from the admission system while retaining official institutional record notices.
 */
export default function UploadWarningModal({
  isOpen,
  type = 'pfp',
  onCancel,
  onContinue,
}) {
  if (!isOpen) return null;

  if (type === 'signature') {
    return (
      <SignatureGuidanceModal
        open={isOpen}
        isOpen={isOpen}
        onClose={onCancel}
        onCancel={onCancel}
        onSelectSignature={onContinue}
        onContinue={onContinue}
        title={WARNING_CONFIG.signature.title}
        subtitle="Review acceptable vs. rejected signature guidelines before uploading"
        warningNotice={<InstitutionalWarningNotice type="signature" />}
        actionText="Choose Signature"
        cancelText="Cancel"
        ariaLabelledBy="upload-warning-title"
        ariaDescribedBy="upload-warning-desc"
      />
    );
  }

  return (
    <PhotoGuidanceModal
      open={isOpen}
      isOpen={isOpen}
      onClose={onCancel}
      onCancel={onCancel}
      onSelectPhoto={onContinue}
      onContinue={onContinue}
      title={WARNING_CONFIG.pfp.title}
      subtitle="Review acceptable vs. rejected photo guidelines before uploading"
      warningNotice={<InstitutionalWarningNotice type="pfp" />}
      actionText="Choose Photo"
      cancelText="Cancel"
      ariaLabelledBy="upload-warning-title"
      ariaDescribedBy="upload-warning-desc"
    />
  );
}
