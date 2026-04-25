'use client';

import { useState } from 'react';
import { StudentProvider } from '@/context/StudentContext';
import { ProfileActivityProvider } from '@/context/ProfileActivityContext';
import StudentActivityBar from '@/components/student/StudentActivityBar';
import Sidebar from '@/components/Sidebar';
import StudentTopBar from '@/components/student/StudentTopBar';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';

export default function StudentLayout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <StudentProvider>
      <ProfileActivityProvider>
        <div className="min-h-screen flex flex-col font-sans">
          <div className="flex-1 flex">
          
          {/* Sidebar - Always present, handles its own desktop/mobile visibility */}
          <Sidebar role="student" isMobileOpen={isMobileMenuOpen} setIsMobileOpen={setIsMobileMenuOpen} />

          {/* Mobile Top Bar (Search & Profile) - Fixed on Mobile */}
          <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-linear-to-r from-blue-50/90 to-white/90 border-b border-slate-100/50 shadow-sm w-full pt-[env(safe-area-inset-top)]">
            <StudentTopBar onMenuClick={() => setIsMobileMenuOpen(true)} />
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-h-0 relative overflow-x-hidden lg:pt-(--site-header-height,72px) lg:ml-(--desktop-sidebar-offset,64px) transition-[margin-left] duration-220 ease-[cubic-bezier(0.2,0.8,0.2,1)]">

            {/* Global header only on desktop */}
            <div className="hidden lg:block">
              <Header />
            </div>
            
            {/* Mobile Spacer */}
            <div className="lg:hidden h-[calc(4rem+env(safe-area-inset-top))]"></div>

            {/* Activity Bar */}
            <div className="px-4 lg:px-8 mt-4">
              <StudentActivityBar />
            </div>

            {/* Page Content */}
            <main className="flex-1 p-4 lg:p-8 pt-2">
              {children}
            </main>
          </div>

          {/* Mobile Overlay (below sidebar, above content) */}
          {isMobileMenuOpen && (
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-all duration-300"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}
          </div>

          <Footer />
        </div>
      </ProfileActivityProvider>
    </StudentProvider>
  );
}
