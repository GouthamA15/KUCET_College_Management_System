'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminNavbar() {
  const router = useRouter();

  const handleLogout = () => {
    // Clear admin JWT/localStorage and redirect to home
    localStorage.removeItem('admin_jwt');
    localStorage.removeItem('admin_authenticated');
    document.cookie = 'admin_auth=; Max-Age=0; path=/;';
    router.push('/');
  };

  return (
    <nav className="bg-[#0b3578] shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          <div className="flex-shrink-0">
            <span className="text-white text-lg font-bold tracking-wide">ADMIN PANEL</span>
          </div>
          <div className="flex items-center space-x-6">
            <Link href="/admin/dashboard" className="text-white px-3 py-2 text-sm tracking-wide uppercase relative group">
              Dashboard
              <span className="absolute left-0 -bottom-1 w-full h-0.5 bg-white scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
            </Link>
            <Link href="/admin/clerks" className="text-white px-3 py-2 text-sm tracking-wide uppercase relative group">
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
        </div>
      </div>
    </nav>
  );
}
