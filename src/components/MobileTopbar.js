'use client';

import { useMemo, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getPortalTitle } from '@/lib/path-utils';
import { useAssets } from '@/context/AssetContext';
import { StudentContext } from '@/context/StudentContext';
import { StaffContext } from '@/context/StaffContext';

const DefaultAvatarSVG = () => (
  <svg 
    className="w-6 h-6 text-slate-400" 
    fill="currentColor" 
    viewBox="0 0 24 24"
  >
    <path 
      fillRule="evenodd" 
      d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" 
      clipRule="evenodd" 
    />
  </svg>
);

export default function MobileTopbar({ onMenuClick, title }) {
  const pathname = usePathname();
  const router = useRouter();
  const { getAsset } = useAssets();

  const studentCtx = useContext(StudentContext);
  const staffCtx = useContext(StaffContext);

  const studentData = studentCtx?.studentData?.student;
  const staffData = staffCtx?.staffData;
  const user = studentData || staffData;

  const resolvedTitle = useMemo(() => {
    if (title) return title;
    return getPortalTitle(pathname);
  }, [title, pathname]);

  const isProfilePage = pathname ? (pathname === '/student/profile' || pathname.endsWith('/profile')) : false;

  const handleProfileClick = () => {
    let route = '/student/profile';
    if (staffData) {
      // Use role to find profile page (e.g. /staff/faculty/profile)
      route = `/staff/${staffData.role || 'faculty'}/profile`;
    }
    router.push(route);
  };

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

        {/* Right: Profile Badge */}
        <div className="flex items-center justify-end min-w-[44px] w-11 h-11">
          {user && (
            <button 
              onClick={handleProfileClick}
              className={`w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-[13px] shadow-sm overflow-hidden border border-slate-200 transition-all duration-300 active:scale-95 ${
                isProfilePage ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100 scale-100'
              }`}
              title="View Profile"
            >
              {user?.pfp ? (
                <img 
                  src={getAsset(user.pfp)} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <DefaultAvatarSVG />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
