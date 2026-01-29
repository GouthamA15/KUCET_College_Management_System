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



  // Remove auto-redirect for login panels

  return (
    <div className="min-h-screen flex flex-col bg-white">
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