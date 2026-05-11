'use client';

import { useState } from 'react';
import { AdminProvider } from '@/context/AdminContext';
import AdminSidebar from '@/components/admin/AdminSidebar';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import HeaderMobileView from '@/components/Header-MobileView';
import MobileTopbar from '@/components/MobileTopbar';

export default function AdminLayout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <AdminProvider>
      <div className="min-h-screen flex flex-col font-sans">
        <div className="flex-1 flex">
        
        {/* Sidebar */}
        <AdminSidebar 
          isMobileOpen={isMobileMenuOpen} 
          setIsMobileOpen={setIsMobileMenuOpen} 
        />

        {/* Institutional Mobile Header */}
        

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0 relative transition-all duration-300 lg:ml-16">

          {/* Institutional Mobile Header (non-sticky) */}
          <HeaderMobileView />

          {/* Compact Sticky Mobile Topbar */}
          <MobileTopbar onMenuClick={() => setIsMobileMenuOpen(true)} />

          {/* Content Wrapper (keep overflow rules away from sticky topbar) */}
          <div className="flex-1 flex flex-col min-h-0 relative overflow-x-hidden">
            <div className="hidden lg:block">
              <Header />
            </div>
            
            {/* Page Content */}
            <main className="flex-1 p-4 lg:p-8 pt-6">
              {children}
            </main>
          </div>
        </div>

        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 lg:hidden transition-all duration-300"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        </div>

        <Footer />
      </div>
    </AdminProvider>
  );
}
