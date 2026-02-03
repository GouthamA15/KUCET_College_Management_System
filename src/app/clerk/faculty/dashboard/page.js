'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/app/components/Footer/Footer';
import toast from 'react-hot-toast';

export default function FacultyDashboard() {
  const [clerk, setClerk] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const fetchClerkData = async () => {
      try {
        const res = await fetch('/api/clerk/me');
        const data = await res.json();
        if (res.ok) {
          if (data.role !== 'faculty') {
            toast.error('Access Denied');
            router.push('/');
          } else {
            setClerk(data);
          }
        } else {
          toast.error(data.error || 'Failed to fetch clerk data.');
          router.push('/');
        }
      } catch (error) {
        toast.error('An unexpected error occurred while fetching clerk data.');
        console.error('Error fetching clerk data:', error);
        router.push('/');
      }
    };
    fetchClerkData();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <Navbar clerkMode={true} />
      <main className="flex-1 p-4 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">Faculty Dashboard</h1>
        {clerk ? (
          <div>
            <p className="text-lg">Welcome, {clerk.name}!</p>
          </div>
        ) : (
          <p>Loading...</p>
        )}
      </main>
      <Footer />
    </div>
  );
}
