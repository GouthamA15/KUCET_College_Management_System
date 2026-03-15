'use client';

import { useState } from 'react';
import { StudentProvider } from '@/context/StudentContext';
import { ProfileActivityProvider } from '@/context/ProfileActivityContext';
import StudentActivityBar from '@/components/student/StudentActivityBar';
import StudentSidebar from '@/components/student/StudentSidebar';
import StudentTopBar from '@/components/student/StudentTopBar';
import Footer from '@/components/Footer';
import Header from '@/components/Header';

export default function StudentLayout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <StudentProvider>
      <ProfileActivityProvider>
        <div className="min-h-screen bg-[#f8fafc] flex font-sans">
          
          {/* Sidebar - Desktop: Rail | Mobile: Drawer */}
          <StudentSidebar 
            isMobileOpen={isMobileMenuOpen} 
            setIsMobileOpen={setIsMobileMenuOpen} 
          />

          {/* Main Content Area */}
          <div className="flex-1 lg:ml-16 flex flex-col min-h-screen relative overflow-x-hidden transition-all duration-300">
            
            {/* Institutional Header - Desktop Only */}
            <div className="hidden lg:block w-full border-b border-slate-100 bg-white">
              <Header />
            </div>

            {/* Top Bar (Search & Profile) - Fixed on Mobile, Sticky on Desktop */}
            <div className="lg:sticky lg:top-0 fixed top-0 left-0 right-0 lg:left-auto lg:right-auto z-30 bg-[#f8fafc]/80 backdrop-blur-xl border-b border-slate-100/50 shadow-sm lg:shadow-none w-full">
              <StudentTopBar onMenuClick={() => setIsMobileMenuOpen(true)} />
            </div>

            {/* Mobile Spacer */}
            <div className="lg:hidden h-16"></div>

            {/* Activity Bar */}
            <div className="px-4 lg:px-8 mt-2">
              <StudentActivityBar />
            </div>

            {/* Page Content */}
            <main className="flex-1 p-4 lg:p-8 pt-2">
              {children}
            </main>

            <Footer />
          </div>

          {/* Mobile Overlay */}
          {isMobileMenuOpen && (
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 lg:hidden transition-all duration-300"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}
        </div>
      </ProfileActivityProvider>
    </StudentProvider>
  );
}
