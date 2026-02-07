'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AdminNavbar() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      // Call logout API to clear cookies server-side
      const response = await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        // Clear any client-side storage
                // Redirect to home
        router.replace('/');
      } else {
        console.error('Logout failed');
        // Force redirect anyway
        router.replace('/');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even if API call fails
      router.replace('/');
    }
  };

  return (
    <>
      <nav className="bg-[#0b3578] shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex-shrink-0">
              <span className="text-white text-lg font-bold tracking-wide">ADMIN PANEL</span>
            </div>
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/admin/dashboard" className="text-white px-3 py-2 text-sm tracking-wide uppercase relative group">
                Dashboard
                <span className="absolute left-0 -bottom-1 w-full h-0.5 bg-white scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
              </Link>
              <Link href="/admin/manage-clerks" className="text-white px-3 py-2 text-sm tracking-wide uppercase relative group">
                Manage Clerks
                <span className="absolute left-0 -bottom-1 w-full h-0.5 bg-white scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
              </Link>
              <Link href="/admin/create-clerk" className="text-white px-3 py-2 text-sm tracking-wide uppercase relative group">
                Create Clerk
                <span className="absolute left-0 -bottom-1 w-full h-0.5 bg-white scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
              </Link>
              <button onClick={handleLogout} className="text-white px-3 py-2 text-sm tracking-wide uppercase relative group">
                Logout
                <span className="absolute left-0 -bottom-1 w-full h-0.5 bg-white scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
              </button>
            </div>
            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle menu"
                className="p-2 focus:outline-none"
              >
                <span className={`block w-6 h-0.5 bg-white transform transition duration-200 ease-in-out ${mobileMenuOpen ? 'translate-y-2 rotate-45' : ''}`} />
                <span className={`block w-6 h-0.5 bg-white my-1 transform transition duration-200 ease-in-out ${mobileMenuOpen ? 'opacity-0' : 'opacity-100'}`} />
                <span className={`block w-6 h-0.5 bg-white transform transition duration-200 ease-in-out ${mobileMenuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
              </button>
            </div>
          </div>
        </div>
        {/* Mobile Menu */}
        <div className={`md:hidden bg-[#0a2d66] overflow-hidden transition-all duration-250 ease-in-out ${mobileMenuOpen ? 'opacity-100' : 'opacity-0'}`} style={{ transform: mobileMenuOpen ? 'translateY(0)' : 'translateY(-8px)', maxHeight: mobileMenuOpen ? '320px' : '0px' }}>
          <div className="px-4 pt-2 pb-3">
            <Link href="/admin/dashboard" className="block px-3 py-2 text-white">Dashboard</Link>
            <Link href="/admin/manage-clerks" className="block px-3 py-2 text-white">Manage Clerks</Link>
            <Link href="/admin/create-clerk" className="block px-3 py-2 text-white">Create Clerk</Link>
            <button onClick={() => { setMobileMenuOpen(false); handleLogout(); }} className="w-full text-left px-3 py-2 text-white">Logout</button>
          </div>
        </div>
      </nav>
      {/* Change password removed for Admin per requirements */}
    </>
  );
}
