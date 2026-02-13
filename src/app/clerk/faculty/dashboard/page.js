'use client';
import { useState, useEffect } from 'react';
import { useClerk } from '@/context/ClerkContext';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/app/components/Footer/Footer';
import toast from 'react-hot-toast';

export default function FacultyDashboard() {
  const { clerkData: clerk, loading: isLoading } = useClerk();

  useEffect(() => {
    if (!isLoading && clerk && clerk.role !== 'faculty') {
      toast.error('Access Denied');
    }
  }, [clerk, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Loading faculty dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      {clerk && <Navbar clerkMode={true} />} {/* Conditionally render Navbar if clerk data is available */}
      <main className="flex-1 p-4 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">Faculty Dashboard</h1>
        {clerk ? (
          <div>
            <p className="text-lg">Welcome, {clerk.name}!</p>
          </div>
        ) : (
          <p>Unable to load clerk data.</p> // Fallback if clerk data is null after loading
        )}
      </main>
      <Footer />
    </div>
  );
}
