'use client';

import { useState } from 'react';

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
          
          {/* Logo/Brand */}
          <div className="flex-shrink-0">
            <button 
              onClick={() => setActivePanel(null)}
              className="text-white text-lg font-bold hover:text-blue-200 transition-colors tracking-wide"
            >
              KUCET PORTAL
            </button>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-6">
            <button 
              onClick={() => setActivePanel(null)}
              className={`text-white px-3 py-2 text-sm tracking-wide uppercase relative group ${
                activePanel === null ? 'text-blue-200' : ''
              }`}
            >
              HOME
              <span className={`absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out ${
                activePanel === null ? 'w-full' : 'w-0 group-hover:w-full'
              }`}></span>
            </button>
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
            <button 
              onClick={() => handleNavClick('clerk')}
              className={`text-white px-3 py-2 text-sm tracking-wide uppercase relative group ${
                isActive('clerk') ? 'text-blue-200' : ''
              }`}
            >
              CLERK LOGIN
              <span className={`absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out ${
                isActive('clerk') ? 'w-full' : 'w-0 group-hover:w-full'
              }`}></span>
            </button>
            <button 
              onClick={() => handleNavClick('admin')}
              className={`text-white px-3 py-2 text-sm tracking-wide uppercase relative group ${
                isActive('admin') ? 'text-blue-200' : ''
              }`}
            >
              SUPER ADMIN
              <span className={`absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out ${
                isActive('admin') ? 'w-full' : 'w-0 group-hover:w-full'
              }`}></span>
            </button>
          </div>

          {/* Mobile Menu Button - Animated Hamburger */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white hover:text-blue-200 focus:outline-none p-2 relative w-10 h-10 flex items-center justify-center"
              aria-label="Toggle menu"
            >
              <div className="w-6 h-5 relative flex flex-col justify-between">
                {/* Top bar */}
                <span 
                  className={`block h-0.5 w-full bg-current rounded-full transform transition-all duration-300 ease-in-out origin-center ${
                    mobileMenuOpen ? 'rotate-45 translate-y-2' : ''
                  }`}
                />
                {/* Middle bar */}
                <span 
                  className={`block h-0.5 w-full bg-current rounded-full transition-all duration-300 ease-in-out ${
                    mobileMenuOpen ? 'opacity-0 scale-x-0' : 'opacity-100 scale-x-100'
                  }`}
                />
                {/* Bottom bar */}
                <span 
                  className={`block h-0.5 w-full bg-current rounded-full transform transition-all duration-300 ease-in-out origin-center ${
                    mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''
                  }`}
                />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu with Animation */}
      <div 
        className={`md:hidden bg-[#0a2d66] overflow-hidden transition-all duration-300 ease-in-out ${
          mobileMenuOpen ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pt-2 pb-3 space-y-1">
          <button 
            onClick={() => { setActivePanel(null); setMobileMenuOpen(false); }}
            className={`text-white block w-full text-left px-3 py-2.5 text-sm tracking-wide uppercase transform transition-all duration-300 ease-in-out border-b border-transparent hover:border-white ${
              mobileMenuOpen ? 'translate-x-0 opacity-100 delay-100' : '-translate-x-4 opacity-0'
            }`}
          >
            HOME
          </button>
          <button 
            onClick={() => handleNavClick('student')}
            className={`text-white block w-full text-left px-3 py-2.5 text-sm tracking-wide uppercase transform transition-all duration-300 ease-in-out border-b border-transparent hover:border-white ${
              mobileMenuOpen ? 'translate-x-0 opacity-100 delay-150' : '-translate-x-4 opacity-0'
            } ${isActive('student') ? 'text-blue-200 border-white' : ''}`}
          >
            STUDENT LOGIN
          </button>
        </div>
      </div>
    </nav>
  );
}
