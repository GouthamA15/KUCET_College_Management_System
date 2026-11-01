'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import { RotateCcw, AlertCircle } from 'lucide-react';
import { getAssetUrl } from '@/lib/assets';
import { useAssetLoader } from '@/hooks/useAssetLoader';
import AssetLoadingState from './AssetLoadingState';

/**
 * ImageWithLoading - Unified, resilient image wrapper for KUCET CMS.
 *
 * Guarantees:
 * 1. Shows a container-matched loader while fetching from persistent storage or asset APIs.
 * 2. Prevents layout shift by preserving container dimensions.
 * 3. Never shows an infinite spinner if the image request fails.
 * 4. Provides a safe retry action without reloading the page.
 * 5. Handles missing/empty assets with institutional fallback placeholders.
 * 6. Always unoptimized by default to preserve session cookies on /api/assets/view/.
 */
export default function ImageWithLoading({
  src,
  alt = 'Asset preview',
  width,
  height,
  fill = false,
  sizes,
  className = '',
  containerClassName = '',
  imageClassName = '',
  variant = 'photo', // 'photo' | 'avatar' | 'signature' | 'thumbnail' | 'custom'
  fallback,
  fallbackAvatar,
  fallbackText,
  emptyText,
  errorText,
  onClick,
  unoptimized = true,
  priority = false,
  showRetry = true,
  retryLimit = 3,
  onLoad,
  onError,
  ...props
}) {
  const effectiveFallback = fallbackAvatar || fallback;
  const effectiveEmptyText = emptyText || fallbackText;
  const resolvedUrl = useMemo(() => {
    if (!src || typeof src !== 'string' || String(src).trim() === '') return '';
    return getAssetUrl(src);
  }, [src]);

  const {
    isLoading,
    isLoaded: _isLoaded,
    isError,
    isIdle,
    canRetry,
    retry,
    resolvedSrc,
    onLoadSuccess,
    onLoadError,
  } = useAssetLoader({
    src: resolvedUrl,
    retryLimit,
    onLoaded: onLoad,
    onError,
  });

  // 1. Missing or empty asset
  if (isIdle || !resolvedUrl) {
    if (effectiveFallback) return effectiveFallback;

    if (variant === 'avatar') {
      return (
        <div
          className={`flex items-center justify-center bg-slate-100 text-slate-500 font-bold uppercase rounded-full border border-slate-200 select-none ${fill ? 'w-full h-full' : (className || containerClassName || 'w-10 h-10 text-xs')}`}
          role="img"
          aria-label={alt || 'Default avatar'}
        >
          {effectiveEmptyText || (alt && alt !== 'Asset preview' ? alt.charAt(0).toUpperCase() : 'U')}
        </div>
      );
    }

    if (variant === 'signature') {
      return (
        <div
          className={`flex items-center justify-center bg-slate-50 border border-slate-200 rounded p-1 text-[10px] text-slate-400 italic select-none ${fill ? 'w-full h-full' : (className || containerClassName || 'w-24 h-10')}`}
          role="img"
          aria-label={alt || 'No signature available'}
        >
          {effectiveEmptyText || 'No Signature'}
        </div>
      );
    }

    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded p-2 text-slate-400 select-none ${fill ? 'w-full h-full' : (className || containerClassName || 'w-full h-full min-h-[80px]')}`}
        role="img"
        aria-label={alt || 'No image record'}
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {effectiveEmptyText || 'No Image'}
        </span>
      </div>
    );
  }

  // Determine size token for the loader
  const loaderSize =
    variant === 'thumbnail' ? 'xs' :
    variant === 'avatar' ? 'sm' :
    variant === 'signature' ? 'sm' :
    'md';

  const loaderVariant =
    variant === 'avatar' ? 'avatar' :
    variant === 'signature' ? 'signature' :
    variant === 'document' ? 'document' :
    'spinner';

  // Extract object-fit class from imageClassName or className, or derive from variant
  const extractObjectFit = (cls) => {
    if (!cls || typeof cls !== 'string') return null;
    const match = cls.match(/\bobject-(contain|cover|fill|none|scale-down)\b/);
    return match ? match[0] : null;
  };

  const explicitFit = extractObjectFit(imageClassName) || extractObjectFit(className);
  const defaultFit = (variant === 'signature' || variant === 'document' || variant === 'receipt')
    ? 'object-contain'
    : (variant === 'avatar' || variant === 'thumbnail' || variant === 'photo')
      ? 'object-cover'
      : (fill ? 'object-contain' : 'object-cover');
  const resolvedObjectFit = explicitFit || defaultFit;

  const containerClasses = [
    'relative overflow-hidden flex items-center justify-center',
    fill ? 'w-full h-full' : '',
    containerClassName,
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      className={containerClasses}
      style={!fill && width && height ? { width, height } : undefined}
      onClick={onClick}
    >
      {/* 2. Loading State */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90">
          <AssetLoadingState
            variant={loaderVariant}
            size={loaderSize}
            label={variant === 'signature' ? 'Signature...' : variant === 'document' ? 'Loading Document...' : 'Loading...'}
          />
        </div>
      )}

      {/* 3. Error / Failure State with Retry */}
      {isError && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded p-2 text-center text-slate-500"
          role="alert"
          aria-live="polite"
        >
          {effectiveFallback ? (
            effectiveFallback
          ) : variant === 'avatar' ? (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 font-bold uppercase text-xs">
              {effectiveEmptyText || (alt && alt !== 'Asset preview' ? alt.charAt(0).toUpperCase() : '?')}
            </div>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-slate-400 mb-1" />
              <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-tight">
                {errorText || effectiveEmptyText || 'Image unavailable'}
              </span>
              {showRetry && canRetry && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    retry();
                  }}
                  className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-300 text-[9px] font-semibold text-[#0b3578] hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
                  aria-label="Retry loading image"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> Retry
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* 4. Active Image (Only shown once resolvedUrl is available) */}
      {fill ? (
        <Image
          src={resolvedSrc}
          alt={alt}
          fill
          sizes={sizes || '(max-width: 768px) 100vw, 400px'}
          unoptimized={unoptimized}
          priority={priority}
          onLoad={onLoadSuccess}
          onError={onLoadError}
          className={`${resolvedObjectFit} transition-opacity duration-300 ${
            isLoading || isError ? 'opacity-0' : 'opacity-100'
          } ${imageClassName}`.trim()}
          {...props}
        />
      ) : (
        <Image
          src={resolvedSrc}
          alt={alt}
          width={width || 120}
          height={height || 120}
          unoptimized={unoptimized}
          priority={priority}
          onLoad={onLoadSuccess}
          onError={onLoadError}
          className={`${resolvedObjectFit} max-w-full max-h-full h-auto w-auto transition-opacity duration-300 ${
            isLoading || isError ? 'opacity-0' : 'opacity-100'
          } ${imageClassName}`.trim()}
          {...props}
        />
      )}
    </div>
  );
}
