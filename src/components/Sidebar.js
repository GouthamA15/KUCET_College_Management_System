'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NAV_MENU_CONFIG } from './Navbar';
import { Home, User, Book, Calendar, FileText, Settings, LogOut, Plus, Wallet, ChevronDown } from 'lucide-react';

const ICON_MAP = {
  'HOME': Home,
  'PROFILE': User,
  'ACADEMICS': Book,
  'FINANCES': Wallet,
  'TIME TABLE': Calendar,
  'REQUESTS': FileText,
  'DASHBOARD': Home,
  'DEPARTMENTS': FileText,
  'FACULTIES': User,
  'MENU': Settings,
};

export default function Sidebar({ role = 'student', isMobileOpen = false, setIsMobileOpen = () => {}, onLogout }) {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState({});
  const [desktopExpanded, setDesktopExpanded] = useState({});

  const menu = NAV_MENU_CONFIG[role] || NAV_MENU_CONFIG['student'] || [];

  // Estimate expanded width based on the longest visible label
  const computeMaxLabelLength = () => {
    let maxLen = 0;

    const register = (label) => {
      if (!label) return;
      const len = String(label).length;
      if (len > maxLen) maxLen = len;
    };

    menu.forEach((item) => {
      let baseLabel = item.label || '';
      if (role === 'student' && item.label === 'HOME') baseLabel = 'DASHBOARD';
      if (role === 'student' && item.label === 'MENU') baseLabel = 'SETTINGS';
      register(baseLabel);

      if (Array.isArray(item.children)) {
        item.children.forEach((child) => register(child.label));
      }
    });

    register('Logout');
    return maxLen || 0;
  };

  const maxLabelLength = computeMaxLabelLength();
  const estimatedLabelWidth = maxLabelLength * 7.5; // px estimate per character for 13px uppercase
  const BASE_EXPANDED_WIDTH = 208; // ~13rem, previous fixed w-52
  const TEXT_AREA_BASE = 144; // approximate space available for text at base width
  const extraWidth = Math.max(0, estimatedLabelWidth - TEXT_AREA_BASE);
  const expandedWidthPx = Math.min(260, BASE_EXPANDED_WIDTH + extraWidth);

  const isActiveRoute = (route) => {
    if (!route || !pathname) return false;
    // Root routes must match exactly to avoid over-highlighting
    if (route === '/') return pathname === '/';
    if (route === '/student') return pathname === '/student';
    return pathname.startsWith(route);
  };

  const performAction = async (action) => {
    if (!action) return;
    if (action === 'logout') {
      // Allow parent to override logout behaviour
      if (role === 'student' && typeof onLogout === 'function') {
        try { await onLogout(); return; } catch (e) {}
      }
      try {
        const endpoint = role === 'student' ? '/api/student/logout' : (role && String(role).startsWith('clerk') ? '/api/clerk/logout' : '/api/auth/logout');
        await fetch(endpoint, { method: 'POST' });
      } catch (e) {}
      try { localStorage.removeItem('logged_in_student'); } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
      window.location.replace('/');
      return;
    }
    if (action === 'change-password') {
      if (role === 'student') { router.push('/student/settings/security'); return; }
      if (role && String(role).startsWith('clerk')) { router.push('/clerk/settings/security'); return; }
      router.push('/settings/security');
    }
  };

  // Desktop rail
  const headerVar = 'var(--site-header-height, 72px)';
  const [hasOverflow, setHasOverflow] = useState(false);
  const [atScrollBottom, setAtScrollBottom] = useState(false);
  const desktopScrollRef = useRef(null);

  useEffect(() => {
    const el = desktopScrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const has = el.scrollHeight > el.clientHeight + 1;
      setHasOverflow(has);
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      setAtScrollBottom(atBottom);
    };

    handleScroll();
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [menu.length, expanded]);

  const DesktopNav = (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        top: `${headerVar}`,
        height: `calc(100vh - ${headerVar} - 140px)`,
        left: 0,
        width: expanded ? `${expandedWidthPx}px` : '4rem',
        transition: 'width 250ms ease'
      }}
      className="hidden lg:flex fixed left-0 z-40 bg-[#0A3D91] backdrop-blur-md border border-[#0a2f6b]/70 rounded-r-2xl overflow-hidden"
      aria-hidden={false}
    >
      <div className="flex flex-col h-full text-slate-100">
        <div
          ref={desktopScrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 pr-2 relative scrollbar-hide"
        >
          <div
            className={`px-2 pb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300 transition-opacity ${
              expanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            Overview
          </div>

          <nav className="space-y-1.5 pr-1">
        {menu.map((item, idx) => {
          const Icon = ICON_MAP[item.label] || FileText;
          const isStudentDashboard = role === 'student' && item.label === 'HOME';
          const isStudentSettings = role === 'student' && item.label === 'MENU';
          const displayLabel = isStudentDashboard ? 'DASHBOARD' : (isStudentSettings ? 'SETTINGS' : item.label);
          const selfActive = item.route && isActiveRoute(item.route);
          const childActive = Array.isArray(item.children) && item.children.some(c => c.route && isActiveRoute(c.route));
          const active = !!(selfActive || childActive);

          // fixed icon column to avoid any horizontal shift
          const IconBlock = (
            <div
              className="flex-shrink-0 flex items-center"
              style={{ width: 36, minWidth: 36 }}
            >
              <div
                className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
                  active ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-200 group-hover:bg-white/20 group-hover:text-white'
                }`}
              >
                <Icon size={16} />
              </div>
            </div>
          );

          const LabelBlock = (
            <div
              className={`ml-1 truncate text-[13px] font-semibold leading-tight tracking-tight transform transition-all duration-200 ${
                expanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'
              } ${active ? 'text-white' : 'text-slate-200'} group-hover:text-white`}
            >
              {displayLabel}
            </div>
          );

          // Parent with children: show parent row; children expand only when arrow button/row is clicked
          if (item.children) {
            const open = !!desktopExpanded[idx];
            return (
              <div key={idx}>
                <button
                  type="button"
                  onClick={() => setDesktopExpanded(prev => ({ ...prev, [idx]: !prev[idx] }))}
                  className={`group w-full flex items-center gap-3 py-2 rounded-xl ${
                    expanded ? 'justify-between px-2' : 'justify-center px-0'
                  } ${
                    open || active ? 'bg-white/10' : 'hover:bg-white/5'
                  } transition-colors`}
                >
                  <div className="flex items-center gap-1.5">
                    {IconBlock}
                    {LabelBlock}
                  </div>
                  {expanded && (
                    <div
                      className="flex-shrink-0 flex items-center"
                      style={{ width: 36, minWidth: 36 }}
                    >
                      <div
                        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors transform transition-transform duration-200 ${
                          open ? 'rotate-90' : 'rotate-0'
                        } ${
                          open || active
                            ? 'bg-white/20 text-white'
                            : 'bg-white/10 text-slate-200 group-hover:bg-white/20 group-hover:text-white'
                        }`}
                      >
                        <ChevronDown size={16} />
                      </div>
                    </div>
                  )}
                </button>
                {expanded && open && (
                  <div className="ml-9 mt-1.5 space-y-1 border-l border-white/10 pl-3">
                    {item.children.map((c, ci) => {
                      const childIsActive = c.route && isActiveRoute(c.route);
                      if (c.action) {
                        return (
                          <button
                            key={ci}
                            onClick={() => performAction(c.action)}
                            className={`w-full text-left px-2 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
                              childIsActive ? 'bg-white/10 text-white' : 'text-slate-200 hover:bg-white/5'
                            }`}
                          >
                            {c.label}
                          </button>
                        );
                      }
                      if (c.route) {
                        return (
                          <Link
                            key={ci}
                            href={c.route}
                            className={`block px-2 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
                              childIsActive ? 'bg-white/10 text-white' : 'text-slate-200 hover:bg-white/5'
                            }`}
                          >
                            {c.label}
                          </Link>
                        );
                      }
                      return (
                        <div key={ci} className="px-2 py-1.5 text-[12px] text-slate-400">
                          {c.label}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Action items (direct)
          if (item.action) {
            return (
              <button key={idx} onClick={() => performAction(item.action)} className="group w-full p-0 rounded-md">
                <div
                  className={`flex items-center gap-2 px-2 py-2 rounded-xl transition-colors ${
                    active ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  {IconBlock}
                  {LabelBlock}
                </div>
              </button>
            );
          }

          // Normal route link
          return (
            <Link key={idx} href={item.route || '#'} className="group block p-0 rounded-md">
              <div
                className={`flex items-center gap-2 px-2 py-2 rounded-xl transition-colors ${
                  active ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                  {IconBlock}
                  {LabelBlock}
                </div>
            </Link>
          );
        })}
          </nav>

          {!expanded && hasOverflow && (
            <div
              className={`pointer-events-none sticky bottom-1 flex justify-center transition-opacity duration-200 ${
                atScrollBottom ? 'opacity-0' : 'opacity-80'
              }`}
            >
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-white">
                <ChevronDown size={14} />
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  const LogoutButton = (
    <div
      style={{
        bottom: '20px',
        left: 0,
        width: '4rem',
        transition: 'width 250ms ease'
      }}
      className="hidden lg:flex fixed z-40 items-center justify-center"
    >
      <button
        type="button"
        onClick={() => performAction('logout')}
        className="group flex-shrink-0 w-14 h-14 flex items-center justify-center bg-red-400 rounded-full hover:bg-red-500 transition-colors relative"
      >
        <LogOut size={24} className="text-white" />
        <div className="absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-700 text-white text-sm font-semibold px-3 py-1 rounded whitespace-nowrap pointer-events-none">
          Log out
        </div>
      </button>
    </div>
  );

  const MobileNav = (
    <aside
      className={`lg:hidden fixed left-0 z-50 transform ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300`}
      style={{ top: 0, height: '100vh' }}
    >
      <div className="w-72 h-full bg-white border-r border-slate-200">
        <div className="p-4 flex items-center justify-between">
          <div className="text-lg font-bold">Menu</div>
          <button onClick={() => setIsMobileOpen(false)} className="p-2">
            ✕
          </button>
        </div>
        <nav className="px-2 py-2">
          {menu.map((item, idx) => {
            const Icon = ICON_MAP[item.label] || FileText;
            const selfActive = item.route && isActiveRoute(item.route);
            const childActive = Array.isArray(item.children) && item.children.some(c => c.route && isActiveRoute(c.route));
            const active = !!(selfActive || childActive);

            if (item.children) {
              const open = !!mobileExpanded[idx];
              return (
                <div key={idx} className="my-1">
                  <button
                    onClick={() => setMobileExpanded(prev => ({ ...prev, [idx]: !prev[idx] }))}
                    className={`w-full flex items-center gap-3 p-2 rounded-md ${active ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                  >
                    <Icon size={18} />
                    <div className="text-sm text-slate-700 flex-1 text-left">{item.label}</div>
                    <svg className={`w-4 h-4 transform transition-transform ${open ? 'rotate-90' : 'rotate-0'}`} viewBox="0 0 20 20" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 4l8 6-8 6" /></svg>
                  </button>
                  <div className={`pl-8 overflow-hidden transition-all ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'} `}>
                    {item.children.map((c, ci) => {
                      const childIsActive = c.route && isActiveRoute(c.route);
                      if (c.action) {
                        return (
                          <button
                            key={ci}
                            onClick={() => { setIsMobileOpen(false); performAction(c.action); }}
                            className={`w-full text-left block px-2 py-2 rounded-md text-sm transition-colors ${childIsActive ? 'bg-blue-50 text-[#0b3578] font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                          >
                            {c.label}
                          </button>
                        );
                      }
                      if (c.route) {
                        return (
                          <Link
                            key={ci}
                            href={c.route}
                            onClick={() => setIsMobileOpen(false)}
                            className={`block px-2 py-2 rounded-md text-sm transition-colors ${childIsActive ? 'bg-blue-50 text-[#0b3578] font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                          >
                            {c.label}
                          </Link>
                        );
                      }
                      return (
                        <div key={ci} className="px-2 py-2 text-sm text-slate-600">
                          {c.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (item.action) {
              return (
                <button key={idx} onClick={() => { setIsMobileOpen(false); performAction(item.action); }} className={`w-full my-1 p-2 rounded-md text-left ${active ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    <Icon size={18} />
                    <div className="text-sm text-slate-700">{item.label}</div>
                  </div>
                </button>
              );
            }

            return (
              <Link key={idx} href={item.route || '#'} onClick={() => setIsMobileOpen(false)} className={`block my-1 p-2 rounded-md ${active ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  <Icon size={18} />
                  <div className="text-sm text-slate-700">{item.label}</div>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );

  return (
    <>
      {DesktopNav}
      {LogoutButton}
      {MobileNav}
    </>
  );
}
