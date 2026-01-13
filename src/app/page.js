'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import LoginPanel from '@/components/LoginPanel';
import Hero from '@/components/Hero';
import AboutSection from '@/components/AboutSection';
import Footer from '@/components/Footer';

export default function Home() {
  const [activePanel, setActivePanel] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('logged_in_student');
      if (stored) {
        router.replace('/student/profile');
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <Navbar activePanel={activePanel} setActivePanel={setActivePanel} />
      <LoginPanel
        activePanel={activePanel}
        onClose={() => setActivePanel(null)}
      />
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