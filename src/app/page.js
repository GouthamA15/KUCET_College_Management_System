'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import LoginPanel from '@/components/LoginPanel'; // Re-import LoginPanel
import Hero from '@/components/Hero';
import AboutSection from '@/components/AboutSection';
import Footer from '@/components/Footer';

export default function Home() {
  const [activePanel, setActivePanel] = useState(null); // Re-add activePanel state
  const router = useRouter();

  // Restore the useEffect for redirecting logged-in students
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
        <div className="flex-grow">
          <Hero />
          <AboutSection />
        </div>
      </div>
      <Footer />
    </div>
  );
}