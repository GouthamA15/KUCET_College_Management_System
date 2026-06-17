"use client";

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';

export default function CertificatePageLayout({ title = "Certificate Requests", left, right, bottom, children }) {
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsMobileDevice(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent scroll when bottom sheet is open
  useEffect(() => {
    if (isBottomSheetOpen && isMobileDevice) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isBottomSheetOpen, isMobileDevice]);

  const bottomSheet = (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300">
      <div className="absolute inset-0 cursor-pointer" onClick={() => setIsBottomSheetOpen(false)} />
      <div 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="help-sheet-title" 
        className="relative bg-white w-full rounded-t-2xl shadow-2xl p-6 border-t border-slate-200 z-10 animate-slideUp max-h-[90vh] overflow-y-auto"
      >
        {/* Pull bar */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />
        
        {/* Close Button Top Right */}
        <button 
          onClick={() => setIsBottomSheetOpen(false)}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1"
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>

        <h3 id="help-sheet-title" className="text-lg font-bold text-[#0b2447] mb-3">Certificate Requests</h3>
        
        <div className="text-sm text-slate-700 space-y-4 mb-6 leading-relaxed">
          <p className="text-slate-600">
            Submit requests for institutional certificates such as Bonafide, Transfer Certificate, Migration Certificate, No Objection Certificate and Course Completion Certificate.
          </p>
          
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex gap-2">
              <span className="text-blue-600 font-bold shrink-0">•</span>
              <p className="text-slate-700">
                <strong className="font-semibold text-slate-800">Processing Time:</strong> 2–3 Working Days
              </p>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-600 font-bold shrink-0">•</span>
              <p className="text-slate-700">Approved certificates can be downloaded from Request History.</p>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-600 font-bold shrink-0">•</span>
              <p className="text-slate-700">Visit the office if assistance is required.</p>
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => setIsBottomSheetOpen(false)} 
          className="w-full bg-[#0b3578] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#0a2d66] active:bg-[#092554] transition-colors focus:outline-none"
        >
          Got It
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm pb-12 px-4 sm:px-0">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
          
          {/* Help Icon with Desktop Popover & Mobile Click Behavior */}
          <div 
            className="relative inline-flex items-center"
            onMouseEnter={() => !isMobileDevice && setIsHovered(true)}
            onMouseLeave={() => !isMobileDevice && setIsHovered(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (isMobileDevice) {
                  setIsBottomSheetOpen(true);
                }
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 focus:outline-none flex items-center justify-center cursor-pointer"
              aria-label="Help and processing information"
            >
              <Info size={20} className="shrink-0" />
            </button>

            {/* Desktop Popover */}
            {isHovered && !isMobileDevice && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-5 z-50 text-left animate-slideDown">
                <h4 className="text-base font-semibold text-[#0b2447] mb-2">Certificate Requests</h4>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Submit requests for institutional certificates such as Bonafide, Transfer Certificate, Migration Certificate, No Objection Certificate and Course Completion Certificate.
                </p>
                <div className="border-t border-slate-100 pt-3 space-y-2.5">
                  <div className="flex gap-2 text-xs">
                    <span className="text-blue-600 font-bold shrink-0">•</span>
                    <p className="text-slate-700">
                      <strong className="font-semibold text-slate-800">Processing Time:</strong> 2–3 Working Days
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="text-blue-600 font-bold shrink-0">•</span>
                    <p className="text-slate-700">Approved certificates can be downloaded from Request History.</p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="text-blue-600 font-bold shrink-0">•</span>
                    <p className="text-slate-700">Visit the office if assistance is required.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Request institutional certificates and track approvals.
        </p>
      </header>

      {/* Main Single-Column Content */}
      <div className="space-y-6">
        {/* Form Section */}
        <div className="bg-white border border-gray-300 rounded-md p-4 sm:p-6 shadow-xs">
          {left}
        </div>

        {/* Request History Section */}
        <div id="request-history-section" className="bg-white border border-gray-300 rounded-md p-4 sm:p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Request History</h2>
          <div className="border-t border-gray-100 pt-4">
            {bottom}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Sheet Portal */}
      {typeof document !== 'undefined' && isBottomSheetOpen && isMobileDevice && createPortal(bottomSheet, document.body)}
    </div>
  );
}


