'use client';

import { useState } from 'react';
import { AdminProvider } from '@/context/AdminContext';
import AdminSidebar from '@/components/admin/AdminSidebar';
import Footer from '@/components/Footer';
import Header from '@/components/Header';

export default function AdminLayout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <AdminProvider>
      <div className="min-h-screen bg-[#f8fafc] flex font-sans">
        
        {/* Sidebar */}
        <AdminSidebar 
          isMobileOpen={isMobileMenuOpen} 
          setIsMobileOpen={setIsMobileMenuOpen} 
        />

        {/* Mobile Top Bar (Minimal) */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-[#f8fafc]/80 backdrop-blur-xl border-b border-slate-100/50 shadow-sm h-14 flex items-center px-4">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-slate-600 hover:text-slate-900"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-3 font-bold text-[#0b3578] tracking-tight">ADMIN PANEL</span>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen relative overflow-x-hidden transition-all duration-300 lg:ml-16">

          <Header />
          
          {/* Mobile Spacer */}
          <div className="lg:hidden h-14"></div>

          {/* Page Content */}
          <main className="flex-1 p-4 lg:p-8 pt-6">
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
    </AdminProvider>
  );
}
