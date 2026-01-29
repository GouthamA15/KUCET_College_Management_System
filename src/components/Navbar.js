'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Navbar({ activePanel, setActivePanel, clerkMode = false, studentProfileMode = false, onLogout, clerkMinimal = false, activeTab, setActiveTab }) {
  const router = useRouter();
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
            <span className="text-white text-lg font-bold tracking-wide">KUCET PORTAL</span>
          </div>
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-6">
            {clerkMode ? (
              clerkMinimal ? (
                <>
                  <Link href="/clerk/admission/dashboard" className="text-white px-3 py-2 text-sm tracking-wide uppercase relative group">
                    Dashboard
                    <span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span>
                  </Link>
                  <button onClick={async () => {
                    await fetch('/api/clerk/logout', { method: 'POST' });
                    router.replace('/');
                  }} className="text-white px-3 py-2 text-sm tracking-wide uppercase relative group">
                    Logout
                    <span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span>
                  </button>
                </>
              ) : (
                <>
                  <Link href="#" className="text-white px-3 py-2 text-sm tracking-wide uppercase relative group">
                    Departments
                    <span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span>
                  </Link>
                  <Link href="#" className="text-white px-3 py-2 text-sm tracking-wide uppercase relative group">
                    Admissions
                    <span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span>
                  </Link>
                  <Link href="#" className="text-white px-3 py-2 text-sm tracking-wide uppercase relative group">
                    Time Tables
                    <span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span>
                  </Link>
                  <Link href="#" className="text-white px-3 py-2 text-sm tracking-wide uppercase relative group">
                    Faculties
                    <span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span>
                  </Link>
                  <button onClick={async () => {
                    await fetch('/api/clerk/logout', { method: 'POST' });
                    router.replace('/');
                  }} className="text-white px-3 py-2 text-sm tracking-wide uppercase relative group">
                    Logout
                    <span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span>
                  </button>
                </>
              )
            ) : studentProfileMode ? (
              <>
                <button onClick={() => setActiveTab('academics')} className={`text-white px-3 py-2 text-sm tracking-wide uppercase relative group ${activeTab === 'academics' ? 'text-blue-200' : ''}`}>
                  Academics
                  <span className={`absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out ${activeTab === 'academics' ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
                </button>
                <button onClick={() => { router.push('/student/timetable'); }} className="text-white px-3 py-2 text-sm tracking-wide uppercase relative group">
                  Time Table
                  <span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span>
                </button>
                {/* Requests Dropdown */}
                <div className="relative group">
                  <button className="text-white px-3 py-2 text-sm tracking-wide uppercase relative flex items-center">
                    Requests
                    {/* Added: transition-transform duration-300 group-hover:rotate-180 */}
                    <svg 
                      className="w-4 h-4 ml-1 transition-transform duration-300 group-hover:rotate-180" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span>
                  </button>
                  {/* Dropdown Menu */}
                  <div className="absolute left-0 top-full w-56 bg-white rounded-b-md shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform z-50">
                    <Link href="/student/requests/bonafide" className="block px-4 py-2 text-sm text-gray-700 hover:bg-[#0b3578] hover:text-white transition-colors">
                      Bonafide Certificate
                    </Link>
                    <Link href="/student/requests/nodues" className="block px-4 py-2 text-sm text-gray-700 hover:bg-[#0b3578] hover:text-white transition-colors">
                      No Dues Certificate
                    </Link>
                  </div>
                </div>
                <button onClick={() => setActiveTab('scholarship')} className={`text-white px-3 py-2 text-sm tracking-wide uppercase relative group ${activeTab === 'scholarship' ? 'text-blue-200' : ''}`}>
                  Scholarship
                  <span className={`absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out ${activeTab === 'scholarship' ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
                </button>
                <button onClick={() => setActiveTab('fees')} className={`text-white px-3 py-2 text-sm tracking-wide uppercase relative group ${activeTab === 'fees' ? 'text-blue-200' : ''}`}>
                  Fees
                  <span className={`absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out ${activeTab === 'fees' ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
                </button>
                <button onClick={() => setActiveTab('basic')} className={`text-white px-3 py-2 text-sm tracking-wide uppercase relative group ${activeTab === 'basic' ? 'text-blue-200' : ''}`}>
                  Profile
                  <span className={`absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out ${activeTab === 'basic' ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
                </button>
                <button onClick={onLogout} className="text-white px-3 py-2 text-sm tracking-wide uppercase relative group">
                  Logout
                  <span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span>
                </button>
              </>
            ) : (
              <>
                <Link 
                  href="/"
                  onClick={() => setActivePanel && setActivePanel(null)}
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
                  type="button"
                  onClick={() => handleNavClick && handleNavClick('student')}
                  className={`text-white px-3 py-2 text-sm tracking-wide uppercase relative group ${
                    isActive && isActive('student') ? 'text-blue-200' : ''
                  }`}
                >
                  STUDENT LOGIN
                  <span className={`absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out ${
                    isActive && isActive('student') ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}></span>
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick && handleNavClick('clerk')}
                  className={`text-white px-3 py-2 text-sm tracking-wide uppercase relative group ${
                    isActive && isActive('clerk') ? 'text-blue-200' : ''
                  }`}
                >
                  CLERK LOGIN
                  <span className={`absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out ${
                    isActive && isActive('clerk') ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}></span>
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick && handleNavClick('admin')}
                  className={`text-white px-3 py-2 text-sm tracking-wide uppercase relative group ${
                    isActive && isActive('admin') ? 'text-blue-200' : ''
                  }`}
                >
                  SUPER ADMIN
                  <span className={`absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out ${
                    isActive && isActive('admin') ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}></span>
                </button>
              </>
            )}
          </div>
          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white hover:text-blue-200 focus:outline-none p-2 transition-transform duration-300 ease-in-out"
              aria-label="Toggle menu"
            >
              <svg className={`h-6 w-6 transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'rotate-90' : 'rotate-0'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {/* Mobile Menu */}
      <div 
        className={`md:hidden bg-[#0a2d66] overflow-hidden transition-all duration-300 ease-in-out ${
          mobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pt-2 pb-3 space-y-1">
          {clerkMode ? (
            clerkMinimal ? (
              <>
                <Link href="/clerk/admission/dashboard" className="text-white block px-3 py-2.5 text-sm relative group">Dashboard<span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span></Link>
                <button onClick={async () => {
                  await fetch('/api/clerk/logout', { method: 'POST' });
                  router.replace('/');
                  setMobileMenuOpen(false);
                }} className="text-white block w-full text-left px-3 py-2.5 text-sm relative group">Logout<span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span></button>
              </>
            ) : (
              <>
                <Link href="#" className="text-white block px-3 py-2.5 text-sm relative group">Departments<span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span></Link>
                <Link href="#" className="text-white block px-3 py-2.5 text-sm relative group">Admissions<span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span></Link>
                <Link href="#" className="text-white block px-3 py-2.5 text-sm relative group">Time Tables<span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span></Link>
                <Link href="#" className="text-white block px-3 py-2.5 text-sm relative group">Faculties<span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span></Link>
                <button onClick={async () => {
                  await fetch('/api/clerk/logout', { method: 'POST' });
                  router.replace('/');
                  setMobileMenuOpen(false);
                }} className="text-white block w-full text-left px-3 py-2.5 text-sm relative group">Logout<span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span></button>
              </>
            )
          ) : studentProfileMode ? (
            <>
              <button onClick={() => { setActiveTab('basic'); setMobileMenuOpen(false); }} className="text-white block w-full text-left px-3 py-2.5 text-sm">Basic</button>
              <button onClick={() => { setActiveTab('scholarship'); setMobileMenuOpen(false); }} className="text-white block w-full text-left px-3 py-2.5 text-sm">Scholarship</button>
              <button onClick={() => { setActiveTab('fees'); setMobileMenuOpen(false); }} className="text-white block w-full text-left px-3 py-2.5 text-sm">Fees</button>
              <button onClick={() => { setActiveTab('academics'); setMobileMenuOpen(false); }} className="text-white block w-full text-left px-3 py-2.5 text-sm">Academics</button>
              <button onClick={() => { onLogout(); setMobileMenuOpen(false); }} className="text-white block w-full text-left px-3 py-2.5 text-sm">Logout</button>
            </>
          ) : (
            <>
              <Link href="/" onClick={() => { setActivePanel(null); setMobileMenuOpen(false); }} className="text-white block px-3 py-2.5 text-sm">HOME</Link>
              <button type="button" onClick={() => { handleNavClick('student'); setMobileMenuOpen(false); }} className={`text-white block w-full text-left px-3 py-2.5 text-sm ${isActive('student') ? 'text-blue-200' : ''}`}>STUDENT LOGIN</button>
              <button type="button" onClick={() => { handleNavClick('clerk'); setMobileMenuOpen(false); }} className={`text-white block w-full text-left px-3 py-2.5 text-sm ${isActive('clerk') ? 'text-blue-200' : ''}`}>CLERK LOGIN</button>
              <button type="button" onClick={() => { handleNavClick('admin'); setMobileMenuOpen(false); }} className={`text-white block w-full text-left px-3 py-2.5 text-sm ${isActive('admin') ? 'text-blue-200' : ''}`}>SUPER ADMIN</button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
