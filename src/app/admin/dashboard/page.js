"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminDashboardPage() {
  const router = useRouter();

  // The middleware protects this route, so if we reach here, the user is authenticated.
  // No client-side auth check is strictly necessary for redirection, but keeping
  // a basic check pattern can be useful for rendering conditional UI elements.

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Super Admin Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-blue-500 hover:bg-blue-600 text-white p-5 rounded-lg shadow-lg flex flex-col items-center justify-center">
            <h2 className="text-xl font-semibold mb-2">Manage Clerks</h2>
            <p className="text-sm text-center mb-4">View, add, edit, or delete clerk accounts.</p>
            <Link href="/admin/clerks" className="bg-white text-blue-500 px-4 py-2 rounded-full font-semibold hover:bg-gray-100 transition duration-200">
              Go to Management
            </Link>
          </div>

          <div className="bg-green-500 hover:bg-green-600 text-white p-5 rounded-lg shadow-lg flex flex-col items-center justify-center">
            <h2 className="text-xl font-semibold mb-2">Create New Clerk</h2>
            <p className="text-sm text-center mb-4">Quickly add a new clerk account to the system.</p>
            <Link href="/admin/create-clerk" className="bg-white text-green-500 px-4 py-2 rounded-full font-semibold hover:bg-gray-100 transition duration-200">
              Create Clerk
            </Link>
          </div>

          {/* Add more admin functionalities here */}
        </div>
      </div>
    </div>
  );
}