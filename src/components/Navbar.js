'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Navbar({ activePanel, setActivePanel }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (panel) => {
    if (activePanel === panel) {
      setActivePanel(null); // Close if clicking the same panel
    } else {
      setActivePanel(panel);
    }
    setMobileMenuOpen(false);
  };

  const isActive = (panel) => activePanel === panel;

  return (
    <nav className="bg-[#0b3578] shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          
          <div className="flex-shrink-0">
            <Link 
              href="/"
              onClick={() => setActivePanel(null)}
              className="text-white text-lg font-bold hover:text-blue-200 transition-colors tracking-wide"
            >
              KUCET PORTAL
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-6">
            <Link 
              href="/"
              onClick={() => setActivePanel(null)}
              className={`text-white px-3 py-2 text-sm tracking-wide uppercase relative group ${
                activePanel === null ? 'text-blue-200' : ''
              }`}
            >
              HOME
              <span className={`absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out ${
                activePanel === null ? 'w-full' : 'w-0 group-hover:w-full'
              }`}></span>
            </Link>
            <button 
              onClick={() => handleNavClick('student')}
              className={`text-white px-3 py-2 text-sm tracking-wide uppercase relative group ${
                isActive('student') ? 'text-blue-200' : ''
              }`}
            >
              STUDENT LOGIN
              <span className={`absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out ${
                isActive('student') ? 'w-full' : 'w-0 group-hover:w-full'
              }`}></span>
            </button>
            <Link 
              href="/clerk/login"
              className={`text-white px-3 py-2 text-sm tracking-wide uppercase relative group`}
            >
              CLERK LOGIN
              <span className={`absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full`}></span>
            </Link>
            <Link 
              href="/admin/login"
              className={`text-white px-3 py-2 text-sm tracking-wide uppercase relative group`}
            >
              SUPER ADMIN
              <span className={`absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full`}></span>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white hover:text-blue-200 focus:outline-none p-2"
              aria-label="Toggle menu"
            >
              {/* Icon */}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div 
        className={`md:hidden bg-[#0a2d66] ${mobileMenuOpen ? 'block' : 'hidden'}`}
      >
        <div className="px-4 pt-2 pb-3 space-y-1">
          <Link href="/" onClick={() => { setActivePanel(null); setMobileMenuOpen(false); }} className="text-white block px-3 py-2.5 text-sm">HOME</Link>
          <button onClick={() => handleNavClick('student')} className={`text-white block w-full text-left px-3 py-2.5 text-sm ${isActive('student') ? 'text-blue-200' : ''}`}>STUDENT LOGIN</button>
          <Link href="/clerk/login" onClick={() => setMobileMenuOpen(false)} className="text-white block px-3 py-2.5 text-sm">CLERK LOGIN</Link>
          <Link href="/admin/login" onClick={() => setMobileMenuOpen(false)} className="text-white block px-3 py-2.5 text-sm">SUPER ADMIN</Link>
        </div>
      </div>
    </nav>
  );
}
