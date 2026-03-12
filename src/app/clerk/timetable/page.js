'use client';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/components/Footer';
import ComingSoon from '@/components/ComingSoon';
import { useClerk } from '@/context/ClerkContext';

export default function ClerkTimetablePage() {
  const { clerkData: clerk } = useClerk();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <Navbar role={clerk?.role === 'faculty' ? 'faculty' : clerk?.role || 'clerk'} />
      <main className="flex-1 flex items-center justify-center p-6">
        <ComingSoon title="Time Table" icon="📅" />
      </main>
      <Footer />
    </div>
  );
}
