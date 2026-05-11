'use client';
import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import LoginPanel from '@/components/LoginPanel';
import SearchParamToast from '@/components/SearchParamToast.client';

export default function ClientShell({ serverError, stickyNavbar = true }) {
  const [activePanel, setActivePanel] = useState(null);

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
      <Navbar 
        activePanel={activePanel} 
        setActivePanel={setActivePanel} 
        sticky={stickyNavbar}
      />
      
      <LoginPanel activePanel={activePanel} onClose={() => setActivePanel(null)} />
      <SearchParamToast serverError={serverError} />
    </>
  );
}
