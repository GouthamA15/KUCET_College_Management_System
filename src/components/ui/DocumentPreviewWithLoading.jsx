'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Download, ExternalLink, AlertCircle, RotateCcw, X, File } from 'lucide-react';
import { getAssetUrl } from '@/lib/assets';
import AssetLoadingState from './AssetLoadingState';
import ImageWithLoading from './ImageWithLoading';

/**
 * DocumentPreviewWithLoading - Production-ready PDF and document preview container.
 *
 * Guarantees:
 * 1. Displays document-specific loading state (animated icon & text) while PDF or document is loading.
 * 2. Seamlessly transitions to the rendered iframe or image when ready.
 * 3. Times out gracefully if iframe PDF preview fails (e.g. browser PDF plugin disabled or mobile),
 *    offering direct "Open in New Tab" and "Download" buttons.
 * 4. Never displays infinite loading or blank white screen.
 * 5. Handles switching documents without stale document leakage.
 */
export default function DocumentPreviewWithLoading({
  src,
  title = 'Document Proof',
  alt = 'Document Preview',
  onClose,
  className = '',
  maxHeight = '80vh',
  showToolbar = true,
  downloadable = true,
}) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeTimedOut, setIframeTimedOut] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const resolvedUrl = src ? getAssetUrl(src) : '';
  const currentKey = `${resolvedUrl}-${retryKey}`;
  const [prevKey, setPrevKey] = useState(currentKey);

  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setIframeLoaded(false);
    setIframeTimedOut(false);
  }

  const isPdf = typeof src === 'string' && (
    src.toLowerCase().endsWith('.pdf') || 
    src.toLowerCase().includes('.pdf?') ||
    resolvedUrl.toLowerCase().includes('.pdf')
  );

  const isImage = typeof src === 'string' && (
    /\.(jpe?g|png|webp|gif|svg|bmp|ico|tiff)(\?.*)?$/i.test(src) ||
    /\.(jpe?g|png|webp|gif|svg|bmp|ico|tiff)(\?.*)?$/i.test(resolvedUrl) ||
    resolvedUrl.includes('/api/student/requests/image/') ||
    resolvedUrl.includes('/pfp/') ||
    resolvedUrl.includes('/signatures/') ||
    resolvedUrl.includes('/payment') ||
    src.startsWith('data:image/') ||
    (!isPdf && !/\.(docx?|xlsx?|csv|zip|tar|gz|rar)(\?.*)?$/i.test(src))
  );

  useEffect(() => {
    if (!isPdf || !resolvedUrl) return;

    // Safety timeout: if iframe onLoad hasn't fired in 12s, allow user to open directly
    const timer = setTimeout(() => {
      setIframeTimedOut(true);
    }, 12000);

    return () => clearTimeout(timer);
  }, [resolvedUrl, isPdf, retryKey]);

  const handleRetry = () => {
    setIframeLoaded(false);
    setIframeTimedOut(false);
    setRetryKey((k) => k + 1);
  };

  if (!resolvedUrl) {
    return (
      <div className={`w-full min-h-[220px] bg-slate-50 border border-slate-200 rounded-lg flex flex-col items-center justify-center p-6 text-center ${className}`}>
        <FileText className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-sm font-semibold text-slate-700">No Document Available</p>
        <p className="text-xs text-slate-400 mt-1">No file record is attached to this request.</p>
      </div>
    );
  }

  return (
    <div className={`w-full flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg ${className}`}>
      {/* 1. Header Toolbar */}
      {showToolbar && (
        <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1 rounded bg-white/10 text-white">
              {isPdf ? <FileText className="w-4 h-4" /> : <File className="w-4 h-4" />}
            </span>
            <span className="text-xs font-bold tracking-wide uppercase truncate text-slate-200" title={title}>
              {title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-blue-300 hover:text-white px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Open in New Tab</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {downloadable && (
              <a
                href={resolvedUrl}
                download
                className="text-xs font-semibold text-slate-300 hover:text-white px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                title="Download file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </a>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close document preview"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Content Area */}
      <div className="relative w-full flex-1 bg-slate-100 flex items-center justify-center overflow-hidden" style={{ minHeight: '380px', maxHeight }}>
        {isPdf ? (
          <>
            {/* PDF Loading Overlay */}
            {!iframeLoaded && !iframeTimedOut && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50">
                <AssetLoadingState
                  variant="document"
                  label="Loading PDF Document..."
                />
              </div>
            )}

            {/* Timeout / Fallback View */}
            {iframeTimedOut && !iframeLoaded && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-white text-center">
                <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
                <h4 className="text-sm font-bold text-slate-800">Direct PDF Preview Notice</h4>
                <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
                  The PDF could not be embedded directly in your current browser session. You can view or download the authentic file directly.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="px-3 py-1.5 rounded bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Retry
                  </button>
                  <a
                    href={resolvedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-1.5 rounded bg-[#0b3578] text-white text-xs font-semibold hover:bg-blue-900 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    Open Document in New Tab ↗
                  </a>
                </div>
              </div>
            )}

            {/* Embedded PDF Iframe */}
            <iframe
              key={`pdf-frame-${retryKey}`}
              src={resolvedUrl}
              title={title}
              onLoad={() => setIframeLoaded(true)}
              className={`w-full h-full border-0 bg-white transition-opacity duration-300 ${
                iframeLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ minHeight: '450px' }}
            />
          </>
        ) : isImage ? (
          <div className="relative w-full h-full min-h-[380px] p-4 flex items-center justify-center overflow-hidden">
            <ImageWithLoading
              src={resolvedUrl}
              alt={alt}
              fill
              sizes="100vw"
              variant="document"
              className="object-contain w-full h-full"
              imageClassName="object-contain max-h-[78vh]"
              containerClassName="relative w-full h-full min-h-[360px] flex items-center justify-center"
            />
          </div>
        ) : (
          /* Non-previewable Document (Word, Excel, ZIP) */
          <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-lg border border-slate-200 shadow-sm m-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0b3578] mb-4">
              <File className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-900 mb-1">
              {title}
            </h4>
            <p className="text-xs text-slate-500 mb-6 max-w-sm">
              This document type cannot be previewed in the browser. You can download the file to inspect its contents.
            </p>
            <div className="flex items-center gap-3">
              <a
                href={resolvedUrl}
                download
                className="px-5 py-2.5 rounded-lg bg-[#0b3578] text-white text-xs font-bold hover:bg-blue-900 transition-colors inline-flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4" /> Download Official Document
              </a>
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                Open in Tab ↗
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
