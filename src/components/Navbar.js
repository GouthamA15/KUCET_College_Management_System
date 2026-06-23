'use client';

import { useState, useContext } from 'react';
import { _useStudent, StudentContext } from '@/context/StudentContext';
import { _useClerk, ClerkContext } from '@/context/ClerkContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import ChangePasswordModal from './ChangePasswordModal';
import NotificationDropdown from './NotificationDropdown';
import ClerkNotificationDropdown from './clerk/ClerkNotificationDropdown';
import { NAV_MENU_CONFIG } from '@/lib/menu-config';
import { logoutByRole } from '@/lib/logout';

export default function Navbar({ activePanel, setActivePanel, role, studentProfileMode = false, onLogout, _clerkMinimal = false, _activeTab, _setActiveTab, _isSubPage = false, sticky = true, minimalNav = false, brandLabel = 'LOGIN PORTAL' }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState({ /* empty */ });
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // Use useContext directly to avoid throwing when Provider is missing (e.g. guest home)
  // Hooks must be called unconditionally at the top level
  const studentContext = useContext(StudentContext);
  const clerkContext = useContext(ClerkContext);

  const studentData = studentContext?.studentData;
  const clerkData = clerkContext?.clerkData;

  // Get student and clerk names for greeting
  let _studentName = null;
  let _clerkName = null;

  if (role === 'student' || studentProfileMode) {
    _studentName = studentData?.student?.name || studentData?.name || null;
  }
  if (role === 'clerk' || role === 'clerkAdmission' || role === 'clerkScholarship') {
    _clerkName = clerkData?.name || null;
  }
  // (menu definitions moved to top-level `NAV_MENU_CONFIG` for reuse)

  // Role selection: prefer explicit `role` prop. Fall back to studentProfileMode for backward compatibility.
  let effectiveRole = role || (studentProfileMode ? 'student' : 'guest');

  // Map specific clerk sub-roles to their distinct menu variants
  if (effectiveRole === 'admission') {
    effectiveRole = 'clerkAdmission';
  } else if (effectiveRole === 'scholarship') {
    effectiveRole = 'clerkScholarship';
  }

  // Determine if student is fully verified to control menu visibility
  let isStudentVerified = true;
  if (effectiveRole === 'student') {
    const s = studentData?.student;
    if (s) {
      isStudentVerified = !!(s.is_email_verified && s.password_hash);
    }
  }

  const menuItemsRaw = NAV_MENU_CONFIG[effectiveRole] || NAV_MENU_CONFIG['guest'] || [
    { label: 'STUDENT LOGIN', action: 'open-panel-student' },
    { label: 'STAFF LOGIN', action: 'open-panel-clerk' }
  ];

  // Filter student menu if unverified
  const menuItems = (effectiveRole === 'student' && !isStudentVerified)
    ? [
        { label: 'HOME', route: '/student' },
        { label: 'PROFILE', route: '/student/profile' },
        { label: 'MENU', children: [
            { label: 'Security & Privacy', route: '/student/settings/security' }
          ]
        }
      ]
    : menuItemsRaw;

  const handleNavClick = (panel) => {
    if (pathname !== '/' && pathname !== '/admission') {
      router.push('/');
      return;
    }
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
      await logoutByRole({ role: effectiveRole, onLogout });
      return;
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
      <nav className={`bg-[#0b3578] shadow-lg ${sticky ? 'sticky z-50' : 'relative z-20'} pt-[env(safe-area-inset-top)]`} style={sticky ? { top: 'var(--site-header-height, 72px)' } : undefined}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`flex items-center h-13 ${minimalNav ? 'justify-start' : 'justify-between'}`}>
            <div className={`flex items-center gap-4 ${minimalNav ? 'pl-2 sm:pl-4' : 'shrink-0'}`}>
              <span className="text-white text-lg font-bold tracking-wide uppercase">{brandLabel}</span>
            </div>

            {/* Desktop Menu */}
            {!minimalNav && (
            <div className="hidden md:flex items-center gap-6">
              <div className="flex items-center gap-4">
                {(menuItems || []).map((item, idx) => {
                  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                  if (hasChildren) {
                    return (
                      <div key={idx} className="relative group">
                        <button className="text-white px-3 py-2 text-sm tracking-wide uppercase relative flex items-center cursor-pointer">
                          <span>{item.label}</span>
                          <svg className="w-4 h-4 ml-2 transform transition-transform duration-200 ease-in-out group-hover:rotate-90" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 4l8 6-8 6" />
                          </svg>
                          <span className={`absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out ${
                            // underline parent if any child matches current pathname
                            (Array.isArray(item.children) && item.children.some(c => c.route && pathname && pathname.startsWith(c.route))) ? 'w-full' : 'w-0 group-hover:w-full'
                          }`}></span>
                        </button>
                        <div className="absolute left-0 top-full w-56 bg-white rounded-b-md shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform z-50">
                          {item.children.map((c, ci) => {
                              if (c.route && c.route !== '#') {
                              const childActive = pathname && pathname.startsWith(c.route);
                              return (
                                <Link key={ci} href={c.route} className={`block px-4 py-2 text-sm ${childActive ? 'text-[#0b3578] underline' : 'text-gray-700 hover:bg-[#0b3578] hover:text-white'} transition-colors`}>{c.label}</Link>
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
                    // Exact match for root route to prevent multiple highlighting
                    const routeActive = item.route === '/' 
                      ? pathname === '/' 
                      : (pathname && pathname.startsWith(item.route));

                    return (
                      <Link key={idx} href={item.route} className="text-white px-3 py-2 text-sm tracking-wide uppercase relative group">
                        {item.label}
                        <span className={`absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out ${routeActive ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
                      </Link>
                    );
                  }
                  // Otherwise render a non-navigating button (avoids showing '#' in status bar)
                  return (
                    <button key={idx} onClick={() => { /* empty */ }} className={`text-white px-3 py-2 text-sm tracking-wide uppercase relative group text-left`}>
                      {item.label}
                      <span className="absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out w-0 group-hover:w-full"></span>
                    </button>
                  );
                })}
              </div>

              {/* Functional Notification Dropdown */}
              {effectiveRole === 'student' && (
                <div className="border-l border-white/10 pl-4">
                  <NotificationDropdown />
                </div>
              )}
              {(effectiveRole === 'clerkAdmission' || effectiveRole === 'clerkScholarship') && (
                <div className="border-l border-white/10 pl-4">
                  <ClerkNotificationDropdown />
                </div>
              )}
            </div>
            )}
            {/* Mobile Menu Button (single element morphing hamburger -> X) */}
            {!minimalNav && (
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(prev => !prev)}
                className="text-white focus:outline-none p-2"
                aria-label="Toggle menu"
              >
                <span className="relative w-6 h-6 inline-block">
                  <span
                    className={`absolute left-0 top-1/2 w-6 h-0.5 bg-white transform transition duration-200 ease-in-out origin-center ${mobileMenuOpen ? 'translate-y-0 rotate-45' : '-translate-y-2'}`}
                  />
                  <span
                    className={`absolute left-0 top-1/2 w-6 h-0.5 bg-white transform transition-opacity duration-200 ease-in-out ${mobileMenuOpen ? 'opacity-0' : 'opacity-100'}`}
                  />
                  <span
                    className={`absolute left-0 top-1/2 w-6 h-0.5 bg-white transform transition duration-200 ease-in-out origin-center ${mobileMenuOpen ? 'translate-y-0 -rotate-45' : 'translate-y-2'}`}
                  />
                </span>
              </button>
            </div>
            )}
          </div>
        </div>
        {/* Mobile Menu */}
        {!minimalNav && (
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
            {(menuItems || []).map((item, idx) => {
              const hasChildren = Array.isArray(item.children) && item.children.length > 0;
              const expanded = !!mobileExpanded[idx];
              const mobileRouteActive = pathname && item.route && item.route !== '#' && (item.route === '/' ? pathname === '/' : pathname.startsWith(item.route));
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
                        className={`w-full text-left px-3 py-3 text-white text-sm ${mobileRouteActive ? 'bg-white/5 rounded' : ''}`}
                      >
                        {item.label}
                      </button>
                    )}
                  </div>
                  {/* Mobile children container: smooth ease-in expand with slight translate */}
                  {hasChildren && (
                    <div
                      className="pl-4 bg-white/5 overflow-hidden"
                      style={{
                        maxHeight: expanded ? `${item.children.length * 44}px` : '0px',
                        opacity: expanded ? 1 : 0,
                        transform: expanded ? 'translateY(0)' : 'translateY(-6px)',
                        transition: 'max-height 220ms ease-in, opacity 200ms ease-in, transform 220ms ease-in',
                        pointerEvents: expanded ? 'auto' : 'none'
                      }}
                    >
                      {(item.children || []).map((child, cidx) => {
                        const childActive = pathname && child.route && pathname.startsWith(child.route);
                        return (
                          <button
                            key={cidx}
                            onClick={() => handleMobileNavigate(child)}
                            className={`w-full text-left block px-3 py-2 text-sm ${childActive ? 'bg-white/5 rounded text-white' : 'text-white/95'}`}
                            style={{ transition: 'opacity 180ms ease-in-out', transitionDelay: `${(cidx + 1) * 40}ms` }}
                          >
                            {child.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="border-t border-white/10" />
                </div>
              );
            })}
          </div>
        </div>
        )}
      </nav>
      <ChangePasswordModal 
        show={showChangePasswordModal} 
        onClose={() => setShowChangePasswordModal(false)}
        apiEndpoint={
            effectiveRole === 'student' ? '/api/auth/change-password/student' :
            effectiveRole.startsWith('clerk') ? '/api/auth/change-password/clerk' : ''
          }
      />
    </>
  );
}
