/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { getAssetUrl } from '@/lib/assets';

// Default User Avatar SVG (Step 6 & 7 Fallback)
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

// Client-side image cropping and compression utility (Part 6 & 7)
const compressImage = (base64Str, maxBytes = 200 * 1024) => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.src = base64Str;
    img.onload = () => {
      // 1. Crop to square (1:1 aspect ratio) and determine optimal dimensions (max 800px)
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;
      const width = img.width;
      const height = img.height;

      const size = Math.min(width, height);
      const startX = (width - size) / 2;
      const startY = (height - size) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = Math.min(size, MAX_WIDTH);
      canvas.height = Math.min(size, MAX_HEIGHT);
      const ctx = canvas.getContext('2d');
      
      // Draw centered cropped square (no distortion)
      ctx.drawImage(img, startX, startY, size, size, 0, 0, canvas.width, canvas.height);

      // 2. Adjust quality dynamically in a loop until size fits under 200KB
      let quality = 0.8; // Target ~0.75-0.85
      let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      
      // Base64 size estimation: string length * 0.75
      while (compressedDataUrl.length * 0.75 > maxBytes && quality > 0.4) {
        quality -= 0.1;
        compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      if (compressedDataUrl.length * 0.75 > maxBytes) {
        // Fallback scale down to 400px if still over 200KB limit
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = 400;
        fallbackCanvas.height = 400;
        const fbCtx = fallbackCanvas.getContext('2d');
        fbCtx.drawImage(canvas, 0, 0, 400, 400);
        compressedDataUrl = fallbackCanvas.toDataURL('image/jpeg', 0.6);
      }

      if (compressedDataUrl.length * 0.75 > maxBytes) {
        reject(new Error("Image is too large and could not be compressed below 200KB."));
      } else {
        resolve(compressedDataUrl);
      }
    };
    img.onerror = () => {
      reject(new Error("Failed to process image. Make sure it is a valid picture file."));
    };
  });
};

export default function ProfileHeaderCard({ student, refreshData }) {
  const [showOptionsCard, setShowOptionsCard] = useState(false);
  const [showFullViewModal, setShowFullViewModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshingPfp, setIsRefreshingPfp] = useState(false);
  const [fileError, setFileError] = useState(null);

  // Cache busting timestamp (Step 9 - Lightweight cache-buster, no params on default loads)
  const [cacheBuster, setCacheBuster] = useState(0);

  // Previous image URL tracking state to detect when the URL changes
  const [lastUrl, setLastUrl] = useState('');

  // Image load state trackers (Step 5 - Fix infinite loading)
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const fileInputRef = useRef(null);
  const cameraBtnRef = useRef(null);
  const firstActionRef = useRef(null);

  const resolvedPhotoUrl = useMemo(() => {
    const pfp = student?.pfp;
    if (!pfp) return '';
    const base = getAssetUrl(pfp);
    if (!base) return '';
    return cacheBuster ? `${base}?t=${cacheBuster}` : base;
  }, [student?.pfp, cacheBuster]);

  // Render audit logger (Step 10 - Debugging)
  console.info('[ProfileHeaderCard] Component Rendered. resolvedPhotoUrl:', resolvedPhotoUrl, 'imageLoading:', imageLoading, 'imageError:', imageError);

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

  // Adjust state synchronously during render if target resolved URL has updated (Step 9 cache-buster check)
  if (resolvedPhotoUrl !== lastUrl) {
    console.info('[ProfileHeaderCard] Src changed from:', lastUrl, 'to:', resolvedPhotoUrl);
    setLastUrl(resolvedPhotoUrl);
    setImageLoading(!!resolvedPhotoUrl);
    setImageError(false);
  }

  // Lifecycle instrumentation logs (Audit request 3)
  useEffect(() => {
    console.info('[ProfileHeaderCard] Component mounted.');
    return () => {
      console.info('[ProfileHeaderCard] Component unmounted.');
    };
  }, []);

  useEffect(() => {
    if (resolvedPhotoUrl && !imageError) {
      console.info('[ProfileHeaderCard] Image element mounted. src:', resolvedPhotoUrl);
      return () => {
        console.info('[ProfileHeaderCard] Image element unmounted.');
      };
    }
  }, [resolvedPhotoUrl, imageError]);

  const closeOptionsCard = () => {
    setFileError(null);
    setShowOptionsCard(false);
  };

  const toggleOptionsCard = () => {
    setFileError(null);
    setShowOptionsCard(prev => !prev);
  };

  // Accessibility (Part 13): Close popover on Escape and return focus
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showOptionsCard) {
        closeOptionsCard();
        cameraBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showOptionsCard]);

  // Accessibility (Part 13): Focus popover first action when card mounts
  useEffect(() => {
    if (showOptionsCard) {
      setTimeout(() => {
        firstActionRef.current?.focus();
      }, 50);
    }
  }, [showOptionsCard]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);

    // Image validation (Part 5)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setFileError("Unsupported file type. Only JPG, PNG and WEBP are supported.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    if (!allowedExtensions.includes(extension)) {
      setFileError("Unsupported file extension. Only JPG, PNG and WEBP are supported.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result;
      
      try {
        setIsUploading(true);
        const compressedBase64 = await compressImage(base64Data);
        await handleUploadPayload(compressedBase64);
        closeOptionsCard();
      } catch (err) {
        setFileError(err.message || "Failed to upload or compress image.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      setFileError("Failed to read selected file.");
    };
    reader.readAsDataURL(file);
  };

  const handleUploadPayload = async (base64Data) => {
    const toastId = toast.loading(base64Data ? "Uploading photo..." : "Removing photo...");
    try {
      setIsRefreshingPfp(true);
      const res = await fetch('/api/student/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roll_no: student?.roll_no,
          pfp: base64Data
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || "Failed to update profile picture.");
      }

      toast.success(base64Data ? "Profile picture updated!" : "Profile picture removed!");
      
      if (base64Data) {
        // Update cache buster dynamically to trigger fresh fetch immediately for snappy UI
        setCacheBuster(Date.now());
      }

      if (refreshData) {
        await refreshData();
      }
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      toast.dismiss(toastId);
      setIsRefreshingPfp(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setIsUploading(true);
      await handleUploadPayload(null);
      closeOptionsCard();
    } catch (err) {
      setFileError(err.message || "Failed to remove photo.");
    } finally {
      setIsUploading(false);
    }
  };

  // Determine if image container is actively loading (Step 5)
  const isImageLoadingActive = resolvedPhotoUrl && imageLoading && !imageError;
  const showLoaderOverlay = isRefreshingPfp || isImageLoadingActive;

  return (
    <div className="flex flex-col items-center md:items-start select-none relative">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg, image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

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
            {/* Loading Spinner overlay (Audit request 2 - Spinner overlay, not replacing target image element) */}
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
                  console.info('[ProfileHeaderCard] onLoad fired for src:', resolvedPhotoUrl);
                  setImageLoading(false);
                }}
                onError={() => {
                  console.error('[ProfileHeaderCard] onError fired for src:', resolvedPhotoUrl);
                  setImageError(true);
                  setImageLoading(false);
                }}
              />
            ) : (
              // Default avatar SVG fallback if url is empty or has error (Step 6 & 7)
              <DefaultAvatarSVG />
            )}
          </div>

          {/* Camera Badge Overlay */}
          <button 
            ref={cameraBtnRef}
            type="button" 
            onClick={(e) => { e.stopPropagation(); toggleOptionsCard(); }}
            disabled={isUploading || showLoaderOverlay}
            className="absolute bottom-1.5 right-1.5 bg-[#0b3578] hover:bg-blue-900 text-white rounded-full p-2 border-2 border-white shadow-md hover:scale-105 transition-all flex items-center justify-center cursor-pointer z-20 disabled:opacity-70"
            title={isUploading ? "Processing..." : "Upload or Change Photo"}
          >
            {isUploading || showLoaderOverlay ? (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>

          {/* Floating Actions Popover Card - Desktop Only (Part 4) - Rendered relative to Avatar Circle */}
          {showOptionsCard && (
            <>
              {/* Click-outside backdrop */}
              <div className="fixed inset-0 z-30 hidden md:block" onClick={closeOptionsCard} />
              
              <div 
                className="absolute left-full top-0 ml-4 z-40 hidden md:block bg-white border border-gray-300 rounded-sm shadow-md p-4 w-52 text-left animate-fadeIn border-l-2 border-l-[#0b3578]"
              >
                <h4 className="font-bold text-gray-800 text-[11px] uppercase tracking-wider mb-2 border-b border-gray-150 pb-1">
                  Profile Photo Action
                </h4>
                
                {fileError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 text-[10px] p-2 rounded-sm font-semibold mb-3 flex items-start gap-1">
                    <span>{fileError}</span>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <button
                    ref={firstActionRef}
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-1.5 px-2.5 hover:bg-slate-50 text-gray-700 font-semibold text-xs text-left rounded-sm flex items-center gap-2 cursor-pointer transition-colors focus:bg-slate-50 focus:outline-none"
                  >
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {student?.pfp ? "Change Photo" : "Upload Photo"}
                  </button>

                  {student?.pfp && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="w-full py-1.5 px-2.5 hover:bg-red-50 text-red-750 font-semibold text-xs text-left rounded-sm flex items-center gap-2 cursor-pointer transition-colors focus:bg-red-50 focus:outline-none"
                    >
                      <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove Photo
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 text-center md:text-left w-full">
        <div className="text-3xl font-bold leading-tight truncate text-gray-800">{student?.name || '-'}</div>
        {student?.roll_no && (
          <div className="mt-1 text-lg font-semibold tracking-wide text-gray-500 font-mono">{student.roll_no}</div>
        )}
      </div>

      {/* Floating Bottom Card - Mobile Only (Portal to body for layering) */}
      {showOptionsCard && typeof document !== 'undefined' && createPortal(
        <>
          {/* Mobile backdrop */}
          <div 
            className="fixed inset-0 z-[9990] bg-black/35 backdrop-blur-xs md:hidden" 
            onClick={closeOptionsCard}
          />
          
          {/* Bottom Card Drawer */}
          <div 
            className="fixed bottom-0 left-0 right-0 z-[9995] md:hidden bg-white border-t border-gray-300 rounded-t-lg shadow-lg p-5 pb-7 flex flex-col gap-3 animate-slideUp"
          >
            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
              <h3 className="font-bold text-gray-800 text-sm">Profile Photo Action</h3>
              <button
                type="button"
                onClick={closeOptionsCard}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {fileError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-sm font-semibold">
                {fileError}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                ref={firstActionRef}
                type="button"
                onClick={() => { fileInputRef.current?.click(); }}
                className="w-full py-3 px-4 bg-slate-50 border border-gray-250 rounded-sm hover:bg-slate-100 text-gray-800 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {student?.pfp ? "Change Photo" : "Upload Photo"}
              </button>

              {student?.pfp && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="w-full py-3 px-4 bg-red-50 border border-red-200 rounded-sm hover:bg-red-100 text-red-700 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Remove Photo
                </button>
              )}

              <button
                type="button"
                onClick={closeOptionsCard}
                className="w-full py-3 px-4 border border-gray-300 rounded-sm text-gray-700 font-semibold text-xs flex items-center justify-center cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

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
