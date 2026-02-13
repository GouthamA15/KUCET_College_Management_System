'use client';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/components/Footer';
import ComingSoon from '@/components/ComingSoon';

export default function AdminSecurityPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <Navbar onLogout={async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.href = '/'; }} />
      <main className="flex-1 flex items-center justify-center p-6">
        <ComingSoon title="Security & Privacy" icon="🛡️" />
      </main>
      <Footer />
    </div>
  );
}
