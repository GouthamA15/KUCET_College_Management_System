'use client';

import { useState, useEffect } from 'react';
import { StudentProvider } from '@/context/StudentContext';
import { ProfileActivityProvider } from '@/context/ProfileActivityContext';
import StudentActivityBar from '@/components/student/StudentActivityBar';
import Sidebar from '@/components/Sidebar';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import MobileTopbar from '@/components/MobileTopbar';
// import StudentTopBar from '@/components/student/StudentTopBar';
import { usePathname, useRouter } from 'next/navigation';
import { useStudent } from '@/context/StudentContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { StudentDashboardSkeleton } from '@/components/ui/DashboardSkeleton';
import { getPortalTitle } from '@/lib/path-utils';
import { MOBILE_NAV_MODE } from '@/lib/college-config';

function ActivationGuard({ children }) {
  const { studentData, loading } = useStudent();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && studentData?.student) {
      const isVerified = studentData.student.is_email_verified;
      const isPasswordSet = !!studentData.student.password_hash;
      const isSecurityPage = pathname === '/student/settings/security';
      
      if ((!isVerified || !isPasswordSet) && !isSecurityPage) {
        router.replace('/student/settings/security');
      }
    }
  }, [studentData, loading, pathname, router]);

  if (loading && !studentData) {
    if (pathname === '/student') {
      return (
        <div className="flex-1 flex flex-col min-h-0">
          <StudentDashboardSkeleton />
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <LoadingSpinner label="Authenticating Session" />
      </div>
    );
  }

  return children;
}

export default function StudentLayout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const resolvedTitle = getPortalTitle(pathname);

  useEffect(() => {
    document.title = 'Student Dashboard';
  }, [pathname]);

  return (
    <StudentProvider>
      <ProfileActivityProvider>
        <div className="min-h-screen flex flex-col font-sans">
          <div className="flex-1 flex">
          
          {/* Sidebar */}
          {MOBILE_NAV_MODE === 'sidebar' ? (
            <Sidebar 
              role="student" 
              isMobileOpen={isMobileMenuOpen} 
              setIsMobileOpen={setIsMobileMenuOpen} 
            />
          ) : (
            <div className="hidden lg:block">
              <Sidebar 
                role="student" 
                isMobileOpen={isMobileMenuOpen} 
                setIsMobileOpen={setIsMobileMenuOpen} 
              />
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-h-0 relative lg:ml-(--desktop-sidebar-offset,64px) transition-[margin-left] duration-220 ease-[cubic-bezier(0.2,0.8,0.2,1)]">

            {/* Mobile Navigation */}
            <div className="lg:hidden sticky top-0 z-30 shadow-sm">
              {MOBILE_NAV_MODE === 'sidebar' ? (
                <MobileTopbar onMenuClick={() => setIsMobileMenuOpen(true)} title={resolvedTitle} />
              ) : (
                <Navbar role="student" brandLabel={resolvedTitle} />
              )}
            </div>

            {/* Content Wrapper */}
            <div className="flex-1 flex flex-col min-h-0 relative overflow-x-hidden">
              {/* Global header only on desktop */}
              <div className="hidden lg:block">
                <Header />
              </div>

              {/* Desktop-only Student Top Bar for notifications - Commented out per request
              <div className="hidden lg:block">
                <StudentTopBar />
              </div>
              */}

              {/* Content stack (single, consistent top spacing below header/topbar) */}
              <div className="flex-1 flex flex-col min-h-0 pt-(--app-content-top-gap,20px) lg:pt-(--app-fixed-header-offset,72px) ">
                <ActivationGuard>
                  {/* Activity Bar */}
                  <div className="px-4 lg:px-8">
                    <StudentActivityBar />
                  </div>

                  {/* Page Content */}
                  <main className="flex-1 p-4 lg:p-8 pt-0">
                    {children}
                  </main>
                </ActivationGuard>
              </div>
            </div>
          </div>

          {/* Mobile Overlay for Sidebar Mode */}
          {MOBILE_NAV_MODE === 'sidebar' && (
            <div 
              className={`fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-40 lg:hidden transition-opacity duration-300 ${
                isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}
          </div>

          <Footer />
        </div>
      </ProfileActivityProvider>
    </StudentProvider>
  );
}

