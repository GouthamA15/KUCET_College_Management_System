'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, CheckCircle, ArrowLeft, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentReactivationPage() {
  const [form, setForm] = useState({ roll_no: '', email: '', reason: '' });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.roll_no || !form.email || !form.reason) {
      toast.error('Please fill in all required fields.');
      return;
    }

    if (form.reason.trim().length < 10) {
      toast.error('Please provide a detailed explanation (minimum 10 characters).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/student/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roll_no: form.roll_no.trim().toUpperCase(),
          email: form.email.trim().toLowerCase(),
          reason: form.reason.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit reactivation request');
      }

      setSubmitted(true);
      toast.success('Reactivation request submitted successfully');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <Link 
            href="/"
            className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-[#0b3578] mb-4 transition-colors"
          >
            <ArrowLeft size={14} className="mr-1" />
            Back to Home
          </Link>

          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-700 mb-2">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Account Reactivation</h2>
          <p className="mt-1 text-xs text-gray-500 max-w-sm mx-auto">
            Submit a formal request to restore portal access after prolonged attendance inactivity.
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 shadow-sm border border-gray-200 sm:rounded-lg sm:px-10">
          {submitted ? (
            <div className="text-center py-6 space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mb-2">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Request Submitted Successfully</h3>
              <p className="text-xs text-gray-600 leading-relaxed max-w-sm mx-auto">
                Your reactivation request has been queued for review. In accordance with institutional policy, reactivation requires endorsement from your <strong>Department HOD</strong> followed by final clearance from the <strong>College Administration</strong>.
              </p>
              <div className="pt-4">
                <Link
                  href="/"
                  className="inline-block px-5 py-2 text-xs font-semibold text-white bg-[#0b3578] hover:bg-blue-900 rounded transition-colors"
                >
                  Return to Portal Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="bg-blue-50/70 border border-blue-200/60 rounded p-3 text-[11px] text-blue-900 leading-relaxed">
                <strong>Two-Stage Clearance Policy:</strong> Accounts deactivated for attendance inactivity require initial verification by the student&apos;s Branch HOD and final approval by the Principal before credentials are re-enabled.
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Student Roll Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 21567T0901"
                  value={form.roll_no}
                  onChange={(e) => setForm(prev => ({ ...prev, roll_no: e.target.value.toUpperCase() }))}
                  className="w-full p-2.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Registered Institutional Email *</label>
                <input
                  type="email"
                  required
                  placeholder="student@kakatiya.ac.in"
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full p-2.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Reason for Extended Absence & Reactivation Request *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide legitimate rationale for your absence (e.g. medical treatment, personal circumstance, academic deferral) and reason for resuming classes..."
                  value={form.reason}
                  onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full p-2.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded text-xs font-semibold text-white bg-[#0b3578] hover:bg-blue-900 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    'Submitting Request...'
                  ) : (
                    <>
                      <Send size={14} />
                      Submit Reactivation Request
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
