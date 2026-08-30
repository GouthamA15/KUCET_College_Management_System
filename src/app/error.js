'use client';

import { useEffect } from 'react';
import Link from 'next/link';

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

export default function Error({ error, reset }) {
  const isChunkFailure = isChunkError(error);

  useEffect(() => {
    // Log the error
    console.error('[GlobalErrorBoundary]', error);
  }, [error]);

  const handleReload = () => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('kucet_chunk_retry_ts');
      } catch (err) {
        void err;
      }
      window.location.reload();
    } else {
      reset();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Branding/Icon */}
        <div className="flex flex-col items-center">
          <div className={`w-24 h-24 ${isChunkFailure ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'} rounded-full flex items-center justify-center mb-4`}>
            {isChunkFailure ? (
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                />
              </svg>
            )}
          </div>
          <h1 className={`text-4xl font-black ${isChunkFailure ? 'text-amber-600' : 'text-rose-600'} tracking-tighter`}>
            {isChunkFailure ? 'Update Available' : 'Oops!'}
          </h1>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">
            {isChunkFailure ? 'Application Has Been Updated' : 'Something went wrong'}
          </h2>
          <p className="mt-4 text-gray-600">
            {isChunkFailure
              ? 'A newer version of the KUCET portal is available. Please reload the page to apply the updates.'
              : 'We\'ve encountered an unexpected error. Our team has been notified.'}
          </p>
          <div className="mt-4 p-3 bg-gray-100 rounded text-left overflow-auto max-h-32 w-full">
            <code className="text-xs text-gray-500 font-mono break-all">
              {error?.message || 'Unknown Error'}
            </code>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <button
            onClick={handleReload}
            className="flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-[#0b3578] hover:bg-[#082a66] transition-colors shadow-sm cursor-pointer"
          >
            {isChunkFailure ? 'Reload Application' : 'Try Again'}
          </button>
          <Link
            href="/"
            className="flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm"
          >
            Go to Home
          </Link>
        </div>

        {/* Institutional Footer */}
        <div className="pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 font-semibold tracking-wide uppercase">
            KU College of Engineering and Technology
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Institutional Portal Support
          </p>
        </div>
      </div>
    </div>
  );
}
