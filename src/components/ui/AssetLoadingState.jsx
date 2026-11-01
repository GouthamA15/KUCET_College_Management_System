'use client';

import React from 'react';
import { FileText, Loader2 } from 'lucide-react';

/**
 * AssetLoadingState - Reusable loading indicator for all async storage and asset components.
 *
 * Variants:
 *  - 'spinner': Minimal institutional ring spinner
 *  - 'skeleton': Shimmer skeleton box matching container dimensions
 *  - 'avatar': Circular/rounded user silhouette with subtle pulse
 *  - 'signature': Horizontal specimen container with loading indicator
 *  - 'document': Document icon + "Loading PDF..." indicator
 *
 * Sizes:
 *  - 'xs': For table thumbnails (24-32px), compact, no disruptive voiceover
 *  - 'sm': For avatar badges (40-48px)
 *  - 'md': Standard profile & modals (96-160px)
 *  - 'lg' | 'fill': Full preview container or large modal view
 */
export default function AssetLoadingState({
  variant = 'spinner',
  size = 'md',
  label = 'Loading...',
  className = '',
  ariaLabel,
}) {
  const accessibleLabel = ariaLabel || label || 'Loading content';

  if (variant === 'skeleton') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={accessibleLabel}
        className={`w-full h-full bg-slate-100 animate-pulse rounded flex items-center justify-center motion-reduce:animate-none ${className}`}
      >
        <span className="sr-only">{accessibleLabel}</span>
      </div>
    );
  }

  if (variant === 'avatar') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={accessibleLabel}
        className={`w-full h-full bg-slate-100 flex items-center justify-center relative overflow-hidden animate-pulse motion-reduce:animate-none ${className}`}
      >
        <svg
          className="w-1/2 h-1/2 text-slate-300"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
            clipRule="evenodd"
          />
        </svg>
        <span className="sr-only">{accessibleLabel}</span>
      </div>
    );
  }

  if (variant === 'signature') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={accessibleLabel}
        className={`w-full h-full bg-slate-50 border border-slate-200 rounded flex items-center justify-center p-2 relative animate-pulse motion-reduce:animate-none ${className}`}
      >
        <div className="flex items-center gap-1.5 text-slate-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0b3578] motion-reduce:animate-none" />
          {size !== 'xs' && (
            <span className="text-[9px] font-semibold tracking-wider uppercase text-slate-500">
              {label || 'Loading signature...'}
            </span>
          )}
        </div>
        <span className="sr-only">{accessibleLabel}</span>
      </div>
    );
  }

  if (variant === 'document') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={accessibleLabel}
        className={`w-full h-full min-h-[160px] bg-slate-50 border border-slate-200 rounded-lg flex flex-col items-center justify-center p-6 text-center ${className}`}
      >
        <div className="relative mb-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0b3578]">
            <FileText className="w-6 h-6 animate-pulse motion-reduce:animate-none" />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 motion-reduce:hidden"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-[#0b3578] items-center justify-center text-white text-[8px]">
              &bull;
            </span>
          </span>
        </div>
        <p className="text-xs font-semibold text-slate-700 tracking-wide uppercase">
          {label || 'Loading Document Preview...'}
        </p>
        <p className="text-[10px] text-slate-400 mt-1">Retrieving official student record</p>
        <span className="sr-only">{accessibleLabel}</span>
      </div>
    );
  }

  // Default 'spinner' variant
  const spinnerSize =
    size === 'xs' ? 'w-3.5 h-3.5 border' :
    size === 'sm' ? 'w-4 h-4 border-2' :
    size === 'lg' || size === 'fill' ? 'w-8 h-8 border-3' :
    'w-6 h-6 border-2';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={accessibleLabel}
      className={`w-full h-full flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-xs p-2 text-center ${className}`}
    >
      <div
        className={`${spinnerSize} border-slate-200 border-t-[#0b3578] rounded-full animate-spin motion-reduce:animate-none`}
        aria-hidden="true"
      />
      {size !== 'xs' && label && (
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2 select-none">
          {label}
        </span>
      )}
      <span className="sr-only">{accessibleLabel}</span>
    </div>
  );
}
