'use client';

import Link from 'next/link';

export default function StudentSettingsLanding() {
  return (
    <div className="w-full max-w-5xl mx-auto bg-white shadow-xl rounded-lg p-4 sm:p-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Edit Profile Card */}
        <Link href="/student/settings/edit-profile" className="group block border rounded-lg p-6 hover:shadow-md transition cursor-pointer">
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center mr-4">EP</div>
            <div>
              <div className="text-lg font-semibold">Edit Profile</div>
              <div className="text-sm text-gray-600">Update phone, address and profile photo.</div>
            </div>
          </div>
        </Link>
        {/* Security & Privacy Card */}
        <Link href="/student/settings/security" className="group block border rounded-lg p-6 hover:shadow-md transition cursor-pointer">
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center mr-4">SP</div>
            <div>
              <div className="text-lg font-semibold">Security & Privacy</div>
              <div className="text-sm text-gray-600">View password status and account security info.</div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}