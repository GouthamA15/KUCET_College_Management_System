'use client';
import { useState, useEffect } from 'react';
import Navbar from '@/app/components/Navbar/Navbar';
import LoginPanel from '@/components/LoginPanel';
import SearchParamToast from '@/components/SearchParamToast.client';

export default function ClientShell({ serverError }) {
  const [activePanel, setActivePanel] = useState(null);

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
    // scroll to login panel area (account for sticky navbar height ~56-72px)
    const el = document.getElementById('login-panels');
    if (el) {
      const navbarHeight = 70; // safe offset
      const y = el.getBoundingClientRect().top + window.scrollY - navbarHeight;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, [activePanel]);

  return (
    <>
      <Navbar activePanel={activePanel} setActivePanel={setActivePanel} />
      <LoginPanel activePanel={activePanel} onClose={() => setActivePanel(null)} />
      <SearchParamToast serverError={serverError} />
    </>
  );
}
