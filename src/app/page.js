'use client';

import { useState, useEffect } from 'react';
// import { useRouter } from 'next/navigation';
// import Header from '@/components/Header';
// import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import AboutSection from '@/components/AboutSection';
import LoginPanel from '@/components/LoginPanel'; // Re-import LoginPanel
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/app/components/Footer/Footer';

export default function Home() {
  const [activePanel, setActivePanel] = useState(null); // Re-add activePanel state

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



  // Remove auto-redirect for login panels
  const isTesting = process.env.NEXT_PUBLIC_WORKING_ENV === 'testing';

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {isTesting && (
        <a 
          href="/dev/time-machine"
          className="fixed top-0 left-0 z-[9999] bg-red-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-br-lg shadow-lg uppercase tracking-widest animate-pulse hover:bg-red-700 hover:scale-105 transition-all flex items-center gap-2 group"
          title="Open Time Machine"
        >
          <span>Testing Mode</span>
          <span className="bg-white/20 px-1.5 rounded text-[8px] group-hover:bg-white/40">Travel 🕒</span>
        </a>
      )}
      <Header />
      {/* Pass the state and setter to Navbar */}
      <Navbar activePanel={activePanel} setActivePanel={setActivePanel} />
      {/* Render the LoginPanel */}
      <LoginPanel
        activePanel={activePanel}
        onClose={() => setActivePanel(null)}
      />
      {/* Add back the opacity transition wrapper */}
      <div className={`transition-all duration-500 ease-out ${
        activePanel ? 'opacity-50 pointer-events-none' : 'opacity-100'
      }`}>
        <div className="grow">
          <Hero />
          <AboutSection />
        </div>
      </div>
      <Footer />
    </div>
  );
}