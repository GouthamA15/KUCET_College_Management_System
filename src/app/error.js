'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('[GlobalErrorBoundary]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Branding/Icon */}
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 bg-rose-100 rounded-full flex items-center justify-center mb-4 text-rose-600">
            <svg 
              className="w-12 h-12" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
          </div>
          <h1 className="text-4xl font-black text-rose-600 tracking-tighter">Oops!</h1>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">Something went wrong</h2>
          <p className="mt-4 text-gray-600">
            We&apos;ve encountered an unexpected error. Our team has been notified.
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
            onClick={() => reset()}
            className="flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-[#0b3578] hover:bg-[#082a66] transition-colors shadow-sm"
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
