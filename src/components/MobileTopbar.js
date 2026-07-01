'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { getPortalTitle } from '@/lib/path-utils';
import { useAssets } from '@/context/AssetContext';

export default function MobileTopbar({ onMenuClick, title }) {
  const pathname = usePathname();
  const { getAsset } = useAssets();

  const resolvedTitle = useMemo(() => {
    if (title) return title;
    return getPortalTitle(pathname);
  }, [title, pathname]);

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 w-full transition-all duration-200 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
      <div className="h-[calc(60px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] flex items-center px-4 gap-3 justify-between">
        
        {/* Left: Hamburger Menu (44px touch target) */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 -ml-2 rounded-xl text-slate-700 hover:bg-slate-100/80 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors active:scale-95"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h8" />
          </svg>
        </button>

        {/* Center: Branding & Role Portal Title */}
        <div className="flex-1 flex items-center justify-center gap-2.5">
          <div className="flex shrink-0 items-center justify-center bg-blue-50 p-1.5 rounded-lg border border-blue-100">
            <Image onError={(e) => { e.currentTarget.style.display = 'none'; }} 
              src={getAsset('/assets/ku-college-logo.png')} 
              alt="KUCET Logo" 
              width={28} height={28}
              className="h-7 w-auto object-contain"
              priority
            />
          </div>
          <div className="flex flex-col items-start justify-center">
            <span className="text-[13px] font-black text-[#0b3578] tracking-wide leading-tight uppercase line-clamp-1">
              KUCET CMS
            </span>
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase leading-none mt-0.5">
              {resolvedTitle}
            </span>
          </div>
        </div>

        {/* Right: Empty spacer for balance, maintaining 44px min-width */}
        <div className="flex items-center justify-end min-w-[44px] w-11 h-11">
          {/* Optional: Add notification bell or profile picture here in the future */}
        </div>
      </div>
    </header>
  );
}
