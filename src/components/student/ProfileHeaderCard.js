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
    <div className="flex flex-col items-center md:items-start select-none relative w-full overflow-hidden">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative">
        {/* Avatar Circle Container */}
        <div className="relative w-40 h-40">
          <div 
            onClick={() => {
              if (resolvedPhotoUrl && !showLoaderOverlay && !imageError) {
                setShowFullViewModal(true);
              }
            }}
            className={`w-full h-full rounded-full border-4 border-gray-300 overflow-hidden flex items-center justify-center bg-gray-100 relative ${
              resolvedPhotoUrl && !showLoaderOverlay && !imageError ? 'cursor-zoom-in' : ''
            }`}
          >
            {/* Loading Spinner overlay */}
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
              <DefaultAvatarSVG />
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 text-center md:text-left w-full flex flex-col items-center md:items-start">
        <div className="flex items-start gap-2 w-full">
          <div className="text-3xl font-bold leading-tight break-words min-w-0 text-gray-800">{student?.name || '-'}</div>
          <Link href="/student/settings/edit-profile" title="Edit Profile" className="flex-shrink-0 mt-1.5 inline-flex items-center justify-center border border-gray-300 rounded-md p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </Link>
        </div>
        {student?.roll_no && (
          <div className="mt-1 text-lg font-semibold tracking-wide text-gray-500 font-mono">{student.roll_no}</div>
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
