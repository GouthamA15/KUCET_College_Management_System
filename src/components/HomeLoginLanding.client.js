'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import LoginPanel from '@/components/LoginPanel';
import SearchParamToast from '@/components/SearchParamToast.client';

export default function HomeLoginLanding({ serverError, initialPanel }) {
  const [activePanel, setActivePanel] = useState(() => {
    if (initialPanel === 'clerk' || initialPanel === 'student') return initialPanel;
    return 'student';
  });

  // On the home landing, the login panel is the page itself.
  // Prevent toggling "off" into a blank state.
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
                      <span>Students Test auto deployment : first-time login may require DOB as password (DD-MM-YYYY).</span>
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

      <SearchParamToast serverError={serverError} />
    </div>
  );
}
