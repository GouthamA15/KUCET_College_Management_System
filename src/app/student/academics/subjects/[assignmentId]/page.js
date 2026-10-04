"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, BookOpen, User, XCircle, Info, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SubjectDetailPage({ params }) {
  const router = useRouter();
  const { assignmentId } = React.use(params);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });

    async function fetchSubjectDetail() {
      try {
        const res = await fetch(`/api/student/academics/subjects/${assignmentId}`);
        const json = await res.json();
        
        if (!res.ok) {
          throw new Error(json.error || 'Failed to fetch subject details');
        }
        
        setData(json.data);
      } catch (err) {
        setError(err.message);
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchSubjectDetail();
  }, [assignmentId]);

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
        <div className="animate-pulse">
          <div className="h-6 w-24 bg-gray-200 rounded mb-6"></div>
          <div className="h-8 w-1/3 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 w-1/4 bg-gray-200 rounded mb-8"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full max-w-6xl mx-auto text-center mt-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mb-4">
          <XCircle size={32} />
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Subject Not Found</h2>
        <p className="text-gray-500 mb-6">{error || 'Unable to load the requested subject information.'}</p>
        <button 
          onClick={() => router.back()}
          className="px-6 py-2 bg-[#0b3578] text-white rounded-md font-medium hover:bg-blue-900 transition-colors cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm pb-12">
      {/* Header Area aligned with KUCET style */}
      <header className="mb-4">
        <button 
          onClick={() => router.push('/student/academics')}
          className="mb-3 inline-flex items-center text-sm font-medium text-gray-500 hover:text-[#0b3578] transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} className="mr-1.5" />
          Back to Academics
        </button>
        
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-gray-800">{data.subject_name}</h1>
        </div>
        <div className="text-sm text-gray-600 mt-1 flex flex-wrap items-center gap-2">
          <span className="font-medium">{data.subject_code}</span>
          <span className="text-gray-300">•</span>
          <span>{data.faculty_name || 'Faculty Not Assigned'}</span>
          <span className="text-gray-300">•</span>
          <span>Sem {data.semester} ({data.academic_year})</span>
        </div>
      </header>

      {/* Attendance Summary */}
      <section className="border border-gray-200 rounded-md bg-white overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Attendance Overview</h2>
            <p className="text-xs text-gray-500 mt-0.5">Based on conducted sessions for this subject</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-left md:text-right">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Overall Percentage</div>
              <div className={`text-2xl font-bold ${data.attendance.percentage >= 75 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {data.attendance.percentage}%
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-4 divide-x divide-gray-200 border-t border-gray-100 bg-white">
          <div className="p-3 sm:p-4 text-center flex flex-col items-center justify-center">
            <div className="text-lg sm:text-2xl font-semibold text-gray-800">{data.attendance.classesHeld}</div>
            <div className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-500 mt-1 whitespace-nowrap">Class Held</div>
          </div>
          <div className="p-3 sm:p-4 text-center flex flex-col items-center justify-center">
            <div className="text-lg sm:text-2xl font-semibold text-emerald-600">{data.attendance.present}</div>
            <div className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-500 mt-1 whitespace-nowrap">Present</div>
          </div>
          <div className="p-3 sm:p-4 text-center flex flex-col items-center justify-center">
            <div className="text-lg sm:text-2xl font-semibold text-rose-600">{data.attendance.absent}</div>
            <div className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-500 mt-1 whitespace-nowrap">Absent</div>
          </div>
          <div className="p-3 sm:p-4 text-center flex flex-col items-center justify-center">
            <div className="text-lg sm:text-2xl font-semibold text-blue-600">{data.attendance.ncc}</div>
            <div className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-500 mt-1 whitespace-nowrap">NCC</div>
          </div>
        </div>
      </section>

      {/* Class Timeline */}
      <section>
        <div className="flex justify-between items-end mb-3 mt-8">
          <div>
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Clock size={16} className="text-gray-500" />
              Class Timeline
            </h2>
          </div>
        </div>

        {data.timeline.length === 0 ? (
          <div className="border border-gray-200 rounded-md bg-white p-8 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 text-[#0b3578] mb-3">
              <Info size={20} />
            </div>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">No attendance sessions recorded</h3>
            <p className="text-xs text-gray-500">
              No classes have been conducted or recorded for this subject yet.
            </p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-md bg-white overflow-hidden shadow-sm">
            <div className="divide-y divide-gray-100">
              {data.timeline.map((session, idx) => {
                let statusBadge = "bg-gray-100 text-gray-600 border-gray-200";
                let StatusIcon = Info;
                
                if (session.status === 'PRESENT') {
                  statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
                } else if (session.status === 'ABSENT') {
                  statusBadge = "bg-rose-50 text-rose-700 border-rose-200";
                } else if (session.status === 'NCC') {
                  statusBadge = "bg-blue-50 text-blue-700 border-blue-200";
                }
                
                const dateObj = new Date(session.date);
                const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

                return (
                  <div key={`${session.date}-${session.sessionNumber}-${idx}`} className="p-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                      <div className="hidden sm:flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-md w-12 h-12 shrink-0">
                        <span className="text-[9px] font-bold text-gray-400 uppercase">Sess</span>
                        <span className="text-base font-bold text-gray-700">{session.sessionNumber}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] sm:text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5 flex-wrap">
                          <Calendar size={12} className="shrink-0" />
                          <span>{formattedDate}</span>
                          <span className="sm:hidden text-gray-300">•</span>
                          <span className="sm:hidden text-gray-500 font-medium">Session {session.sessionNumber}</span>
                        </div>
                        <div className="text-sm font-medium text-gray-800 break-words leading-snug pr-2">
                          {session.topic || <span className="text-gray-400 italic font-normal">Topic not recorded</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className={`shrink-0 text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 rounded border tracking-wide flex items-center justify-center whitespace-nowrap ${statusBadge}`}>
                      {session.status}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
