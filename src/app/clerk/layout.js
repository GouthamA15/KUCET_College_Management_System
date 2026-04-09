'use client';

import { useState } from 'react';
import { ClerkProvider } from '@/context/ClerkContext';
import Sidebar from '@/components/Sidebar';
import ClerkTopBar from '@/components/clerk/ClerkTopBar';
import Footer from '@/components/Footer';
import Header from '@/components/Header';

export default function ClerkLayout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <ClerkProvider>
      <div className="min-h-screen bg-[#f8fafc] flex font-sans">
        
        {/* Sidebar - Always present, handles its own desktop/mobile visibility */}
        <Sidebar role="clerk" isMobileOpen={isMobileMenuOpen} setIsMobileOpen={setIsMobileMenuOpen} />

        {/* Mobile Top Bar (Search & Profile) - Fixed on Mobile */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-[#f8fafc]/80 backdrop-blur-xl border-b border-slate-100/50 shadow-sm w-full pt-[env(safe-area-inset-top)]">
          <ClerkTopBar onMenuClick={() => setIsMobileMenuOpen(true)} />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen relative overflow-x-hidden transition-all duration-300 lg:pt-[var(--site-header-height,72px)]">

          {/* Global header only on desktop */}
          <div className="hidden lg:block">
            <Header />
          </div>
          
          {/* Mobile Spacer */}
          <div className="lg:hidden h-[calc(4rem+env(safe-area-inset-top))]"></div>

          {/* Page Content */}
          <main className="flex-1 p-4 lg:p-8 pt-2">
            {children}
          </main>

          <Footer />
        </div>

        {/* Mobile Overlay (below sidebar, above content) */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-all duration-300"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </div>
    </ClerkProvider>
  );
}
