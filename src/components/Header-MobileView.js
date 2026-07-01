"use client";
import Image from 'next/image';
import { COLLEGE_CONFIG } from '@/lib/college-config';
import { useAssets } from '@/context/AssetContext';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Institutional Mobile Header (Restored Original Style)
 * Shows on all pages when viewed on mobile devices
 */
export default function HeaderMobileView() {
  const { getAsset } = useAssets();
  const pathname = usePathname();
  const headerRef = useRef(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) {
      document.documentElement.style.setProperty('--mobile-header-height', '0px');
      return;
    }

    const updateHeight = () => {
      try {
        const h = Math.ceil(el.getBoundingClientRect().height);
        document.documentElement.style.setProperty('--mobile-header-height', `${h}px`);
      } catch (_e) { /* empty */ }
    };

    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    window.addEventListener('resize', updateHeight);

    return () => {
      try { ro.disconnect(); } catch (_e) { /* empty */ }
      window.removeEventListener('resize', updateHeight);
    };
  }, [pathname]);

  return (
    <header 
      ref={headerRef} 
      className="lg:hidden relative bg-linear-to-r from-blue-50 to-white py-4 px-4 w-full pt-[calc(1rem+env(safe-area-inset-top))] border-b border-slate-200 transition-colors duration-200"
    >
      <div className="flex flex-col items-center justify-center">
        {/* Top Row - Logos */}
        <div className="flex items-center justify-center gap-2 mb-1.5">
          <div className="bg-blue-100 p-1 rounded-lg">
            <Image onError={(e) => { e.currentTarget.style.display = 'none'; }} 
              src={getAsset('/assets/Naac_A+.png')} 
              alt="NAAC Logo" 
              width={40} height={40}
              className="h-8 w-auto object-contain"
              priority
            />
          </div>
          <div className="bg-blue-100 p-1 rounded-lg">
            <Image onError={(e) => { e.currentTarget.style.display = 'none'; }} 
              src={getAsset('/assets/ku-logo.png')} 
              alt="KU Logo" 
              width={40} height={40}
              className="h-8 w-auto object-contain"
            />
          </div>
          <div className="bg-blue-100 p-1 rounded-lg">
            <Image onError={(e) => { e.currentTarget.style.display = 'none'; }} 
              src={getAsset('/assets/ku-college-logo.png')} 
              alt="College Logo" 
              width={40} height={40}
              className="h-8 w-auto object-contain"
              priority
            />
          </div>
        </div>

        {/* Title Block */}
        <div className="text-center mb-1.5">
          <h2 className="text-sm font-bold text-[#0d47a1] m-0 leading-tight uppercase">
            {COLLEGE_CONFIG.name}
          </h2>
          <h3 className="text-xs font-semibold text-[#1565c0] mt-0.5 mb-0 uppercase">
            KAKATIYA UNIVERSITY
          </h3>
        </div>
      </div>
    </header>
  );
}
