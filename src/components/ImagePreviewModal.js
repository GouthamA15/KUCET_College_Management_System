"use client";
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

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
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose && onClose();
      }}
      style={{ outline: 'none' }}
    >
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative max-w-[98vw] max-h-[98vh] p-2">
        <button
          onClick={() => onClose && onClose()}
          aria-label="Close preview"
          className="absolute right-2 top-2 z-50 text-white bg-black/40 rounded-full p-1"
        >
          ✕
        </button>
        <div className="max-w-full max-h-full rounded shadow-lg overflow-hidden">
          <img src={src} alt={alt} onClick={(e)=>e.stopPropagation()} className="block max-w-[90vw] max-h-[90vh] object-contain bg-black" />
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
