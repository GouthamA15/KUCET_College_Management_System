'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Check, X, Calendar, User, BookOpen, ShieldAlert } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/DashboardSkeleton';
import { useStaff } from '@/context/StaffContext';

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export default function HodFacultyInterests() {
  const { staffData } = useStaff();
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(null);
  const [showConflictModal, setShowConflictModal] = useState(null);
  const [filter, setFilter] = useState('PENDING'); // PENDING, APPROVED, REJECTED, ALL

  const fetchInterests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/staff/hod/faculty-interests');
      if (res.ok) {
        const data = await res.json();
        setInterests(data.data || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load faculty interests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch('/api/staff/hod/faculty-interests');
        if (res.ok) {
          const data = await res.json();
          if (!ignore) setInterests(data.data || []);
        }
      } catch (e) {
        console.error(e);
        toast.error('Failed to load faculty interests');
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  const handleAction = async (interestId, action, reason = '', overrideConflict = false, overrideReason = '') => {
    setProcessingId(interestId);
    try {
      const res = await fetch('/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: interestId,
          status: action,
          rejection_reason: reason,
          override_conflict: overrideConflict,
          override_reason: overrideReason
        })
      });
      const data = await res.json();
      
      if (res.status === 409 && data.canOverride) {
        setShowConflictModal({
          interestId,
          conflicts: data.conflicts || [],
          overrideReason: ''
        });
        return;
      }

      if (res.ok) {
        toast.success(data.message || `Request ${action.toLowerCase()} successfully`);
        if (action === 'REJECTED') {
          setShowRejectModal(null);
          setRejectReason('');
        }
        setShowConflictModal(null);
        fetchInterests();
      } else {
        toast.error(data.error || data.message || `Unable to ${action.toLowerCase()} request.`);
      }
    } catch (_e) {
      toast.error('Unable to connect to the server. Please check your internet connection and try again.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <TableSkeleton />;
  }

  const filteredInterests = filter === 'ALL' 
    ? interests 
    : interests.filter(i => i.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Faculty Subject Interests & Self-Allocations</h2>
          <p className="text-sm text-gray-500">Review teaching preference requests and self-allocate departmental courses.</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-lg self-stretch sm:self-auto overflow-x-auto custom-scrollbar">
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-all ${filter === f ? 'bg-white text-[#0b3578] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {filteredInterests.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInterests.map((interest) => {
            const isOwn = Number(interest.staff_account_id) === Number(staffData?.id);
            return (
              <div key={interest.id} className="bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 border border-blue-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 relative flex flex-col group">
                <div className="flex justify-between items-start mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${
                      interest.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      interest.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' :
                      'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {interest.status}
                    </span>
                    {isOwn && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm bg-sky-100 text-sky-800 border border-sky-300">
                        Self-Request
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                    <Calendar size={10} />
                    {formatDate(interest.created_at)}
                  </span>
                </div>
                
                <div className="flex-grow">
                  <h3 className="font-bold text-gray-900 text-base mb-1 leading-tight group-hover:text-[#0b3578] transition-colors">{interest.subject_code}</h3>
                  <p className="text-xs text-gray-600 line-clamp-2 mb-2 h-8" title={interest.subject_name}>{interest.subject_name}</p>
                  
                  <div className="space-y-1.5 py-2 border-t border-gray-100 text-xs">
                    <div className="flex items-start gap-1.5 text-gray-700">
                      <User size={13} className="text-gray-400 mt-0.5 shrink-0" />
                      <div className="leading-tight">
                        <span className="font-medium">{interest.faculty_name} {isOwn && '(You)'}</span>
                        <div className="text-[10px] text-gray-400 mt-0.5">{interest.employee_id}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <BookOpen size={13} className="text-gray-400 shrink-0" />
                      <span>{interest.branch} <span className="text-gray-300 mx-1">•</span> Sem {interest.semester} <span className="text-gray-300 mx-1">•</span> {interest.academic_year}</span>
                    </div>
                  </div>
                </div>

                {interest.status === 'PENDING' && (
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-gray-100">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleAction(interest.id, 'APPROVED'); }}
                      disabled={processingId === interest.id}
                      className="flex justify-center items-center gap-1.5 py-1.5 bg-[#0b3578] text-white border border-transparent rounded-md hover:bg-[#0a2d66] shadow-sm text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Check size={14} /> {isOwn ? 'Self-Allocate' : 'Approve'}
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowRejectModal(interest); }}
                      disabled={processingId === interest.id}
                      className="flex justify-center items-center gap-1.5 py-1.5 bg-white text-red-700 border border-red-300 rounded-md hover:bg-red-50 shadow-sm text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-gray-50 p-8 border border-dashed border-gray-300 text-center rounded-xl">
          <p className="text-gray-500 font-medium">No {filter !== 'ALL' ? filter.toLowerCase() : ''} requests found.</p>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full animate-slideUp">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Reject Request</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting the request for <strong className="text-gray-800">{showRejectModal.subject_code}</strong> by <strong className="text-gray-800">{showRejectModal.faculty_name}</strong>.
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none resize-none"
              rows={3}
              placeholder="Enter rejection reason..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRejectModal(null);
                  setRejectReason('');
                }}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
                disabled={processingId === showRejectModal.id}
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(showRejectModal.id, 'REJECTED', rejectReason)}
                disabled={!rejectReason.trim() || processingId === showRejectModal.id}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {processingId === showRejectModal.id ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Override Modal */}
      {showConflictModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-2 text-amber-700">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Allocation Conflict Detected</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              An instructional or timetable conflict was detected for this approval. As an authorized officer, provide an override reason to proceed.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 space-y-1">
              <div className="font-bold">Conflicts:</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {showConflictModal.conflicts.map((c, i) => (
                  <li key={i}>{c.message}</li>
                ))}
              </ul>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Override Reason (min 5 characters)
              </label>
              <textarea
                rows={3}
                required
                value={showConflictModal.overrideReason}
                onChange={(e) => setShowConflictModal(prev => ({ ...prev, overrideReason: e.target.value }))}
                placeholder="e.g. Co-teaching approved by HOD..."
                className="w-full text-xs border border-slate-300 rounded p-2.5 focus:border-[#0b3578] outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConflictModal(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingId === showConflictModal.interestId || !showConflictModal.overrideReason.trim() || showConflictModal.overrideReason.trim().length < 5}
                onClick={() => handleAction(showConflictModal.interestId, 'APPROVED', '', true, showConflictModal.overrideReason.trim())}
                className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                {processingId === showConflictModal.interestId ? 'Applying Override...' : 'Confirm Conflict Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
