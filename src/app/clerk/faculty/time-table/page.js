'use client';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/app/components/Footer/Footer';
import PersonalSchedule from '@/components/clerk/faculty/PersonalSchedule';
import { useClerk } from '@/context/ClerkContext';

export default function FacultyTimetableOverview() {
  const { clerkData: clerk } = useClerk();
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <Navbar role="faculty" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <PersonalSchedule />
      </main>
      <Footer />
    </div>
  );
}