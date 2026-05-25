"use client";
import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { COLLEGE_CONFIG } from '@/lib/college-config';
import { useAssets } from '@/context/AssetContext';

export default function Header({ fixed = true }) {
  const { getAsset } = useAssets();
  const headerRef = useRef(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const root = document.documentElement;

    const updateHeight = () => {
      try {
        const h = Math.ceil(el.getBoundingClientRect().height);
        if (h > 0) {
          root.style.setProperty('--site-header-height', `${h}px`);
        } else {
          root.style.removeProperty('--site-header-height');
        }
      } catch (e) {
        // noop
      }
    };

    updateHeight();

    let ro;
    try {
      ro = new ResizeObserver(updateHeight);
      ro.observe(el);
    } catch (e) {
      // ResizeObserver not available (older browsers) — rely on resize fallback.
    }

    window.addEventListener('resize', updateHeight);

    return () => {
      try { ro?.disconnect(); } catch (e) {}
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  const handlePhoneClick = () => {
    navigator.clipboard.writeText(COLLEGE_CONFIG.contact);
    alert('Phone number copied to clipboard!');
  };

  const positionClass = fixed ? 'fixed top-0 left-0 right-0 z-40' : 'relative z-20';

  return (
    <header ref={headerRef} className={`hidden md:block ${positionClass} bg-gradient-to-r from-blue-50 to-white py-4 px-4 md:px-6 w-full pt-[calc(1rem+env(safe-area-inset-top))] md:pt-4 border-b border-slate-200 transition-colors duration-200`}>
      <div className="flex items-center justify-between h-full">

        {/* Left Section with Logos */}
        <div className="flex items-center gap-2">
          <div className="bg-blue-100 p-1 rounded-lg">
            <Image 
              src={getAsset('/assets/Naac_A+.png')} 
              alt="NAAC Logo" 
              width={56} height={56}
              className="h-11 w-auto object-contain"
              priority
            />
          </div>

          <div className="bg-blue-100 p-1 rounded-lg">
            <Image 
              src={getAsset('/assets/ku-logo.png')} 
              alt="KU Logo" 
              width={56} height={56}
              className="h-11 w-auto object-contain"
              priority
            />
          </div>

          <div className="bg-blue-100 p-1 rounded-lg">
            <Image 
              src={getAsset('/assets/kakatiya-kala-thoranam.png')} 
              alt="Kakatiya Kala Thoranam" 
              width={56} height={56}
              className="h-11 w-auto object-contain"
              priority
            />
          </div>
        </div>

        {/* Center Title Block */}
        <div className="text-center flex-1 px-2">
          <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-[#0d47a1] m-0 leading-none uppercase">
            {COLLEGE_CONFIG.name}
          </h2>
          <h3 className="text-base md:text-lg lg:text-xl font-semibold text-[#1565c0] mt-0.5 mb-0 leading-tight uppercase">
            KAKATIYA UNIVERSITY
          </h3>
          <p className="text-xs md:text-sm text-[#444] mt-0 mb-0">
            {COLLEGE_CONFIG.location} - {COLLEGE_CONFIG.pincode}
          </p>
        </div>

        {/* Right Side Block */}
        <div className="flex items-start gap-2 h-full">
          <div className="bg-blue-100 p-1 rounded-lg">
            <Image 
              src={getAsset('/assets/rudramadevi_statue.jpg')} 
              alt="Rudramadevi Statue" 
              width={56} height={56}
              className="h-11 w-auto object-contain"
              priority
            />
          </div>

          <div className="bg-blue-100 p-1 rounded-lg">
            <Image 
              src={getAsset('/assets/ku-college-logo.png')} 
              alt="College Logo" 
              width={56} height={56}
              className="h-11 w-auto object-contain"
              priority
            />
          </div>

          <div className="flex flex-col justify-center h-full py-0.5">
            <div className="text-[11px] lg:text-[12px] text-[#333] leading-tight">
              <p className="m-0"><b>PGECET:</b> {COLLEGE_CONFIG.entranceCodes.pgecet}</p>
              <p className="m-0"><b>EAPCET:</b> {COLLEGE_CONFIG.entranceCodes.eapcet}</p>
              <p className="m-0"><b>ECET:</b> {COLLEGE_CONFIG.entranceCodes.ecet}</p>
            </div>

            {/* Contact Number */}
            <p 
              onClick={handlePhoneClick}
              className="text-[12px] text-[#e91e63] font-bold cursor-pointer hover:text-pink-700 transition-colors whitespace-nowrap mt-1 leading-none"
              title="Click to copy phone number"
            >
              ☎️ {COLLEGE_CONFIG.contact}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
