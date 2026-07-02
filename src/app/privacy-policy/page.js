import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | KUCET',
  description: 'Privacy Policy and Data Handling procedures for KUCET College Management System',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-neutral-900 rounded-xl shadow-2xl border border-neutral-800 p-4 sm:p-8 sm:p-12">
        <div className="mb-8 border-b border-neutral-800 pb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-sm text-neutral-400">Last Updated: June 25, 2026</p>
        </div>

        <div className="prose prose-invert max-w-none">
          <p className="text-neutral-300 leading-relaxed mb-6">
            Kakatiya University College of Engineering and Technology (&quot;KUCET&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our College Management System portal.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">1. Information We Collect</h2>
          <p className="text-neutral-300 leading-relaxed mb-4">
            We collect the following types of Personal Identifiable Information (PII) to provide academic and administrative services:
          </p>
          <ul className="list-disc pl-6 text-neutral-300 mb-6 space-y-2">
            <li><strong>Identity Data:</strong> Name, Date of Birth, Gender, Aadhaar Number, and Identification Marks.</li>
            <li><strong>Contact Data:</strong> Mobile Number, Email Address, and Physical Addresses (Current & Permanent).</li>
            <li><strong>Academic Data:</strong> Previous qualifications, Exam Ranks, SSC/Inter Marks, Attendance records, and Internal Marks.</li>
            <li><strong>Technical Data:</strong> IP Address, Browser User-Agent, Device Fingerprints, and GPS Location (exclusively for Proxy-Free Attendance verification).</li>
            <li><strong>Financial Data:</strong> Fee payment histories, UTR references, and Scholarship application details.</li>
          </ul>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">2. How We Use Your Information</h2>
          <p className="text-neutral-300 leading-relaxed mb-4">
            We use the collected information for the following institutional purposes:
          </p>
          <ul className="list-disc pl-6 text-neutral-300 mb-6 space-y-2">
            <li>To process your admission and maintain your academic registry.</li>
            <li>To verify your identity and prevent fraudulent activities (e.g., proxy attendance).</li>
            <li>To process scholarship applications with the respective government bodies.</li>
            <li>To issue verifiable digital certificates (Bonafide, TC, etc.).</li>
            <li>To communicate important academic announcements and security notifications.</li>
          </ul>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">3. Data Protection and Security</h2>
          <p className="text-neutral-300 leading-relaxed mb-6">
            We implement state-of-the-art security measures to protect your PII. Highly sensitive data such as your <strong>Aadhaar Number and Mobile Number are encrypted using AES-256-GCM</strong> before being stored in our database. We use secure SHA-256 hashing for data indexing and verification. We do not store your passwords in plain text; they are secured using bcrypt hashing. All data transmission occurs over encrypted HTTPS/TLS channels.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">4. Location Data (GPS)</h2>
          <p className="text-neutral-300 leading-relaxed mb-6">
            Our Proxy-Free Attendance System requires access to your device&apos;s GPS location. This data is <strong>only collected at the exact moment you mark your attendance</strong>. We do not track your location continuously in the background. Your location is verified against the college premises coordinates, and only the attendance status is stored permanently.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">5. Data Sharing and Disclosure</h2>
          <p className="text-neutral-300 leading-relaxed mb-6">
            We <strong>do not sell, trade, or rent</strong> your personal information to third parties. Your data is only shared with authorized university staff (HODs, Clerks, Principal) on a strictly need-to-know basis. We may disclose your information to government entities for statutory compliance, scholarship disbursements, or if required by law.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">6. Cookies and Local Storage</h2>
          <p className="text-neutral-300 leading-relaxed mb-6">
            We use HTTP-only cookies to maintain secure authenticated sessions. We also use Local Storage and IndexedDB to provide offline-first capabilities and draft saving features. These are essential for the operation of the portal.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">7. Contact Us</h2>
          <p className="text-neutral-300 leading-relaxed mb-6">
            If you have questions or concerns regarding this Privacy Policy or your data, please contact the college administration office or the IT Support Helpdesk.
          </p>
        </div>

        <div className="mt-10 pt-6 border-t border-neutral-800 text-center">
          <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors font-medium">
            &larr; Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
