'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [activePanel, setActivePanel] = useState(null); // Re-add activePanel state
  // const router = useRouter();

  // Restore the useEffect for redirecting logged-in students
  useEffect(() => {
    const checkAuth = async () => {
      // Check if user is already logged in and redirect accordingly
      const studentData = localStorage.getItem('logged_in_student');
      const clerkAuth = sessionStorage.getItem('clerk_authenticated');

      // Check admin auth via non-httpOnly cookie
      const adminLoggedIn = document.cookie
        .split('; ')
        .find(row => row.startsWith('admin_logged_in='));

      if (studentData) {
        router.replace('/student/profile');
        return;
      }

      if (clerkAuth) {
        // Read clerk role from cookie (set at login)
        const roleCookie = document.cookie.split('; ').find(row => row.startsWith('clerk_role='));
        const role = roleCookie ? roleCookie.split('=')[1].toLowerCase() : '';
        if (role.includes('scholar')) {
          router.replace('/clerk/scholarship/dashboard');
        } else {
          router.replace('/clerk/admission/dashboard');
        }
        return;
      }

      if (adminLoggedIn && adminLoggedIn.split('=')[1] === 'true') {
        // Admin is logged in, redirect to dashboard
        router.replace('/admin/dashboard');
        return;
      }
    };

    checkAuth();
  }, [router]);

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