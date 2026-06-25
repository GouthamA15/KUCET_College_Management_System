import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Terms & Conditions | KUCET',
  description: 'Terms and Conditions of Use for KUCET College Management System',
};

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-neutral-900 rounded-xl shadow-2xl border border-neutral-800 p-8 sm:p-12">
        <div className="mb-8 border-b border-neutral-800 pb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Terms & Conditions</h1>
          <p className="text-sm text-neutral-400">Last Updated: June 25, 2026</p>
        </div>

        <div className="prose prose-invert max-w-none">
          <p className="text-neutral-300 leading-relaxed mb-6">
            Welcome to the KUCET College Management System. By accessing or using this digital portal, you agree to comply with and be bound by the following Terms and Conditions of use.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">1. Acceptance of Terms</h2>
          <p className="text-neutral-300 leading-relaxed mb-6">
            By creating an account, logging in, or accessing any services provided by the KUCET portal, you confirm that you have read, understood, and agreed to these terms. If you do not agree with these terms, you must not use this system.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">2. Acceptable Use and Conduct</h2>
          <p className="text-neutral-300 leading-relaxed mb-4">
            You agree to use this platform strictly for academic and institutional purposes. You are strictly prohibited from:
          </p>
          <ul className="list-disc pl-6 text-neutral-300 mb-6 space-y-2">
            <li>Attempting to gain unauthorized access to the system, other users&apos; accounts, or institutional data.</li>
            <li>Uploading malicious files, scripts, or engaging in any &quot;script-kiddie&quot; or hacking behavior.</li>
            <li>Providing false, misleading, or fraudulent information during admission, fee payments, or certificate requests.</li>
            <li>Sharing your login credentials or OTPs with any third party.</li>
          </ul>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">3. Academic Integrity & Attendance</h2>
          <p className="text-neutral-300 leading-relaxed mb-6">
            The Proxy-Free Attendance System is designed to ensure fair and accurate academic tracking. Any attempt to bypass, spoof, or manipulate GPS locations, IP addresses, or device fingerprints to mark fake attendance constitutes serious academic misconduct. Such actions will result in disciplinary proceedings by the college administration.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">4. Financial Transactions</h2>
          <p className="text-neutral-300 leading-relaxed mb-6">
            All online fee payments recorded in this portal are subject to manual institutional verification. Providing fake UTR numbers or forged payment screenshots is a punishable offense. KUCET reserves the right to reject payments and hold certificates or results if fraudulent financial activity is detected. The institution utilizes cryptographic fingerprinting to detect duplicate payment submissions.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">5. Account Suspension</h2>
          <p className="text-neutral-300 leading-relaxed mb-6">
            KUCET administration reserves the right to suspend, revoke, or terminate your access to the portal at any time, without prior notice, if you are found violating these Terms and Conditions or engaging in activities detrimental to the institution.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">6. Limitation of Liability</h2>
          <p className="text-neutral-300 leading-relaxed mb-6">
            While we strive to ensure 100% uptime and accuracy, KUCET shall not be held liable for any direct or indirect damages, data loss, or academic delays resulting from system downtime, network failures, or user errors.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8 mb-4">7. Amendments</h2>
          <p className="text-neutral-300 leading-relaxed mb-6">
            KUCET reserves the right to update or modify these Terms and Conditions at any time. Significant changes will be communicated via the portal dashboard or registered email.
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
