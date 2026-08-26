'use client';

import React, { useContext, useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { NAV_MENU_CONFIG } from '@/lib/menu-config';
import { StaffContext } from '@/context/StaffContext';
import { StudentContext } from '@/context/StudentContext';
import { logoutByRole } from '@/lib/logout';
import { getPortalTitle } from '@/lib/path-utils';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

function SvgIcon({ size = 20, className, children, viewBox = '0 0 24 24', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

const Icons = {
  dashboard: (props) => (
    <SvgIcon {...props}>
      <path d="M4 13.5V6.8c0-.8.6-1.4 1.4-1.4h4.2c.8 0 1.4.6 1.4 1.4v6.7c0 .8-.6 1.4-1.4 1.4H5.4c-.8 0-1.4-.6-1.4-1.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13 17.2V10.5c0-.8.6-1.4 1.4-1.4h4.2c.8 0 1.4.6 1.4 1.4v6.7c0 .8-.6 1.4-1.4 1.4h-4.2c-.8 0-1.4-.6-1.4-1.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13 6.8c0-.8.6-1.4 1.4-1.4h4.2c.8 0 1.4.6 1.4 1.4v.6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M4 18.2v-.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </SvgIcon>
  ),
  profile: (props) => (
    <SvgIcon {...props}>
      <path d="M12 12.2a4.2 4.2 0 1 0-4.2-4.2 4.2 4.2 0 0 0 4.2 4.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </SvgIcon>
  ),
  academics: (props) => (
    <SvgIcon {...props}>
      <path d="M5.5 7.3c0-1 .8-1.8 1.8-1.8h10.1c1 0 1.8.8 1.8 1.8v11.1c0 1-.8 1.8-1.8 1.8H7.3c-1 0-1.8-.8-1.8-1.8V7.3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 8.7h8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 12h8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 15.3h5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </SvgIcon>
  ),
  finances: (props) => (
    <SvgIcon {...props}>
      <path d="M6.2 8.2h11.6c1 0 1.7.8 1.7 1.7v7.2c0 1-.8 1.7-1.7 1.7H6.2c-1 0-1.7-.8-1.7-1.7V9.9c0-1 .8-1.7 1.7-1.7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M16.3 12.2a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M4.5 10.4h3.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </SvgIcon>
  ),
  timetable: (props) => (
    <SvgIcon {...props}>
      <path d="M7 5.7v2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 5.7v2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.5 8.2h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.4 19.6h11.2c1 0 1.8-.8 1.8-1.8V7.5c0-1-.8-1.8-1.8-1.8H6.4c-1 0-1.8.8-1.8 1.8v10.3c0 1 .8 1.8 1.8 1.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 15.3h6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </SvgIcon>
  ),
  requests: (props) => (
    <SvgIcon {...props}>
      <path d="M7 4.8h7.7l3.3 3.3V19c0 1-.8 1.8-1.8 1.8H7c-1 0-1.8-.8-1.8-1.8V6.6c0-1 .8-1.8 1.8-1.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14.7 4.8V8c0 .8.6 1.4 1.4 1.4h2.9" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.2 12h7.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.2 15.2h5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </SvgIcon>
  ),
  settings: (props) => (
    <SvgIcon {...props}>
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M19.3 12a7.8 7.8 0 0 0-.1-1l2-1.4-2-3.4-2.3.9a7.5 7.5 0 0 0-1.7-1L15 3H9l-.2 3.1a7.5 7.5 0 0 0-1.7 1l-2.3-.9-2 3.4 2 1.4a7.8 7.8 0 0 0 0 2l-2 1.4 2 3.4 2.3-.9c.5.4 1.1.7 1.7 1L9 21h6l.2-3.1c.6-.3 1.2-.6 1.7-1l2.3.9 2-3.4-2-1.4c.1-.3.1-.7.1-1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </SvgIcon>
  ),
  logout: (props) => (
    <SvgIcon {...props}>
      <path d="M10.4 7.2V6.6c0-1 .8-1.8 1.8-1.8h5c1 0 1.8.8 1.8 1.8v10.8c0 1-.8 1.8-1.8 1.8h-5c-1 0-1.8-.8-1.8-1.8v-.6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M11.6 12H4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 9.7 4.8 12 7 14.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  ),
  sidebarToggle: (props) => (
    <SvgIcon {...props}>
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 4v16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  ),
  chevron: ({ direction = 'right', ...props }) => {
    const rotation = direction === 'down' ? 90 : direction === 'up' ? -90 : direction === 'left' ? 180 : 0;
    return (
      <SvgIcon {...props}>
        <g transform={`rotate(${rotation} 12 12)`}>
          <path d="M10 7.6 14.4 12 10 16.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </SvgIcon>
    );
  },
};

function normalizeRole({ roleProp, staffData }) {
  let effectiveRole = roleProp || 'guest';

  // Compatibility alias: some callers may use "admin" while the menu config uses "superAdmin"
  if (effectiveRole === 'admin') effectiveRole = 'superAdmin';

  if (effectiveRole === 'staff' && staffData?.role) {
    effectiveRole = staffData.role;
  }

  return effectiveRole;
}

function buildMenuItems({ effectiveRole, studentData, staffData }) {
  const menuItemsRaw = NAV_MENU_CONFIG[effectiveRole] || NAV_MENU_CONFIG['guest'] || [
    { label: 'ADMISSION', route: '/admission' },
    { label: 'STUDENT LOGIN', action: 'open-panel-student' },
    { label: 'STAFF LOGIN', action: 'open-panel-staff' },
  ];

  // Mirror Navbar.js student verification gating
  if (effectiveRole === 'student') {
    const s = studentData?.student;
    const isStudentVerified = s ? !!(s.is_email_verified && s.password_hash) : true;

    if (!isStudentVerified) {
      return [
        { label: 'HOME', route: '/student' },
        { label: 'PROFILE', route: '/student/profile' },
        {
          label: 'MENU',
          children: [{ label: 'Security & Privacy', route: '/student/settings/security' }],
        },
      ];
    }
  }

  // Add HOD Dashboard dynamically
  if (effectiveRole === 'faculty' && staffData?.is_hod) {
    const enhancedMenu = [...menuItemsRaw];
    const settingsIdx = enhancedMenu.findIndex(i => i.label === 'SETTINGS');
    const insertIdx = settingsIdx > -1 ? settingsIdx : enhancedMenu.length;

    enhancedMenu.splice(insertIdx, 0,
      { label: 'STAFF MANAGEMENT', route: '/staff/hod/staff-management' }
    );
    return enhancedMenu;
  }

  return menuItemsRaw;
}

function getDisplayLabel({ effectiveRole, label }) {
  // Keep the original menu structure; adjust only display names for student for clearer UX
  if (effectiveRole === 'student' && label === 'HOME') return 'DASHBOARD';
  if (effectiveRole === 'student' && label === 'MENU') return 'SETTINGS';
  return label;
}

function isDashboardLike({ label, route }) {
  const upper = String(label || '').toUpperCase();
  if (upper === 'HOME' || upper === 'DASHBOARD' || upper.includes('DASHBOARD')) return true;
  if (!route) return false;
  if (route === '/student') return true;
  return String(route).endsWith('/dashboard');
}

function isActiveRoute({ pathname, searchParams, route, exact }) {
  if (!pathname || !route) return false;
  
  const [routePath, routeQuery] = route.split('?');
  
  if (exact) {
    if (pathname !== routePath) return false;
  } else {
    if (!pathname.startsWith(routePath)) return false;
  }
  
  if (routeQuery && searchParams) {
    const params = new URLSearchParams(routeQuery);
    for (const [key, value] of params.entries()) {
      if (searchParams.get(key) !== value) return false;
    }
  }
  
  return true;
}

function pickIconKey(label) {
  const upper = String(label || '').toUpperCase();
  if (upper === 'DASHBOARD' || upper === 'HOME' || upper.includes('DASHBOARD')) return 'dashboard';
  if (upper === 'PROFILE') return 'profile';
  if (upper.includes('ACADEMIC') || upper === 'ACADEMICS' || upper === 'ATTENDANCE' || upper === 'MATERIALS') return 'academics';
  if (upper === 'FINANCES') return 'finances';
  if (upper.includes('TIME TABLE') || upper.includes('TIMETABLE')) return 'timetable';
  if (upper === 'REQUESTS' || upper === 'MARKS' || upper.includes('STATS') || upper.includes('DEPART')) return 'requests';
  if (upper === 'MENU' || upper === 'SETTINGS' || upper.includes('SECURITY')) return 'settings';
  return 'requests';
}

async function performAction({ action, effectiveRole, onLogout, router, setActivePanel, activePanel }) {
  if (!action) return;

  if (action === 'logout') {
    await logoutByRole({ role: effectiveRole, onLogout });
    return;
  }

  if (action === 'change-password') {
    if (effectiveRole === 'student') {
      router.push('/student/settings/security');
      return;
    }
    if (['staff', 'admission', 'scholarship', 'faculty', 'hod'].includes(effectiveRole)) {
      router.push('/staff/settings/security');
      return;
    }
    router.push('/settings/security');
    return;
  }

  if (typeof action === 'string' && action.startsWith('open-panel-')) {
    const panel = action.split('open-panel-')[1];
    if (typeof setActivePanel === 'function') {
      if (activePanel === panel) setActivePanel(null);
      else setActivePanel(panel);
      return;
    }
    router.push('/');
  }
}

function SidebarInner({
  role: roleProp = 'student',
  isMobileOpen: _isMobileOpen = false,
  setIsMobileOpen: _setIsMobileOpen = () => {},
  onLogout,
  // Optional: support guest home "open-panel-*" actions if a caller provides them
  activePanel,
  setActivePanel,
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const staffContext = useContext(StaffContext);
  const studentContext = useContext(StudentContext);
  const staffData = staffContext?.staffData;
  const studentData = studentContext?.studentData;
  const isStaffLoading = staffContext?.loading;

  const effectiveRole = useMemo(
    () => normalizeRole({ roleProp, staffData }),
    [roleProp, staffData]
  );

  const menu = useMemo(() => {
    if (effectiveRole === 'staff' && isStaffLoading) return [];
    return buildMenuItems({ effectiveRole, studentData, staffData });
  }, [effectiveRole, isStaffLoading, studentData, staffData]);

  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('kucet_sidebar_pinned');
      if (stored !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsExpanded(stored === 'true');
      }
    } catch (_e) {
      // ignore
    }
  }, []);

  const togglePin = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    try {
      localStorage.setItem('kucet_sidebar_pinned', next);
    } catch (_e) {
      // ignore
    }
  };

  const toggleSidebarByAreaClick = (event) => {
    if (!event) return;

    const target = event.target;
    if (target instanceof HTMLElement && target.closest('a, button')) {
      return;
    }

    const next = !isExpanded;
    setIsExpanded(next);
    try {
      localStorage.setItem('kucet_sidebar_pinned', String(next));
    } catch (_e) {
      // ignore
    }
  };

  const expanded = isExpanded;
  const [desktopExpanded, setDesktopExpanded] = useState({});
  const [mobileExpanded, setMobileExpanded] = useState({});

  const DESKTOP_COLLAPSED_W = 69; // px (matches layouts using lg:ml-16)
  const DESKTOP_EXPANDED_W = 264; // px

  // Publish desktop sidebar width to the app shell so main content can "push" instead of being overlaid.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const width = expanded ? `${DESKTOP_EXPANDED_W}px` : `${DESKTOP_COLLAPSED_W}px`;
    root.style.setProperty('--desktop-sidebar-offset', width);
    return () => root.style.removeProperty('--desktop-sidebar-offset');
  }, [expanded]);

  const DesktopNav = (
    <aside
      className={cn(
        'hidden lg:flex fixed left-0 z-30',
        'flex-col',
        'overflow-hidden',
        'border-r border-slate-200/70',
        'bg-linear-to-b from-blue-200/70 via-white to-blue-200/70',
        'shadow-sm backdrop-blur-md',
        !expanded && 'cursor-pointer'
      )}
      style={{
        top: 'var(--app-fixed-header-offset, 112px)',
        width: expanded ? `${DESKTOP_EXPANDED_W}px` : `${DESKTOP_COLLAPSED_W}px`,
        height: 'calc(100vh - var(--app-fixed-header-offset, 112px))',
        transition: 'width 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
      onClick={toggleSidebarByAreaClick}
    >
      {/* subtle depth overlay */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className={cn(
            'absolute inset-x-0 top-0 h-20',
            expanded
              ? 'bg-linear-to-b from-blue-300/45 via-blue-200/20 to-transparent'
              : 'bg-linear-to-b from-white/60 to-transparent'
          )}
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-blue-200/35 to-transparent" />
      </div>

      <div
        className={cn(
          'relative flex flex-col w-full min-h-0 flex-1',
          // Expanded: add a softer glass surface over the blue base.
          // Collapsed: keep the rich base visible.
          expanded ? 'bg-linear-to-b from-blue-100/45 via-white/60 to-white/35' : 'bg-transparent'
        )}
      >
        <div className={cn("flex items-center pt-3 pb-2 mb-1 border-b border-slate-200/50", expanded ? "justify-end px-3" : "justify-center")}>
            <button
              onClick={togglePin}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:shadow-sm hover:text-[#0b3578] transition-all focus:outline-none"
              title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              <Icons.sidebarToggle size={20} className={cn("transition-transform duration-200", isExpanded ? "" : "scale-x-[-1]")} />
            </button>
        </div>
        <div
          className={cn(
            'flex-1 min-h-0',
            'overflow-y-auto overflow-x-hidden',
            expanded ? 'scrollbar-premium' : 'scrollbar-hide',
            'px-2 pb-2',
            'relative',
            expanded ? 'bg-linear-to-b from-blue-100/25 via-white/20 to-transparent' : ''
          )}
        >
          <nav className="space-y-1">
            {menu.map((item, idx) => {
              const displayLabel = getDisplayLabel({ effectiveRole, label: item.label });
              const iconKey = pickIconKey(displayLabel);
              const Icon = Icons[iconKey] || Icons.requests;

              const exact = isDashboardLike({ label: displayLabel, route: item.route });
              const selfActive = item.route && isActiveRoute({ pathname, searchParams, route: item.route, exact });
              const childActive =
                Array.isArray(item.children) &&
                item.children.some((c) => c.route && isActiveRoute({ pathname, searchParams, route: c.route, exact: false }));
              const active = !!(selfActive || childActive);

              const commonRow = cn(
                'group w-full rounded-xl transition-colors',
                'h-11',
                'relative',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60',
                // No row-wide hover fill (icon-only hover).
                active ? 'bg-blue-50/80 ring-1 ring-blue-200/70' : 'bg-transparent'
              );

              const iconBlock = (
                <div className="shrink-0" style={{ width: 44, minWidth: 44 }}>
                  <div
                    className={cn(
                      'h-10 w-10 rounded-xl flex items-center justify-center transition-colors',
                      active
                        ? 'bg-blue-100 text-[#0b3578] ring-1 ring-blue-200/70 shadow-sm'
                        : 'bg-transparent text-slate-700 ring-0 shadow-none group-hover:bg-blue-50 group-hover:ring-1 group-hover:ring-blue-200/60 group-hover:shadow-sm'
                    )}
                  >
                    <Icon size={20} />
                  </div>
                </div>
              );

              const labelBlock = (
                <div
                  className={cn(
                    'text-[13px] leading-none tracking-tight truncate',
                    'transition-all duration-200',
                    expanded
                      ? 'opacity-100 translate-x-0 max-w-48'
                      : 'opacity-0 -translate-x-1 max-w-0 pointer-events-none',
                    // Keep text stable on hover; high-contrast white typography.
                    active ? 'text-[#0b3578] font-semibold' : 'text-slate-700 font-medium'
                  )}
                >
                  {displayLabel}
                </div>
              );

              if (Array.isArray(item.children) && item.children.length > 0) {
                const open = !!desktopExpanded[idx];
                return (
                  <div key={idx}>
                    <button
                      type="button"
                      className={cn(commonRow, 'flex items-center gap-2 px-1.5')}
                      onClick={() => {
                        if (!isExpanded) {
                          setIsExpanded(true);
                          try { localStorage.setItem('kucet_sidebar_pinned', 'true'); } catch (_e) { /* ignore */ }
                        }
                        setDesktopExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));
                      }}
                      aria-expanded={expanded ? open : false}
                      title={!expanded ? displayLabel : undefined}
                    >
                      {iconBlock}
                      {labelBlock}
                      <div
                        className={cn(
                          'ml-auto shrink-0',
                          'transition-all duration-200',
                          expanded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'
                        )}
                        style={{ width: 36, minWidth: 36 }}
                      >
                        <div
                          className={cn(
                            'h-9 w-9 rounded-xl flex items-center justify-center',
                            // Keep chevron subtle + stable (no hover emphasis).
                            'bg-transparent text-slate-600 ring-0 group-hover:bg-slate-50 group-hover:ring-1 group-hover:ring-slate-200',
                            open ? 'rotate-90' : 'rotate-0',
                            'transition-transform duration-200'
                          )}
                        >
                          <Icons.chevron size={18} />
                        </div>
                      </div>
                    </button>

                    {expanded && open && (
                      <div className="mt-1 ml-11 pl-3 border-l border-slate-200 space-y-1">
                        {item.children.map((c, ci) => {
                          const childIsActive = c.route && isActiveRoute({ pathname, searchParams, route: c.route, exact: false });
                          const childClass = cn(
                            'block w-full text-left rounded-lg px-2.5 py-2',
                            'text-[13px] font-medium transition-colors',
                            childIsActive
                              ? 'bg-blue-50 text-[#0b3578] ring-1 ring-blue-200/60'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                          );

                          if (c.action) {
                            return (
                              <button
                                key={ci}
                                type="button"
                                className={childClass}
                                onClick={() =>
                                  performAction({
                                    action: c.action,
                                    effectiveRole,
                                    onLogout,
                                    router,
                                    setActivePanel,
                                    activePanel,
                                  })
                                }
                              >
                                {c.label}
                              </button>
                            );
                          }

                          if (c.route) {
                            return (
                              <Link key={ci} href={c.route} className={childClass}>
                                {c.label}
                              </Link>
                            );
                          }

                          return (
                            <div key={ci} className="px-2.5 py-2 text-[13px] text-slate-400">
                              {c.label}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              if (item.action) {
                return (
                  <button
                    key={idx}
                    type="button"
                    className={cn(commonRow, 'flex items-center gap-2 px-1.5')}
                    onClick={() =>
                      performAction({
                        action: item.action,
                        effectiveRole,
                        onLogout,
                        router,
                        setActivePanel,
                        activePanel,
                      })
                    }
                    title={!expanded ? displayLabel : undefined}
                  >
                    {iconBlock}
                    {labelBlock}
                  </button>
                );
              }

              if (item.route && item.route !== '#') {
                return (
                  <Link
                    key={idx}
                    href={item.route}
                    className={cn(commonRow, 'flex items-center gap-2 px-1.5')}
                    title={!expanded ? displayLabel : undefined}
                  >
                    {iconBlock}
                    {labelBlock}
                  </Link>
                );
              }

              return (
                <button
                  key={idx}
                  type="button"
                  className={cn(commonRow, 'flex items-center gap-2 px-1.5')}
                  onClick={(e) => e.preventDefault()}
                  title={!expanded ? displayLabel : undefined}
                >
                  {iconBlock}
                  {labelBlock}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Logout (bottom, outside scroll) */}
        <div className="border-t border-slate-200/70 px-2 py-2 pb-12">
          <button
            type="button"
            onClick={() =>
              performAction({
                action: 'logout',
                effectiveRole,
                onLogout,
                router,
                setActivePanel,
                activePanel,
              })
            }
            className={cn(
              'group w-full rounded-xl transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300/40',
              // No row-wide hover fill (icon-only hover).
              'bg-transparent'
            )}
            title={!expanded ? 'Logout' : undefined}
          >
            <div className="flex items-center gap-2 px-1.5 py-1.5">
              <div className="shrink-0" style={{ width: 44, minWidth: 44 }}>
                <div
                  className={cn(
                    'h-10 w-10 rounded-xl flex items-center justify-center transition-colors',
                    'bg-transparent text-red-700 ring-0 shadow-none',
                    'group-hover:bg-red-50 group-hover:ring-1 group-hover:ring-red-200/60 group-hover:shadow-sm'
                  )}
                >
                  <Icons.logout size={20} />
                </div>
              </div>
              <div
                className={cn(
                  'text-[13px] font-semibold leading-none transition-all duration-200',
                  expanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1 pointer-events-none max-w-0',
                  'text-red-700'
                )}
              >
                Logout
              </div>
            </div>
          </button>
        </div>
      </div>
    </aside>
  );

  const MobileNav = (
    <aside
      className={cn(
        'lg:hidden fixed left-0 top-0 z-50 h-full w-[280px]',
        'bg-white/95 border-r border-slate-200/50 shadow-lg',
        'transform-gpu will-change-transform transition-transform duration-300 ease-in-out',
        _isMobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Institutional Identity Watermark */}
      <div className="absolute bottom-16 right-4 opacity-[0.02] pointer-events-none select-none z-0">
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#002A5C" strokeWidth="1.2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>

      <div className="flex flex-col h-full relative z-10">
        {/* Header Section */}
        <div className="h-16 flex items-center justify-between px-4.5 border-b border-slate-200/50 bg-gradient-to-b from-blue-50/40 via-white to-transparent">
          <div className="flex flex-col min-w-0">
            <span className="text-[#002A5C] font-black text-[13px] tracking-wide uppercase truncate">
              {effectiveRole === 'superAdmin' ? 'Admin Portal' : getPortalTitle(pathname)}
            </span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              Menu Navigation
            </span>
          </div>
          <button
            onClick={() => _setIsMobileOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {menu.map((item, idx) => {
            const displayLabel = getDisplayLabel({ effectiveRole, label: item.label });
            const iconKey = pickIconKey(displayLabel);
            const Icon = Icons[iconKey] || Icons.requests;

            const exact = isDashboardLike({ label: displayLabel, route: item.route });
            const selfActive = item.route && isActiveRoute({ pathname, searchParams, route: item.route, exact });
            const childActive =
              Array.isArray(item.children) &&
              item.children.some((c) => c.route && isActiveRoute({ pathname, searchParams, route: c.route, exact: false }));
            const active = !!(selfActive || childActive);

            const commonRow = cn(
              'group w-full rounded-xl transition-all duration-200',
              'h-10 flex items-center gap-3 px-3',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60',
              active ? 'bg-blue-50/60 ring-1 ring-blue-100/50' : 'bg-transparent hover:bg-slate-100/40'
            );

            const iconBlock = (
              <div className="shrink-0">
                <div
                  className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200',
                    active
                      ? 'bg-[#002A5C] text-white shadow-md shadow-[#002A5C]/15 ring-1 ring-[#002A5C]/10'
                      : 'bg-transparent text-slate-600 group-hover:bg-slate-100 group-hover:text-[#002A5C]'
                  )}
                >
                  <Icon size={16} />
                </div>
              </div>
            );

            const labelBlock = (
              <div
                className={cn(
                  'text-[13px] font-semibold tracking-tight transition-colors truncate',
                  active ? 'text-[#002A5C]' : 'text-slate-700 group-hover:text-[#002A5C]'
                )}
              >
                {displayLabel}
              </div>
            );

            if (Array.isArray(item.children) && item.children.length > 0) {
              const open = !!mobileExpanded[idx];
              return (
                <div key={idx} className="space-y-1">
                  <button
                    type="button"
                    className={cn(commonRow, 'justify-between')}
                    onClick={() => setMobileExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                    aria-expanded={open}
                  >
                    <div className="flex items-center gap-3">
                      {iconBlock}
                      {labelBlock}
                    </div>
                    <div
                      className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center transition-transform duration-250 ease-out',
                        open ? 'rotate-90' : 'rotate-0',
                        'text-slate-400 group-hover:text-slate-600'
                      )}
                    >
                      <Icons.chevron size={15} />
                    </div>
                  </button>

                  <div 
                    className="ml-8 mr-2 pl-3 bg-blue-50/30 border-l border-blue-200/80 rounded-r-lg space-y-0.5 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                    style={{
                      maxHeight: open ? `${item.children.length * 36 + 8}px` : '0px',
                      opacity: open ? 1 : 0,
                      paddingTop: open ? '4px' : '0px',
                      paddingBottom: open ? '4px' : '0px',
                    }}
                  >
                    {item.children.map((c, ci) => {
                      const childIsActive = c.route && isActiveRoute({ pathname, searchParams, route: c.route, exact: false });
                      const dotIcon = (
                        <svg className={cn(
                          "w-1.5 h-1.5 shrink-0 transition-all duration-200",
                          childIsActive ? "text-[#002A5C]" : "text-slate-400 group-hover:text-slate-600"
                        )} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="4" fill="currentColor" />
                        </svg>
                      );
                      
                      const childClass = cn(
                        'group w-full text-left rounded-md px-2.5 py-1.5 flex items-center gap-2.5',
                        'text-[12px] font-semibold transition-all duration-200',
                        childIsActive
                          ? 'bg-[#002A5C]/5 text-[#002A5C]'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                      );

                      if (c.action) {
                        return (
                          <button
                            key={ci}
                            type="button"
                            className={childClass}
                            onClick={() => {
                              _setIsMobileOpen(false);
                              performAction({
                                action: c.action,
                                effectiveRole,
                                onLogout,
                                router,
                                setActivePanel,
                                activePanel,
                              });
                            }}
                          >
                            {dotIcon}
                            <span>{c.label}</span>
                          </button>
                        );
                      }

                      if (c.route) {
                        return (
                          <Link
                            key={ci}
                            href={c.route}
                            onClick={() => _setIsMobileOpen(false)}
                            className={childClass}
                          >
                            {dotIcon}
                            <span>{c.label}</span>
                          </Link>
                        );
                      }

                      return (
                        <div key={ci} className="px-2.5 py-1.5 text-[12px] text-slate-400 flex items-center gap-2.5">
                          {dotIcon}
                          <span>{c.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (item.action) {
              return (
                <button
                  key={idx}
                  type="button"
                  className={commonRow}
                  onClick={() => {
                    _setIsMobileOpen(false);
                    performAction({
                      action: item.action,
                      effectiveRole,
                      onLogout,
                      router,
                      setActivePanel,
                      activePanel,
                    });
                  }}
                >
                  {iconBlock}
                  {labelBlock}
                </button>
              );
            }

            return (
              <Link
                key={idx}
                href={item.route || '#'}
                onClick={() => _setIsMobileOpen(false)}
                className={commonRow}
              >
                {iconBlock}
                {labelBlock}
              </Link>
            );
          })}
        </nav>

        {/* Logout (bottom) */}
        <div className="border-t border-slate-200/50 px-4 py-3 bg-transparent">
          <button
            type="button"
            onClick={() => {
              _setIsMobileOpen(false);
              performAction({
                action: 'logout',
                effectiveRole,
                onLogout,
                router,
                setActivePanel,
                activePanel,
              });
            }}
            className="w-full flex items-center gap-3 px-3 h-10 text-red-600 hover:text-red-700 hover:bg-red-50/60 rounded-xl font-semibold text-[13px] transition-all focus:outline-none focus:ring-2 focus:ring-red-100"
          >
            <div className="shrink-0 flex items-center justify-center h-8 w-8 text-red-500 hover:text-red-600">
              <Icons.logout size={17} />
            </div>
            <span className="tracking-wide">LOGOUT</span>
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {DesktopNav}
      {MobileNav}
    </>
  );
}

export default function Sidebar(props) {
  return (
    <Suspense fallback={<div className="w-64 bg-[#0b3578] h-full"></div>}>
      <SidebarInner {...props} />
    </Suspense>
  );
}
