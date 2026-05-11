'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { getPortalTitle } from '@/lib/path-utils';

export default function MobileTopbar({ onMenuClick, title }) {
  const pathname = usePathname();

  const resolvedTitle = useMemo(() => {
    if (title) return title;
    return getPortalTitle(pathname);
  }, [title, pathname]);

  return (
    <div className="lg:hidden sticky top-0 z-30 bg-[#0b3578] border-b border-white/10 w-full transition-colors duration-200">
      <div className="h-[calc(44px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] flex items-center px-3 gap-2">
        {/* Left: Hamburger Menu */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="p-2 -ml-1 text-white/90 hover:text-white focus:outline-none"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Center: Role Portal Title */}
        <div className="flex-1 flex justify-center">
          <span className="text-[11px] font-semibold text-white tracking-widest uppercase">
            {resolvedTitle}
          </span>
        </div>

        {/* Right: Empty spacer (removed ThemeToggle) */}
        <div className="flex items-center justify-end w-10">
        </div>
      </div>
    </div>
  );
}
