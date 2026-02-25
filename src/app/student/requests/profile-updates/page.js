'use client';

import { useEffect, useState } from 'react';
import { useStudent } from '@/context/StudentContext';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/components/Footer';
import Image from 'next/image';
import Link from 'next/link';

export default function ProfileUpdatesPage() {
  const { studentData, loading: contextLoading } = useStudent();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (studentData) {
      fetchRequests();
    }
  }, [studentData]);

  async function fetchRequests() {
    try {
      const res = await fetch('/api/student/requests/profile');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.data || []);
      } else {
        setError('Failed to fetch requests');
      }
    } catch (err) {
      console.error('Failed to fetch profile updates:', err);
      setError('An error occurred while fetching your requests.');
    } finally {
      setLoading(false);
    }
  }

  if (contextLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <Navbar studentProfileMode={true} activeTab={'requests'} />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-10 w-10 border-4 border-[#0b3578] border-t-transparent rounded-full"></div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <Navbar studentProfileMode={true} activeTab={'requests'} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profile Update History</h1>
            <p className="text-gray-500 mt-1">Track the status of your signature and profile photo change requests.</p>
          </div>
          <Link 
            href="/student/settings/edit-profile"
            className="bg-[#0b3578] text-white px-6 py-2.5 rounded-lg font-bold hover:bg-[#0a2d66] transition-all shadow-md active:scale-95"
          >
            New Request
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6 flex items-center gap-3">
            <span>⚠️</span> {error}
          </div>
        )}

        {requests.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-16 text-center">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-bold text-gray-800">No requests found</h3>
            <p className="text-gray-500 mt-2 max-w-sm mx-auto">
              You haven't submitted any requests for profile photo or signature updates yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {requests.map((req) => (
              <div key={req.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-gray-500">Request #{req.id}</span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      req.status === 'pending' ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' :
                      req.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                      'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 font-medium">
                    Submitted on {new Date(req.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Proposed Signature */}
                  {req.new_signature && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Proposed Signature</h4>
                      <div className="w-full h-32 bg-gray-50 rounded-xl border border-dashed border-gray-300 flex items-center justify-center p-4">
                        <Image 
                          src={req.new_signature} 
                          alt="Proposed Signature" 
                          width={200} 
                          height={100} 
                          className="object-contain max-h-full"
                          unoptimized
                        />
                      </div>
                    </div>
                  )}

                  {/* Proposed Photo */}
                  {req.new_pfp && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Proposed Photo</h4>
                      <div className="w-32 h-32 bg-gray-50 rounded-xl border border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                        <Image 
                          src={req.new_pfp} 
                          alt="Proposed Photo" 
                          width={128} 
                          height={128} 
                          className="object-cover w-full h-full"
                          unoptimized
                        />
                      </div>
                    </div>
                  )}

                  {req.status === 'rejected' && (
                    <div className="md:col-span-2 bg-red-50 border border-red-100 rounded-xl p-4 flex gap-4">
                      <span className="text-2xl text-red-400">❌</span>
                      <div>
                        <h5 className="text-sm font-bold text-red-800 mb-1">Rejection Reason</h5>
                        <p className="text-sm text-red-700 leading-relaxed">
                          {req.rejection_reason || 'No specific reason provided by the clerk.'}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {req.status === 'approved' && (
                    <div className="md:col-span-2 bg-green-50 border border-green-100 rounded-xl p-4 flex gap-4">
                      <span className="text-2xl text-green-400">✅</span>
                      <div>
                        <h5 className="text-sm font-bold text-green-800 mb-1">Approved</h5>
                        <p className="text-sm text-green-700 leading-relaxed">
                          Your update was successfully verified and applied on {new Date(req.updated_at).toLocaleString()}.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
