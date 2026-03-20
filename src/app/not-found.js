'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Branding/Icon */}
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <svg 
              className="w-12 h-12 text-[#0b3578]" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>
          <h1 className="text-6xl font-black text-[#0b3578] tracking-tighter">404</h1>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">Page Not Found</h2>
          <p className="mt-4 text-gray-600">
            Sorry, we couldn't find the page you're looking for. It might have been moved or deleted.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm"
          >
            Go Back
          </button>
          <Link
            href="/"
            className="flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-[#0b3578] hover:bg-[#082a66] transition-colors shadow-sm"
          >
            Return Home
          </Link>
        </div>

        {/* Institutional Footer */}
        <div className="pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 font-semibold tracking-wide uppercase">
            KU College of Engineering and Technology
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Kakatiya University, Warangal
          </p>
        </div>
      </div>
    </div>
  );
}
