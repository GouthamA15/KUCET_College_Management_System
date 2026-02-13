'use client';

import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
// No client-side routing for auth; server handles redirects

import ComingSoon from '@/components/ComingSoon';

export default function TimetablePage() {

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <Navbar 
        studentProfileMode={true} 
        isSubPage={true}
        activeTab="timetable"
        onLogout={async () => {
          await fetch('/api/student/logout', { method: 'POST' });
          window.location.replace('/');
        }}
      />
      
      <main className="flex-1 flex items-center justify-center p-6">
        <ComingSoon title="Time Table" icon="📅" description="Your class schedule is not yet available. Please check back later." />
      </main>

      <Footer />
    </div>
  );
}
