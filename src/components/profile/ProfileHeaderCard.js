'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getAssetUrl } from '@/lib/assets';

export default function ProfileHeaderCard({
  name,
  primaryId,
  photoUrl,
  editHref,
  editTitle = 'Modify Records',
  fallback = 'placeholder',
  compact = false,
}) {
  const [imageLoading, setImageLoading] = useState(true);

  const resolvedPhotoUrl = useMemo(() => getAssetUrl(photoUrl), [photoUrl]);

  const initials = useMemo(() => {
    const n = String(name || '').trim();
    if (!n) return '';
    const parts = n.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] || '';
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : '';
    return (a + b).toUpperCase();
  }, [name]);

  return (
    <div className={`flex items-center gap-3 ${compact ? 'flex-row xl:flex-col xl:items-start' : 'flex-col md:items-start'}`}>
      <div className={`${compact ? 'w-28 h-28 sm:w-32 sm:h-32 xl:w-40 xl:h-40' : 'w-40 h-40'} shrink-0 rounded-[28px] border-4 border-white overflow-hidden flex items-center justify-center bg-slate-100 relative shadow-[0_8px_18px_rgba(11,53,120,0.1)]`}>
        {resolvedPhotoUrl ? (
          <>
            {imageLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-10 space-y-2">
                <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
                <span className="text-xs text-gray-500 font-medium">Image is loading...</span>
              </div>
            )}
            <Image onError={(e) => { e.currentTarget.style.display = 'none'; }} 
              src={resolvedPhotoUrl}
              alt="Profile Photo"
              width={160}
              height={160}
              unoptimized
              className={`object-cover w-full h-full transition-opacity duration-300 ${
                imageLoading ? 'opacity-0' : 'opacity-100'
              }`}
              onLoad={() => setImageLoading(false)}
            />
          </>
        ) : fallback === 'initials' && initials ? (
          <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-slate-500">
            {initials}
          </div>
        ) : (
          <div className="text-gray-500">Profile Pic</div>
        )}
      </div>

      <div className={`${compact ? 'relative mt-0 text-left xl:mt-3' : 'mt-6 text-center md:text-left'}`}>
        <div className={`flex items-center gap-2 ${compact ? 'justify-start pr-8 xl:pr-0' : 'justify-center md:justify-start gap-3'}`}>
          <div className={`${compact ? 'text-xl sm:text-2xl xl:text-3xl' : 'text-3xl'} font-bold leading-tight break-words`}>{name || '-'}</div>
          {editHref ? (
            <Link
              href={editHref}
              title={editTitle}
              className={`${compact ? 'absolute right-0 top-0 rounded-xl border border-[#0b3578]/20 bg-white p-2 text-[#0b3578] shadow-sm xl:static xl:rounded-full xl:border-0 xl:bg-transparent xl:p-1.5' : 'p-1.5 text-slate-400 rounded-full'} hover:text-[#0b3578] hover:bg-slate-100 transition-all`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </Link>
          ) : null}
        </div>

        {primaryId ? (
          <div className={`${compact ? 'mt-2 inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm text-slate-600' : 'mt-1 text-lg text-gray-800'} font-semibold tracking-wide font-mono`}>{primaryId}</div>
        ) : null}
      </div>
    </div>
  );
}
