'use client';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/components/Footer';
import ComingSoon from '@/components/ComingSoon';

export default function ClerkEditProfilePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <Navbar clerkMode={true} onLogout={async () => { await fetch('/api/clerk/logout', { method: 'POST' }); location.href = '/'; }} />
      <main className="flex-1 flex items-center justify-center p-6">
        <ComingSoon title="Edit Profile" icon="👤" />
      </main>
      <Footer />
    </div>
  );
}
