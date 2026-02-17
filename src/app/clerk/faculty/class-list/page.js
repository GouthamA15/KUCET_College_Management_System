'use client';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/app/components/Footer/Footer';
import { useClerk } from '@/context/ClerkContext';
import ClassList from '@/components/clerk/faculty/ClassList';

export default function FacultyClassListPage() {
  const { clerkData: clerk } = useClerk();
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <Navbar role="faculty" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <h1 className="text-2xl md:text-3xl font-bold mb-4">Class List</h1>
        <ClassList />
      </main>
      <Footer />
    </div>
  );
}