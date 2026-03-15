// src/app/student/requests/profile-updates/page.js
'use client';

import { useEffect, useState } from 'react';
import { useStudent } from '@/context/StudentContext';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Image from 'next/image';
import Link from 'next/link';

const FallbackImage = ({ src, alt, width, height, className, type = 'photo' }) => {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-50 text-slate-400 border border-dashed border-slate-200 ${className}`}>
        <span className="text-xl mb-1">{type === 'photo' ? '👤' : '🖋️'}</span>
        <span className="text-[9px] font-black uppercase tracking-widest opacity-60">No Record</span>
      </div>
    );
  }

  return (
    <Image 
      src={src} 
      alt={alt} 
      width={width} 
      height={height} 
      className={className}
      unoptimized
      onError={() => setError(true)}
    />
  );
};

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
        setError('Failed to fetch request audit log');
      }
    } catch (err) {
      console.error('Failed to fetch profile updates:', err);
      setError('Communication error with central records system.');
    } finally {
      setLoading(false);
    }
  }

  if (contextLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
        <Header />
        <Navbar role={'student'} activeTab={'requests'} />
        <main className="flex-1 flex flex-col items-center justify-center p-12">
          <div className="w-10 h-10 border-4 border-[#0b3578] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-500 font-bold uppercase tracking-widest text-[10px]">Retrieving Audit Logs...</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      <Header />
      <Navbar role={'student'} activeTab={'requests'} />

      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8">
        
        {/* Unified History Container */}
        <div className="bg-white border border-slate-300 shadow-md rounded-sm overflow-hidden">
          
          {/* Formal Header */}
          <div className="bg-[#0b3578] px-6 py-4 border-b border-blue-900 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white uppercase tracking-tight">Profile Modification Audit Log</h1>
              <p className="text-blue-100 text-[11px] mt-1">Official History of Record Update Applications</p>
            </div>
            <Link 
              href="/student/settings/edit-profile"
              className="bg-white text-[#0b3578] px-6 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all border border-blue-200 shadow-sm"
            >
              Initiate New Request
            </Link>
          </div>

          <div className="p-6 md:p-8">
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-sm mb-8 text-[11px] font-bold uppercase tracking-wide flex items-center gap-3">
                <span>⚠️ SYSTEM ERROR:</span> {error}
              </div>
            )}

            {requests.length === 0 ? (
              <div className="border border-slate-200 bg-slate-50 p-16 text-center rounded-sm">
                <span className="text-4xl opacity-20 block mb-4">📋</span>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">No Modification Records Found</h3>
                <p className="text-slate-500 mt-2 text-[11px] max-w-sm mx-auto font-medium">
                  Your profile modification history is currently empty. All future update requests will be logged here for audit purposes.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {requests.map((req) => (
                  <div key={req.id} className="border border-slate-200 rounded-sm overflow-hidden bg-white hover:border-slate-400 transition-all">
                    
                    {/* Log Entry Header */}
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Application ID: #{req.id}</span>
                        <span className={`px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          req.status === 'pending' ? 'bg-blue-900/10 text-blue-700 border-blue-200 animate-pulse' :
                          req.status === 'approved' ? 'bg-emerald-900/10 text-emerald-700 border-emerald-200' :
                          'bg-rose-900/10 text-rose-700 border-rose-200'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                        Timestamp: {new Date(req.created_at).toLocaleString().toUpperCase()}
                      </span>
                    </div>

                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        
                        {/* Modified Signature */}
                        {req.new_signature && (
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Proposed Digital Signature</h4>
                            <div className="w-full h-24 bg-slate-50 border border-slate-200 flex items-center justify-center p-2">
                              <FallbackImage 
                                src={req.new_signature} 
                                alt="Proposed Signature" 
                                width={200} 
                                height={80} 
                                className="object-contain max-h-full"
                                type="sig"
                              />
                            </div>
                          </div>
                        )}

                        {/* Modified Photo */}
                        {req.new_pfp && (
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Proposed Identification Photo</h4>
                            <div className="w-32 h-32 bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden">
                              <FallbackImage 
                                src={req.new_pfp} 
                                alt="Proposed Photo" 
                                width={128} 
                                height={128} 
                                className="object-cover w-full h-full"
                                type="photo"
                              />
                            </div>
                          </div>
                        )}

                        {/* Audit Details */}
                        <div className="lg:col-span-1 space-y-4">
                           {req.status === 'rejected' && (
                            <div className="bg-rose-50 border border-rose-100 p-4">
                              <h5 className="text-[10px] font-black text-rose-800 uppercase tracking-widest mb-2">Rejection Memo</h5>
                              <p className="text-[11px] text-rose-700 leading-relaxed italic">
                                &quot;{req.rejection_reason || 'No specific administrative feedback provided.'}&quot;
                              </p>
                            </div>
                          )}
                          
                          {req.status === 'approved' && (
                            <div className="bg-emerald-50 border border-emerald-100 p-4">
                              <h5 className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-2">Verification Notice</h5>
                              <p className="text-[11px] text-emerald-700 leading-relaxed font-medium">
                                This modification request was successfully verified and implemented by the records office on {new Date(req.updated_at).toLocaleDateString()}.
                              </p>
                            </div>
                          )}

                          {req.status === 'pending' && (
                            <div className="bg-blue-50 border border-blue-100 p-4">
                              <h5 className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-2">Processing Status</h5>
                              <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                                Your application is currently in the verification queue. Please check back later for administrative updates.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
