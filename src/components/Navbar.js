'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ChangePasswordModal from './ChangePasswordModal';
export default function Navbar({ activePanel, setActivePanel, clerkMode = false, studentProfileMode = false, onLogout, clerkMinimal = false, activeTab, setActiveTab, isSubPage = false }) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState({});
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // Single source-of-truth menu configuration per role
  const menuConfig = {
    student: [
      { label: 'Profile', route: '/student/profile' },
      { label: 'Time Table', route: '/student/timetable' },
      { label: 'Requests', children: [
          { label: 'Bonafide Certificate', route: '/student/requests/bonafide' },
          { label: 'No Dues Certificate', route: '/student/requests/nodues' },
          { label: 'Other Certificates', route: '/student/requests/certificates' },
        ]
      },
      { label: 'Menu', children: [
          { label: 'Edit Profile', route: '/student/settings/edit-profile' },
          { label: 'Security & Privacy', route: '/student/settings/security' },
          { label: 'Logout', action: 'logout' }
        ]
      }
    ],
    clerk: [
      { label: 'Dashboard', route: '/clerk/admission/dashboard' },
      { label: 'Departments', route: '#' },
      { label: 'Admissions', route: '#' },
      { label: 'Time Tables', route: '#' },
      { label: 'Faculties', route: '#' },
      { label: 'Logout', action: 'logout' }
    ],
    superAdmin: [
      { label: 'Home', route: '/' },
      { label: 'Admin Dashboard', route: '/admin/dashboard' },
      { label: 'Manage Clerks', route: '/admin/manage-clerks' },
      { label: 'Student Stats', route: '/admin/student-stats' },
      { label: 'Logout', action: 'logout' }
    ]
  };

  // Determine current role: student -> 'student', clerk -> 'clerk', admin pages -> 'superAdmin', else 'guest'
  let role = 'guest';
  if (studentProfileMode) role = 'student';
  else if (clerkMode) role = 'clerk';
  else if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) role = 'superAdmin';
  const menuItems = menuConfig[role] || [
    { label: 'HOME', route: '/' },
    { label: 'STUDENT LOGIN', action: 'open-panel-student' },
    { label: 'EMPLOYEE LOGIN', action: 'open-panel-clerk' },
    { label: 'SUPER ADMIN', action: 'open-panel-admin' }
  ];

  const handleNavClick = (panel) => {
    if (activePanel === panel) {
      setActivePanel(null); // Close if clicking the same panel
    } else {
      setActivePanel(panel);
    }
    setMobileMenuOpen(false);
  };

  const isActive = (panel) => activePanel === panel;

  const performAction = async (action) => {
    if (action === 'logout') {
      // Prefer explicit onLogout handler for student role (preserve original behavior)
      if (role === 'student' && typeof onLogout === 'function') {
        try {
          await onLogout();
        } catch (e) {
          // fallback to auth logout if handler fails
          await fetch('/api/auth/logout', { method: 'POST' });
          router.replace('/');
        }
        return;
      }
      // Clerk-specific logout endpoint
      if (role === 'clerk') {
        await fetch('/api/clerk/logout', { method: 'POST' });
        router.replace('/');
        return;
      }
      // Default auth logout
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/');
    }
    if (action === 'change-password') {
      setShowChangePasswordModal(true);
    }
  };

  const handleMobileParentToggle = (idx) => {
    setMobileExpanded(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleMobileNavigate = (item) => {
    // Close menu first, then navigate or perform action
    setMobileMenuOpen(false);
    if (item.action === 'logout') {
      setTimeout(async () => {
        await performAction('logout');
      }, 260);
      return;
    }
    if (item.action === 'change-password') {
      setTimeout(() => performAction('change-password'), 260);
      return;
    }
    if (item.action && item.action.startsWith('open-panel-')) {
      const panel = item.action.split('open-panel-')[1];
      setTimeout(() => handleNavClick(panel), 260);
      return;
    }
    if (item.route) {
      setTimeout(() => router.push(item.route), 260);
    }
  };

  return (
    <>
      <nav className="bg-[#0b3578] shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-13">
            <div className="flex-shrink-0">
              <span className="text-white text-lg font-bold tracking-wide">LOGIN PORTAL</span>
            </div>
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-6">
              {menuItems.map((item, idx) => {
                const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                if (hasChildren) {
                  return (
                    <div key={idx} className="relative group">
                      <button className="text-white px-3 py-2 text-sm tracking-wide uppercase relative flex items-center cursor-pointer">
                        <span>{item.label}</span>
                        <svg className="w-4 h-4 ml-2 transform transition-transform duration-200 ease-in-out group-hover:rotate-90" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 4l8 6-8 6" />
                        </svg>
                        <span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span>
                      </button>
                      <div className="absolute left-0 top-full w-56 bg-white rounded-b-md shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform z-50">
                        {item.children.map((c, ci) => {
                          if (c.route && c.route !== '#') {
                            return (
                              <Link key={ci} href={c.route} className="block px-4 py-2 text-sm text-gray-700 hover:bg-[#0b3578] hover:text-white transition-colors">{c.label}</Link>
                            );
                          }
                          if (c.action) {
                            return (
                              <button key={ci} onClick={() => performAction(c.action)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-[#0b3578] hover:text-white transition-colors">{c.label}</button>
                            );
                          }
                          return (
                            <button key={ci} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-[#0b3578] hover:text-white transition-colors" onClick={(e) => e.preventDefault()}>{c.label}</button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                // action items
                if (item.action) {
                  if (typeof item.action === 'string' && item.action.startsWith('open-panel-')) {
                    const panelName = item.action.split('open-panel-')[1];
                    return (
                      <button key={idx} onClick={() => handleNavClick(panelName)} className={`text-white px-3 py-2 text-sm tracking-wide uppercase relative group cursor-pointer`}>
                        {item.label}
                        <span className={`absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out ${isActive(panelName) ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
                      </button>
                    );
                  }
                  return (
                    <button key={idx} onClick={() => performAction(item.action)} className="text-white px-3 py-2 text-sm tracking-wide uppercase relative group cursor-pointer">
                      {item.label}
                      <span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span>
                    </button>
                  );
                }
                // Render a real link only when a valid route exists and is not a placeholder
                if (item.route && item.route !== '#') {
                  return (
                    <Link key={idx} href={item.route} className="text-white px-3 py-2 text-sm tracking-wide uppercase relative group">
                      {item.label}
                      <span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span>
                    </Link>
                  );
                }
                // Otherwise render a non-navigating button (avoids showing '#' in status bar)
                return (
                  <button key={idx} onClick={() => {}} className={`text-white px-3 py-2 text-sm tracking-wide uppercase relative group text-left`}>
                    {item.label}
                    <span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span>
                  </button>
                );
              })}
            </div>
            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(prev => !prev)}
                className="text-white hover:text-blue-200 focus:outline-none p-2"
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <line x1="3" y1="6" x2="21" y2="6" stroke="white" strokeWidth="2"
                    className={`transition-transform duration-200 ease-in-out origin-center ${mobileMenuOpen ? 'translate-y-2 rotate-45' : ''}`}
                  />
                  <line x1="3" y1="12" x2="21" y2="12" stroke="white" strokeWidth="2"
                    className={`transition-opacity duration-200 ease-in-out ${mobileMenuOpen ? 'opacity-0' : 'opacity-100'}`}
                  />
                  <line x1="3" y1="18" x2="21" y2="18" stroke="white" strokeWidth="2"
                    className={`transition-transform duration-200 ease-in-out origin-center ${mobileMenuOpen ? '-translate-y-2 -rotate-45' : ''}`}
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
        {/* Mobile Menu */}
        <div
          className={`md:hidden bg-[#0a2d66] overflow-hidden shadow-sm ${mobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
          style={{
            transform: mobileMenuOpen ? 'translateY(0)' : 'translateY(-10px)',
            transitionProperty: 'transform, opacity, max-height',
            transitionTimingFunction: 'ease-in-out',
            transitionDuration: mobileMenuOpen ? '250ms' : '200ms',
            maxHeight: mobileMenuOpen ? '520px' : '0px'
          }}
        >
          <div className="px-4 pt-2 pb-3">
            {menuItems.map((item, idx) => {
              const hasChildren = Array.isArray(item.children) && item.children.length > 0;
              const expanded = !!mobileExpanded[idx];
              return (
                <div key={idx} className="mb-0">
                  <div className={`flex items-center justify-between w-full ${hasChildren ? 'cursor-pointer' : ''}`}>
                    {hasChildren ? (
                      <button
                        onClick={() => handleMobileParentToggle(idx)}
                        className="w-full text-left px-3 py-3 text-white text-sm flex items-center justify-between"
                        aria-expanded={expanded}
                      >
                        <span className="truncate">{item.label}</span>
                        <svg className={`w-4 h-4 ml-2 transform transition-transform duration-200 ease-in-out ${expanded ? 'rotate-90' : 'rotate-0'}`} viewBox="0 0 20 20" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 4l8 6-8 6" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMobileNavigate(item)}
                        className="w-full text-left px-3 py-3 text-white text-sm"
                      >
                        {item.label}
                      </button>
                    )}
                  </div>
                  {hasChildren && expanded && (
                    <div className="pl-4 bg-white/5">
                      {item.children.map((child, cidx) => (
                        <button
                          key={cidx}
                          onClick={() => handleMobileNavigate(child)}
                          className="w-full text-left block px-3 py-2 text-sm text-white/95"
                          style={{ transition: 'opacity 180ms ease-in-out', transitionDelay: `${(cidx + 1) * 40}ms` }}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-white/10" />
                </div>
              );
            })}
          </div>
        </div>
      </nav>
      <ChangePasswordModal 
        show={showChangePasswordModal} 
        onClose={() => setShowChangePasswordModal(false)}
        apiEndpoint={
          studentProfileMode ? '/api/auth/change-password/student' :
          clerkMode ? '/api/auth/change-password/clerk' : ''
        }
      />
    </>
  );
}
