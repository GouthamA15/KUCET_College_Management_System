"use client";
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ImageWithLoading from '@/components/ui/ImageWithLoading';

export default function ImagePreviewModal({ src, alt = '', open, onClose }) {
  const overlayRef = useRef(null);
  const lastActiveRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    lastActiveRef.current = document.activeElement;
    // prevent background scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (e) => {
      if (e.key === 'Escape') onClose && onClose();
    };
    document.addEventListener('keydown', handleKey);

    // focus overlay for accessibility
    setTimeout(() => overlayRef.current && overlayRef.current.focus(), 0);

    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', handleKey);
      if (lastActiveRef.current && lastActiveRef.current.focus) lastActiveRef.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const modal = (
    <div
      ref={overlayRef}
      tabIndex={-1}
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-[9998] flex items-center justify-center animate-fadeIn"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose && onClose();
      }}
      style={{ outline: 'none' }}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative max-w-[96vw] max-h-[96vh] p-2 z-10 flex flex-col items-center">
        <button
          onClick={() => onClose && onClose()}
          aria-label="Close preview"
          className="absolute right-4 top-4 z-50 text-white bg-black/60 hover:bg-black/90 rounded-full p-2 border border-white/20 transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div 
          onClick={(e) => e.stopPropagation()}
          className="relative max-w-[94vw] max-h-[88vh] w-[90vw] h-[82vh] rounded-lg shadow-2xl overflow-hidden bg-black/50 flex items-center justify-center min-w-[280px] min-h-[200px]"
        >
          <ImageWithLoading
            src={src}
            alt={alt || "Image Preview"}
            fill
            sizes="94vw"
            variant="document"
            className="object-contain w-full h-full p-2"
            imageClassName="object-contain"
            errorText="Unable to display preview directly."
          />
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
