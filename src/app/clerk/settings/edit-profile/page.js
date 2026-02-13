'use client';

import { useClerk } from '@/context/ClerkContext';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/components/Footer';

export default function ClerkEditProfilePage() {
  const { clerkData, loading } = useClerk();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <Navbar clerkMode={true} onLogout={async () => { await fetch('/api/clerk/logout', { method: 'POST' }); location.href = '/'; }} />
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
            <h1 className="text-2xl font-bold mb-4">Edit Profile</h1>
            <p className="text-gray-600">This feature is coming soon.</p>
            <p className="mt-2 text-sm text-gray-500 font-mono">Role: {clerkData?.role}</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
