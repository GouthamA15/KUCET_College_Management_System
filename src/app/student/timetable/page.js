'use client';

import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
// No client-side routing for auth; server handles redirects

export default function TimetablePage() {

  return (
    <div className="min-h-screen bg-gray-50">
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
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Time Table</h1>  
            <p className="mt-2 text-sm text-gray-600">Your class schedule</p>
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
          <div className="p-6">
            <p className="text-gray-500">Time table is not yet available. Please check back later.</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
