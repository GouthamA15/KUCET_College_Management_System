'use client';

import { useState, useEffect } from 'react';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already accepted cookies
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#0b3578] text-white p-4 shadow-2xl z-[9999] border-t border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium">
            We use cookies to improve your experience on our portal. By continuing to use this site, you agree to our use of cookies.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAccept}
            className="bg-white text-[#0b3578] px-6 py-2 rounded-md text-sm font-bold hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            Accept Cookies
          </button>
        </div>
      </div>
    </div>
  );
}
