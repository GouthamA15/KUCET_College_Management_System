'use client';

import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ClassTimetable from '@/components/student/ClassTimetable';

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
      
      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        <ClassTimetable />
      </main>

      <Footer />
    </div>
  );
}
