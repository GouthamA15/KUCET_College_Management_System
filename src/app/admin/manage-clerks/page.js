"use client";

import Header from '@/components/Header';
import AdminNavbar from '@/components/AdminNavbar';
import Footer from '@/components/Footer';

export default function ManageClerksPage() {
  return (
    <>
      <Header />
      <AdminNavbar />
      <main className="min-h-screen bg-gray-100 flex flex-col items-center py-8">
        <div className="w-full max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-[#0b3578] mb-6">Manage Clerks</h1>
          {/* Clerk management UI will go here */}
          <div className="text-gray-600">List, activate/deactivate, and remove clerks here.</div>
        </div>
      </main>
      <Footer />
    </>
  );
}
