'use client';

import Link from 'next/link';
import { getNowSync } from '@/lib/clock';

export default function Footer() {
  return (
    <footer className="relative z-40 w-full border-t border-white/10 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 26px), radial-gradient(900px 260px at 20% 0%, rgba(59,130,246,0.28), transparent 60%), radial-gradient(720px 220px at 90% 100%, rgba(96,165,250,0.18), transparent 60%), linear-gradient(to right, rgba(11,53,120,0.98) 0%, rgba(13,71,161,0.96) 52%, rgba(10,61,145,0.98) 100%)',
          backgroundColor: '#0b3578',
        }}
      />
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-3 lg:px-5">
        

        {/* Divider */}
        {/* <div className="border-t border-blue-700 my-6"></div> */}

        <div className="text-center">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 mt-1 sm:mt-2">
              <span className="text-slate-50/95 text-xs sm:text-sm">
                © {getNowSync().getFullYear()}. All rights reserved. Developed by the Department of Computer Science & Engineering.
              </span>
              <div className="flex items-center gap-2 sm:gap-3">
                <Link href="/developers" className="text-xs sm:text-sm underline hover:text-white transition-colors duration-200 text-blue-200">
                  Developers
                </Link>
                <span className="text-blue-300/50">•</span>
                <Link href="/privacy-policy" className="text-xs sm:text-sm underline hover:text-white transition-colors duration-200 text-blue-200">
                  Privacy Policy
                </Link>
                <span className="text-blue-300/50">•</span>
                <Link href="/terms" className="text-xs sm:text-sm underline hover:text-white transition-colors duration-200 text-blue-200">
                  Terms of Service
                </Link>
              </div>
            </div>
        </div>
      </div>
    </footer>
  );
}
