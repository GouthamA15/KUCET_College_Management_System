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
      el.classList.add('opacity-40', 'pointer-events-none', 'blur-[2px]');
    } else {
      el.classList.remove('opacity-40', 'pointer-events-none', 'blur-[2px]');
    }
  }, [activePanel]);

  return (
    <>
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
