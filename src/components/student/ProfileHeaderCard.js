/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { getAssetUrl } from '@/lib/assets';

// Default User Avatar SVG
const DefaultAvatarSVG = () => (
  <svg 
    className="w-20 h-20 text-slate-400 transition-opacity duration-300 animate-fadeIn" 
    fill="currentColor" 
    viewBox="0 0 24 24"
    aria-label="Default user avatar"
  >
    <path 
      fillRule="evenodd" 
      d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" 
      clipRule="evenodd" 
    />
  </svg>
);

export default function ProfileHeaderCard({ student }) {
  const [showFullViewModal, setShowFullViewModal] = useState(false);

  // Image load state trackers
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Previous image URL tracking state to detect when the URL changes
  const [lastUrl, setLastUrl] = useState('');

  const resolvedPhotoUrl = useMemo(() => {
    const pfp = student?.pfp;
    if (!pfp) return '';
    const base = getAssetUrl(pfp);
    return base || '';
  }, [student?.pfp]);

  const imageRef = useRef(null);

  // Fix: Handle cached images where the native load event fires before React's synthetic onLoad is attached
  useEffect(() => {
    if (resolvedPhotoUrl && imageRef.current && imageRef.current.complete) {
      if (imageRef.current.naturalWidth === 0) {
        // Image failed to load or is broken
        setImageError(true);
        setImageLoading(false);
      } else {
        // Image successfully loaded from cache
        setImageLoading(false);
        setImageError(false);
      }
    }
  }, [resolvedPhotoUrl]);

  // Adjust state synchronously during render if target resolved URL has updated
  if (resolvedPhotoUrl !== lastUrl) {
    setLastUrl(resolvedPhotoUrl);
    setImageLoading(!!resolvedPhotoUrl);
    setImageError(false);
  }

  const isImageLoadingActive = resolvedPhotoUrl && imageLoading && !imageError;
  const showLoaderOverlay = isImageLoadingActive;

  return (
    <div className="flex flex-row items-center gap-3 select-none relative w-full overflow-visible xl:flex-col xl:items-start xl:gap-0 xl:overflow-hidden xl:rounded-[24px] xl:border xl:border-[#dfeafc] xl:bg-[linear-gradient(180deg,#ffffff_0%,#f6faff_100%)] xl:p-2.5 xl:sm:p-4 xl:shadow-[0_18px_42px_rgba(11,53,120,0.1)]">
      <div className="flex flex-col items-center gap-2 relative w-auto shrink-0 xl:items-start xl:gap-3 xl:w-full">
        <div className="relative w-28 h-28 sm:w-36 sm:h-36">
          <div className="absolute inset-0 rounded-[24px] bg-gradient-to-br from-[#0b3578] via-[#103d8a] to-[#6e9ef5] opacity-55 blur-sm -top-0.5" />
          <div 
            onClick={() => {
              if (resolvedPhotoUrl && !showLoaderOverlay && !imageError) {
                setShowFullViewModal(true);
              }
            }}
            className={`relative w-full h-full rounded-[30px] border-4 border-white/80 overflow-hidden flex items-center justify-center bg-white shadow-[0_8px_18px_rgba(11,53,120,0.1)] ${
              resolvedPhotoUrl && !showLoaderOverlay && !imageError ? 'cursor-zoom-in' : ''
            }`}
          >
            {showLoaderOverlay && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10">
                <div className="animate-spin h-7 w-7 border-4 border-[#0b3578] border-t-transparent rounded-full"></div>
                <span className="text-[9px] text-gray-500 font-bold mt-1.5 uppercase tracking-wider">Loading...</span>
              </div>
            )}

            {resolvedPhotoUrl && !imageError ? (
              <img 
                ref={imageRef}
                src={resolvedPhotoUrl}
                alt="Profile Photo"
                className={`object-cover w-full h-full transition-opacity duration-300 ${
                  isImageLoadingActive ? 'opacity-0' : 'opacity-100'
                }`}
                onLoad={() => {
                  setImageLoading(false);
                }}
                onError={() => {
                  setImageError(true);
                  setImageLoading(false);
                }}
              />
            ) : (
              <div className="bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 w-full h-full flex items-center justify-center">
                <DefaultAvatarSVG />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative mt-0 text-left flex-1 min-w-0 flex flex-col items-start xl:mt-3 xl:text-left xl:w-full xl:flex-none xl:items-start xl:block">
        <div className="flex items-center gap-2 flex-wrap justify-start pr-9 xl:justify-start xl:pr-0">
          <div className="text-xl sm:text-3xl font-black leading-tight break-words min-w-0 text-slate-900 xl:text-3xl">{student?.name || '-'}</div>
          <span className="inline-flex items-center rounded-full border border-[#0b3578]/20 bg-[#eaf1ff] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#0b3578] xl:inline-flex">Student</span>
          <Link href="/student/settings/edit-profile" title="Edit Profile" className="absolute right-0 top-0 inline-flex items-center justify-center rounded-xl border border-[#0b3578]/20 bg-white p-2 text-[#0b3578] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0b3578]/40 hover:bg-[#edf5ff] xl:static xl:inline-flex">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </Link>
        </div>
        {student?.roll_no && (
          <div className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-semibold tracking-[0.2em] text-slate-600 font-mono xl:inline-flex">{student.roll_no}</div>
        )}
      </div>

      {/* Full Image view Modal - Desktop/Mobile (Portal to body) */}
      {showFullViewModal && resolvedPhotoUrl && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={() => setShowFullViewModal(false)}
          className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 cursor-zoom-out animate-fadeIn"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-xl w-full aspect-square bg-transparent flex items-center justify-center rounded-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setShowFullViewModal(false)}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5 transition-colors cursor-pointer border border-white/10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <img
              src={resolvedPhotoUrl}
              alt="Profile Photo Full View"
              className="object-contain w-full h-full max-h-[85vh] rounded-md shadow-2xl"
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
