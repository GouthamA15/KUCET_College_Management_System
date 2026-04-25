'use client';

import { useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NAV_MENU_CONFIG } from '@/lib/menu-config';
import { ClerkContext } from '@/context/ClerkContext';
import { StudentContext } from '@/context/StudentContext';

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

function normalizeRole({ roleProp, clerkData }) {
  let effectiveRole = roleProp || 'guest';

  // Compatibility alias: some callers may use "admin" while the menu config uses "superAdmin"
  if (effectiveRole === 'admin') effectiveRole = 'superAdmin';

  // Keep backward-compatible role names
  if (effectiveRole === 'admission') effectiveRole = 'clerkAdmission';
  if (effectiveRole === 'scholarship') effectiveRole = 'clerkScholarship';

  // If a clerk is logged in, refine based on stored clerk role
  if (effectiveRole === 'clerk' && clerkData?.role) {
    if (clerkData.role === 'admission') effectiveRole = 'clerkAdmission';
    else if (clerkData.role === 'scholarship') effectiveRole = 'clerkScholarship';
    else if (clerkData.role === 'faculty') effectiveRole = 'faculty';
  }

  return effectiveRole;
}

function buildMenuItems({ effectiveRole, studentData }) {
  const menuItemsRaw = NAV_MENU_CONFIG[effectiveRole] || NAV_MENU_CONFIG['guest'] || [
    { label: 'ADMISSION', route: '/admission' },
    { label: 'STUDENT LOGIN', action: 'open-panel-student' },
    { label: 'STAFF LOGIN', action: 'open-panel-clerk' },
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

function isActiveRoute({ pathname, route, exact }) {
  if (!pathname || !route) return false;
  if (exact) return pathname === route;
  return pathname.startsWith(route);
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
    if (effectiveRole === 'student') {
      if (typeof onLogout === 'function') {
        try {
          await onLogout();
          return;
        } catch (e) {
          // fall through to student logout endpoint
        }
      }

      try {
        await fetch('/api/student/logout', { method: 'POST' });
      } catch (e) {
        // ignore network errors; still clear client state
      }
      try {
        localStorage.removeItem('logged_in_student');
      } catch {}
      try {
        sessionStorage.clear();
      } catch {}
      window.location.replace('/');
      return;
    }

    if (
      effectiveRole === 'clerk' ||
      effectiveRole === 'clerkAdmission' ||
      effectiveRole === 'clerkScholarship' ||
      effectiveRole === 'faculty'
    ) {
      await fetch('/api/clerk/logout', { method: 'POST' });
      window.location.replace('/');
      return;
    }

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    window.location.replace('/');
    return;
  }

  if (action === 'change-password') {
    if (effectiveRole === 'student') {
      router.push('/student/settings/security');
      return;
    }
    if (String(effectiveRole).startsWith('clerk')) {
      router.push('/clerk/settings/security');
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

export default function Sidebar({
  role: roleProp = 'student',
  isMobileOpen = false,
  setIsMobileOpen = () => {},
  onLogout,
  // Optional: support guest home "open-panel-*" actions if a caller provides them
  activePanel,
  setActivePanel,
}) {
  const pathname = usePathname();
  const router = useRouter();

  const clerkContext = useContext(ClerkContext);
  const studentContext = useContext(StudentContext);
  const clerkData = clerkContext?.clerkData;
  const studentData = studentContext?.studentData;
  const isClerkLoading = clerkContext?.loading;

  const effectiveRole = useMemo(
    () => normalizeRole({ roleProp, clerkData }),
    [roleProp, clerkData]
  );

  const menu = useMemo(() => {
    if (effectiveRole === 'clerk' && isClerkLoading) return [];
    return buildMenuItems({ effectiveRole, studentData });
  }, [effectiveRole, isClerkLoading, studentData]);

  const [expanded, setExpanded] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState({});
  const [desktopExpanded, setDesktopExpanded] = useState({});

  const DESKTOP_COLLAPSED_W = 69; // px (matches layouts using lg:ml-16)
  const DESKTOP_EXPANDED_W = 264; // px
  const DESKTOP_TOP = 'calc(var(--site-header-height, 72px) + 12px)';
  const DESKTOP_MAX_HEIGHT = 'calc(100dvh - var(--site-header-height, 72px) - 24px)';

  // Publish desktop sidebar width to the app shell so main content can "push" instead of being overlaid.
  // Desktop-only consumption happens via `lg:ml-(--desktop-sidebar-offset,64px)` in layouts.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const width = expanded ? `${DESKTOP_EXPANDED_W}px` : `${DESKTOP_COLLAPSED_W}px`;
    root.style.setProperty('--desktop-sidebar-offset', width);

    return () => {
      // Keep the layout safe if the Sidebar unmounts.
      root.style.removeProperty('--desktop-sidebar-offset');
    };
  }, [expanded]);

  const DesktopNav = (
    <aside
      className={cn(
        'hidden lg:flex fixed left-0 z-30',
        'flex-col',
        'rounded-tr-2xl rounded-br-2xl overflow-hidden',
        'border border-white/10',
        'bg-[#002a5c]',
        'shadow-sm'
      )}
      style={{
        top: DESKTOP_TOP,
        maxHeight: DESKTOP_MAX_HEIGHT,
        width: expanded ? `${DESKTOP_EXPANDED_W}px` : `${DESKTOP_COLLAPSED_W}px`,
        height: '75dvh',
        transition: 'width 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* subtle depth overlay */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-20 bg-linear-to-b from-white/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/10 to-transparent" />
      </div>

      <div
        className={cn(
          'relative flex flex-col w-full min-h-0 flex-1',
          // Expanded: add a softer glass surface over the blue base.
          // Collapsed: keep the rich base visible.
          expanded ? 'bg-white/6' : 'bg-transparent'
        )}
      >
        <div
          className={cn(
            'flex-1 min-h-0',
            'overflow-y-auto overflow-x-hidden',
            expanded ? 'scrollbar-premium' : 'scrollbar-hide',
            'px-2 py-3 pr-2.5 pb-2',
            'relative',
            expanded ? 'bg-linear-to-b from-white/10 via-white/6 to-transparent' : ''
          )}
        >
          <nav className="space-y-1">
            {menu.map((item, idx) => {
              const displayLabel = getDisplayLabel({ effectiveRole, label: item.label });
              const iconKey = pickIconKey(displayLabel);
              const Icon = Icons[iconKey] || Icons.requests;

              const exact = isDashboardLike({ label: displayLabel, route: item.route });
              const selfActive = item.route && isActiveRoute({ pathname, route: item.route, exact });
              const childActive =
                Array.isArray(item.children) &&
                item.children.some((c) => c.route && isActiveRoute({ pathname, route: c.route, exact: false }));
              const active = !!(selfActive || childActive);

              const commonRow = cn(
                'group w-full rounded-xl transition-colors',
                'h-11',
                'relative',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                // No row-wide hover fill (icon-only hover).
                active ? 'bg-white/6 ring-1 ring-white/10' : 'bg-transparent'
              );

              const iconBlock = (
                <div className="shrink-0" style={{ width: 44, minWidth: 44 }}>
                  <div
                    className={cn(
                      'h-10 w-10 rounded-xl flex items-center justify-center transition-colors',
                      active
                        ? 'bg-white/22 text-white ring-1 ring-white/25 shadow-sm'
                        : 'bg-white/10 text-white/90 ring-1 ring-white/12 group-hover:bg-white/16 group-hover:ring-white/20 group-hover:shadow-sm'
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
                    active ? 'text-white font-semibold' : 'text-white/85 font-medium'
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
                      onClick={() => setDesktopExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }))}
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
                            'bg-white/8 text-white/80 ring-1 ring-white/10',
                            open ? 'rotate-90' : 'rotate-0',
                            'transition-transform duration-200'
                          )}
                        >
                          <Icons.chevron size={18} />
                        </div>
                      </div>
                    </button>

                    {expanded && open && (
                      <div className="mt-1 ml-11 pl-3 border-l border-white/12 space-y-1">
                        {item.children.map((c, ci) => {
                          const childIsActive = c.route && isActiveRoute({ pathname, route: c.route, exact: false });
                          const childClass = cn(
                            'block w-full text-left rounded-lg px-2.5 py-2',
                            'text-[13px] font-medium transition-colors',
                            childIsActive
                              ? 'bg-white/16 text-white ring-1 ring-white/12'
                              : 'text-white/75 hover:bg-white/10 hover:text-white'
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
        <div className="border-t border-white/12 px-2 py-2">
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
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200/40',
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
                    'bg-red-500/14 text-red-100 ring-1 ring-red-200/25',
                    'group-hover:bg-red-500/18 group-hover:ring-red-200/35 group-hover:shadow-sm'
                  )}
                >
                  <Icons.logout size={20} />
                </div>
              </div>
              <div
                className={cn(
                  'text-[13px] font-semibold leading-none transition-all duration-200',
                  expanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1 pointer-events-none max-w-0',
                  'text-red-100/90'
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

  // Mobile drawer: preserve existing behavior/structure (drawer + expand/collapse for child menus)
  const MobileNav = (
    <aside
      className={cn(
        'lg:hidden fixed left-0 z-50 transform',
        isMobileOpen ? 'translate-x-0' : '-translate-x-full',
        'transition-transform duration-300'
      )}
      style={{ top: 0, height: '100vh' }}
      aria-hidden={!isMobileOpen}
    >
      <div className="w-72 h-full bg-linear-to-b from-[#f8fbff] via-white to-[#eef5ff] border-r border-slate-200">
        <div className="p-4 flex items-center justify-between">
          <div className="text-lg font-bold text-slate-800">Menu</div>
          <button onClick={() => setIsMobileOpen(false)} className="p-2 text-slate-700" aria-label="Close menu">
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <nav className="px-2 py-2">
          {menu.map((item, idx) => {
            const displayLabel = getDisplayLabel({ effectiveRole, label: item.label });
            const iconKey = pickIconKey(displayLabel);
            const Icon = Icons[iconKey] || Icons.requests;

            const exact = isDashboardLike({ label: displayLabel, route: item.route });
            const selfActive = item.route && isActiveRoute({ pathname, route: item.route, exact });
            const childActive =
              Array.isArray(item.children) &&
              item.children.some((c) => c.route && isActiveRoute({ pathname, route: c.route, exact: false }));
            const active = !!(selfActive || childActive);

            if (Array.isArray(item.children) && item.children.length > 0) {
              const open = !!mobileExpanded[idx];
              return (
                <div key={idx} className="my-1">
                  <button
                    type="button"
                    onClick={() => setMobileExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                    className={cn(
                      'w-full flex items-center gap-3 p-2 rounded-md transition-colors',
                      active ? 'bg-slate-100' : 'hover:bg-slate-50'
                    )}
                  >
                    <span className={cn('text-slate-700', active ? 'text-blue-800' : '')}>
                      <Icon size={20} />
                    </span>
                    <div className="text-sm text-slate-700 flex-1 text-left font-medium">{displayLabel}</div>
                    <span className={cn('text-slate-500 transition-transform', open ? 'rotate-90' : 'rotate-0')}>
                      <Icons.chevron size={18} />
                    </span>
                  </button>

                  <div className={cn('pl-8 overflow-hidden transition-all', open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0')}>
                    {item.children.map((c, ci) => {
                      const childIsActive = c.route && isActiveRoute({ pathname, route: c.route, exact: false });
                      const childClass = cn(
                        'w-full text-left block px-2 py-2 rounded-md text-sm transition-colors',
                        childIsActive
                          ? 'bg-blue-50 text-blue-900 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50'
                      );

                      if (c.action) {
                        return (
                          <button
                            key={ci}
                            type="button"
                            onClick={() => {
                              setIsMobileOpen(false);
                              performAction({
                                action: c.action,
                                effectiveRole,
                                onLogout,
                                router,
                                setActivePanel,
                                activePanel,
                              });
                            }}
                            className={childClass}
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
                            className={childClass}
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
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setIsMobileOpen(false);
                    performAction({
                      action: item.action,
                      effectiveRole,
                      onLogout,
                      router,
                      setActivePanel,
                      activePanel,
                    });
                  }}
                  className={cn(
                    'w-full my-1 p-2 rounded-md text-left transition-colors',
                    active ? 'bg-slate-100' : 'hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn('text-slate-700', active ? 'text-blue-800' : '')}>
                      <Icon size={20} />
                    </span>
                    <div className="text-sm text-slate-700 font-medium">{displayLabel}</div>
                  </div>
                </button>
              );
            }

            return (
              <Link
                key={idx}
                href={item.route || '#'}
                onClick={() => setIsMobileOpen(false)}
                className={cn('block my-1 p-2 rounded-md transition-colors', active ? 'bg-slate-100' : 'hover:bg-slate-50')}
              >
                <div className="flex items-center gap-3">
                  <span className={cn('text-slate-700', active ? 'text-blue-800' : '')}>
                    <Icon size={20} />
                  </span>
                  <div className="text-sm text-slate-700 font-medium">{displayLabel}</div>
                </div>
              </Link>
            );
          })}

          {/* Mobile Logout */}
          <div className="mt-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setIsMobileOpen(false);
                performAction({
                  action: 'logout',
                  effectiveRole,
                  onLogout,
                  router,
                  setActivePanel,
                  activePanel,
                });
              }}
              className="w-full p-2 rounded-md text-left hover:bg-red-50 transition-colors"
            >
              <div className="flex items-center gap-3 text-red-700">
                <Icons.logout size={20} />
                <div className="text-sm font-semibold">Logout</div>
              </div>
            </button>
          </div>
        </nav>
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
