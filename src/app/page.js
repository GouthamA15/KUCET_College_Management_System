'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import LoginPanel from '@/components/LoginPanel';
import Hero from '@/components/Hero';
import AboutSection from '@/components/AboutSection';
import Footer from '@/components/Footer';

export default function Home() {
  const [activePanel, setActivePanel] = useState(null);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <Navbar activePanel={activePanel} setActivePanel={setActivePanel} />
      <LoginPanel activePanel={activePanel} onClose={() => setActivePanel(null)} />
      
      {/* Show Hero and About only when no login panel is active */}
      <div className={`transition-all duration-500 ease-out ${
        activePanel ? 'opacity-50' : 'opacity-100'
      }`}>
        <Hero />
        <AboutSection />
      </div>
      
      <Footer />
    </div>
  );
}
