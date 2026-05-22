'use client';

import { useState } from 'react';
import { ClerkProvider } from '@/context/ClerkContext';
import Sidebar from '@/components/Sidebar';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import HeaderMobileView from '@/components/Header-MobileView';
import MobileTopbar from '@/components/MobileTopbar';

export default function ClerkLayout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <ClerkProvider>
      <div className="min-h-screen flex flex-col font-sans">
        <div className="flex-1 flex">
        
        {/* Sidebar - Always present, handles its own desktop/mobile visibility */}
        <Sidebar role="clerk" isMobileOpen={isMobileMenuOpen} setIsMobileOpen={setIsMobileMenuOpen} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0 relative lg:ml-(--desktop-sidebar-offset,64px) transition-[margin-left] duration-220 ease-[cubic-bezier(0.2,0.8,0.2,1)]">

          {/* Institutional Mobile Header (non-sticky) */}
          <HeaderMobileView />

          {/* Compact Sticky Mobile Topbar */}
          <MobileTopbar onMenuClick={() => setIsMobileMenuOpen(true)} />

          {/* Content Wrapper (keep overflow rules away from sticky topbar) */}
          <div className="flex-1 flex flex-col min-h-0 relative overflow-x-hidden">
            {/* Global header only on desktop */}
            <div className="hidden lg:block">
              <Header />
            </div>

            {/* Page Content (single, consistent top spacing below header/topbar) */}
            <div className="flex-1 flex flex-col min-h-0 pt-(--app-content-top-gap,20px) lg:pt-(--app-fixed-header-offset,112px)">
              <main className="flex-1 p-4 lg:p-8 pt-0">
                {children}
              </main>
            </div>
          </div>
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
    </ClerkProvider>
  );
}
