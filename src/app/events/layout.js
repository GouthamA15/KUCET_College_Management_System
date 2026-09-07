'use client';

import React, { useState, useEffect } from 'react';
import { StudentProvider } from '@/context/StudentContext';
import { StaffProvider } from '@/context/StaffContext';
import { AdminProvider } from '@/context/AdminContext';
import Sidebar from '@/components/Sidebar';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import MobileTopbar from '@/components/MobileTopbar';
import { usePathname } from 'next/navigation';
import { getPortalTitle } from '@/lib/path-utils';
import { MOBILE_NAV_MODE } from '@/lib/college-config';

export default function EventsLayout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  let activeRole = 'student';
  if (typeof document !== 'undefined') {
    const cookies = document.cookie || '';
    if (cookies.includes('admin_logged_in=true') || cookies.includes('admin_auth')) {
      activeRole = 'admin';
    } else if (cookies.includes('staff_logged_in=true') || cookies.includes('staff_auth')) {
      activeRole = 'staff';
    }
  }

  const pathname = usePathname();
  const resolvedTitle = getPortalTitle(pathname) || 'Campus Events';

  useEffect(() => {
    document.title = 'Campus Events | KUCET CMS';
  }, [pathname]);

  return (
    <AdminProvider>
      <StudentProvider>
        <StaffProvider>
          <div className="min-h-screen flex flex-col font-sans">
            <div className="flex-1 flex">
              {/* Standard KUCET Sidebar with authenticated role */}
              {MOBILE_NAV_MODE === 'sidebar' ? (
                <Sidebar
                  role={activeRole}
                  isMobileOpen={isMobileMenuOpen}
                  setIsMobileOpen={setIsMobileMenuOpen}
                />
              ) : (
                <div className="hidden lg:block">
                  <Sidebar
                    role={activeRole}
                    isMobileOpen={isMobileMenuOpen}
                    setIsMobileOpen={setIsMobileMenuOpen}
                  />
                </div>
              )}

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col min-h-0 relative lg:ml-(--desktop-sidebar-offset,64px) transition-[margin-left] duration-220 ease-[cubic-bezier(0.2,0.8,0.2,1)]">
                {/* Mobile Navigation */}
                <div className="lg:hidden sticky top-0 z-30 shadow-xs">
                  {MOBILE_NAV_MODE === 'sidebar' ? (
                    <MobileTopbar onMenuClick={() => setIsMobileMenuOpen(true)} title={resolvedTitle} />
                  ) : (
                    <Navbar role={activeRole} brandLabel={resolvedTitle} />
                  )}
                </div>

              {/* Content Wrapper */}
              <div className="flex-1 flex flex-col min-h-0 relative overflow-x-hidden">
                {/* Global header only on desktop */}
                <div className="hidden lg:block">
                  <Header />
                </div>

                {/* Page Content */}
                <div className="flex-1 flex flex-col min-h-0 pt-(--app-content-top-gap,20px) lg:pt-(--app-fixed-header-offset,72px)">
                  <main className="flex-1 p-4 lg:p-8 pt-0">
                    {children}
                  </main>
                </div>
              </div>
            </div>

            {/* Mobile Overlay for Sidebar Mode */}
            {MOBILE_NAV_MODE === 'sidebar' && isMobileMenuOpen && (
              <div
                className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
                onClick={() => setIsMobileMenuOpen(false)}
              />
            )}
          </div>

            <Footer />
          </div>
        </StaffProvider>
      </StudentProvider>
    </AdminProvider>
  );
}
