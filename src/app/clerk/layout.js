'use client';

import { useState } from 'react';
import { ClerkProvider } from '@/context/ClerkContext';
import Sidebar from '@/components/Sidebar';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import HeaderMobileView from '@/components/Header-MobileView';
import Navbar from '@/components/Navbar';
import MobileTopbar from '@/components/MobileTopbar';
import { usePathname } from 'next/navigation';
import { getPortalTitle } from '@/lib/path-utils';
import { MOBILE_NAV_MODE } from '@/lib/college-config';

export default function ClerkLayout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const resolvedTitle = getPortalTitle(pathname);

  return (
    <ClerkProvider>
      <div className="min-h-screen flex flex-col font-sans">
        <div className="flex-1 flex">
        
        {/* Sidebar */}
        {MOBILE_NAV_MODE === 'sidebar' ? (
          <Sidebar 
            role="clerk" 
            isMobileOpen={isMobileMenuOpen} 
            setIsMobileOpen={setIsMobileMenuOpen} 
          />
        ) : (
          <div className="hidden lg:block">
            <Sidebar 
              role="clerk" 
              isMobileOpen={isMobileMenuOpen} 
              setIsMobileOpen={setIsMobileMenuOpen} 
            />
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0 relative lg:ml-(--desktop-sidebar-offset,64px) transition-[margin-left] duration-220 ease-[cubic-bezier(0.2,0.8,0.2,1)]">

          {/* Mobile Navigation */}
          <HeaderMobileView />
          <div className="lg:hidden sticky top-0 z-30">
            {MOBILE_NAV_MODE === 'sidebar' ? (
              <MobileTopbar onMenuClick={() => setIsMobileMenuOpen(true)} title={resolvedTitle} />
            ) : (
              <Navbar role="clerk" brandLabel={resolvedTitle} />
            )}
          </div>

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

        {/* Mobile Overlay for Sidebar Mode */}
        {MOBILE_NAV_MODE === 'sidebar' && isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2.5px] z-40 lg:hidden transition-all duration-300"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        </div>

        <Footer />
      </div>
    </ClerkProvider>
  );
}
