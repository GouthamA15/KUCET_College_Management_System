"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

function isChunkError(error) {
  if (!error) return false;
  const message = error.message || (typeof error === 'string' ? error : '') || '';
  const name = error.name || '';
  return (
    name === 'ChunkLoadError' ||
    message.includes('ChunkLoadError') ||
    message.includes('Loading chunk') ||
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed')
  );
}

export default function GlobalError({ error, reset }) {
  const isChunkFailure = isChunkError(error);

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const handleReload = () => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('kucet_chunk_retry_ts');
      } catch (err) {
        void err;
      }
      window.location.reload();
    } else if (reset) {
      reset();
    }
  };

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 font-sans text-gray-900">
        <div className="max-w-md w-full text-center space-y-6 p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className={`w-20 h-20 ${isChunkFailure ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'} rounded-full flex items-center justify-center mx-auto`}>
            {isChunkFailure ? (
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {isChunkFailure ? 'Update Available' : 'Application Error'}
            </h1>
            <p className="text-sm text-gray-600">
              {isChunkFailure
                ? 'A newer version of KUCET CMS is available. Please reload to load the latest application assets.'
                : 'A critical error occurred while loading the application.'}
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleReload}
              className="w-full py-3 px-4 bg-[#0b3578] hover:bg-[#082a66] text-white font-medium rounded-xl text-sm transition-colors shadow-sm cursor-pointer"
            >
              {isChunkFailure ? 'Reload Application' : 'Reload'}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
