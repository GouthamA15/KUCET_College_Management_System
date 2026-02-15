'use client';

import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ComingSoon from '@/components/ComingSoon';

export default function IDCardReissuePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <Navbar 
        studentProfileMode={true} 
        isSubPage={true}
        onLogout={async () => {
          await fetch('/api/student/logout', { method: 'POST' });
          window.location.replace('/');
        }}
      />
      
      <main className="flex-1 flex items-center justify-center p-6">
        <ComingSoon 
          title="ID Card Reissue" 
          icon="🪪" 
          description="The ID Card Reissue request system is currently under development. Please visit the college office for manual requests." 
        />
      </main>

      <Footer />
    </div>
  );
}
