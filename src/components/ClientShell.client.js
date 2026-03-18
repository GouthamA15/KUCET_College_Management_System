'use client';
import { useState, useEffect } from 'react';
import PublicSidebar from '@/components/PublicSidebar';
import LoginPanel from '@/components/LoginPanel';
import SearchParamToast from '@/components/SearchParamToast.client';

export default function ClientShell({ serverError }) {
  const [activePanel, setActivePanel] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const el = document.getElementById('main-content');
    if (!el) return;

    if (activePanel) {
      el.classList.add('opacity-50', 'pointer-events-none');
    } else {
      el.classList.remove('opacity-50', 'pointer-events-none');
    }
  }, [activePanel]);

  useEffect(() => {
    if (!activePanel) return;
    // scroll to login panel area (account for sticky offset)
    const el = document.getElementById('login-panels');
    if (el) {
      const offset = 20; 
      const y = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, [activePanel]);

  return (
    <>
      {/* Mobile Menu Trigger for Public Pages */}
      <div className="lg:hidden fixed top-4 left-4 z-[70]">
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 bg-[#0b3578] text-white rounded-lg shadow-lg hover:bg-[#0a2d66] transition-all"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      <PublicSidebar 
        activePanel={activePanel} 
        setActivePanel={setActivePanel} 
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />
      
      <LoginPanel activePanel={activePanel} onClose={() => setActivePanel(null)} />
      <SearchParamToast serverError={serverError} />

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 lg:hidden transition-all duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
