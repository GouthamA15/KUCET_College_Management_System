'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import LoginPanel from '@/components/LoginPanel';
import SearchParamToast from '@/components/SearchParamToast.client';
import Image from 'next/image';
import { getDashboardPathByRole } from '@/lib/path-utils';

function getSessionType() {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie;
  if (cookies.includes('admin_logged_in=')) return 'admin';
  if (cookies.includes('clerk_logged_in=')) return 'clerk';
  if (cookies.includes('student_logged_in=')) return 'student';
  return null;
}

export default function HomeLoginLanding({ serverError, initialPanel }) {
  const [activePanel, setActivePanel] = useState(() => {
    if (initialPanel === 'clerk' || initialPanel === 'student') return initialPanel;
    return 'student';
  });

  // null = still checking, false = no session (show login), true = session confirmed
  const [authStatus, setAuthStatus] = useState(null);

  const restoreAuth = useCallback(async () => {
    const sessionType = getSessionType();
    console.log('[AuthRestore] Detected sessionType:', sessionType);

    if (!sessionType) {
      console.log('[AuthRestore] No session companion cookie found. Falling back to login.');
      setAuthStatus(false);
      return;
    }

    try {
      console.log(`[AuthRestore] Attempting POST /api/auth/refresh for ${sessionType}`);
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: sessionType }),
        credentials: 'include',
      });

      console.log('[AuthRestore] Fetch returned status:', res.status);

      if (res.ok) {
        let destination = '/student';
        if (sessionType === 'admin') {
          destination = '/admin/dashboard';
        } else if (sessionType === 'clerk') {
          const clerkRoleMatch = document.cookie.match(/clerk_role=([^;]+)/);
          const clerkRole = clerkRoleMatch?.[1];
          destination = getDashboardPathByRole(clerkRole) || '/clerk';
        }
        console.log('[AuthRestore] Success! Hard navigating to:', destination);
        
        // Use a tiny timeout to ensure cookies are fully committed to the browser jar
        setTimeout(() => {
          window.location.href = destination;
        }, 100);
        return;
      }

      const errText = await res.text().catch(() => 'Unknown Error');
      console.error(`[AuthRestore] FAILED with status ${res.status}:`, errText);
      
      // Flash an alert so the user can immediately see what failed without opening devtools
      if (res.status === 401 && errText.includes('Token revoked')) {
         alert('Session refresh failed: Token was revoked (likely due to a concurrent request or expired grace period). Please login again.');
      } else if (res.status >= 500) {
         alert(`Server error during session refresh (HTTP ${res.status}): ${errText}`);
      }
      
      setAuthStatus(false);
    } catch (err) {
      console.error('[AuthRestore] Network or fetch error:', err);
      setAuthStatus(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await restoreAuth();
    };
    if (!cancelled) run();
    return () => { cancelled = true; };
  }, [restoreAuth]);

  const setActivePanelStrict = (panel) => {
    if (!panel) return;
    setActivePanel(panel);
  };

  return (
    <div className="relative h-full flex flex-col">
      <Navbar
        activePanel={activePanel}
        setActivePanel={setActivePanelStrict}
        sticky={false}
        brandLabel="LOGIN PORTAL"
      />
      
      {/* If authStatus is null and a session cookie exists, show the professional loader */}
      {authStatus === null && getSessionType() ? (
        <main className="flex-1 min-h-0 bg-slate-50 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
          {/* Decorative background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="w-full max-w-md bg-white border border-slate-200/60 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative z-10">
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-400 via-[#0b3578] to-blue-400" style={{ backgroundSize: '200% 100%', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
            
            <div className="p-8 sm:p-12 flex flex-col items-center text-center">
              <div className="relative flex items-center justify-center mb-8">
                {/* Outer Ring */}
                <div className="absolute w-32 h-32 border-[3px] border-slate-100 border-t-[#0b3578] border-r-[#0b3578]/50 rounded-full animate-spin" style={{ animationDuration: '1.5s' }}></div>
                
                {/* Inner Ring (Reverse) */}
                <div className="absolute w-24 h-24 border-[3px] border-transparent border-b-blue-400 border-l-blue-400/50 rounded-full animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}></div>
                
                {/* Center Logo */}
                <div className="bg-white rounded-full z-10 w-20 h-20 flex items-center justify-center shadow-[0_0_20px_rgba(11,53,120,0.08)]">
                  <Image 
                    src="/assets/ku-logo.png" 
                    alt="KU Logo" 
                    width={56} 
                    height={56}
                    className="object-contain animate-pulse"
                    priority
                  />
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">Restoring Session</h2>
              <p className="text-[15px] text-slate-500 font-medium max-w-[260px] leading-relaxed">
                Please wait while we securely authenticate your connection...
              </p>
              
              {/* Bouncing Dots */}
              <div className="mt-8 flex gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0b3578]/80 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-[#0b3578]/80 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-[#0b3578]/80 animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1 min-h-0 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              {/* Login first on mobile, right-side on desktop */}
              <section className="lg:col-span-7 order-1 lg:order-2">
                <div className="border border-slate-200 bg-white rounded-sm overflow-hidden">
                  <div className="px-3 sm:px-6 py-3">
                    <LoginPanel activePanel={activePanel} onClose={() => {}} variant="page" dismissable={false} />
                  </div>
                </div>
              </section>

              {/* Notice below login on mobile; left on desktop */}
              <aside className="lg:col-span-5 order-2 lg:order-1">
                <div className="border border-slate-200 bg-white rounded-sm overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-3">
                    <div className="text-[11px] font-bold tracking-widest uppercase text-slate-700">Notice</div>
                  </div>
                  <div className="p-4 sm:p-6">
                    <ul className="space-y-2 text-sm text-slate-700">
                      <li className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <span>Use official credentials only. Access is monitored and audited.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <span>Students: first-time login may require DOB as password (DD-MM-YYYY).</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <span>Staff: Google sign-in is supported for institutional accounts.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <span>Do not share passwords or reset links. Always log out on shared devices.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </main>
      )}

      <SearchParamToast serverError={serverError} />
    </div>
  );
}