'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Check, X, Calendar, User, BookOpen } from 'lucide-react';

export default function HodFacultyInterests() {
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(null);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInterests();
  }, []);

  const handleAction = async (interestId, action, reason = '') => {
    setProcessingId(interestId);
    try {
      const res = await fetch('/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: interestId,
          status: action,
          rejection_reason: reason
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        toast.success(`Request ${action.toLowerCase()} successfully`);
        if (action === 'REJECTED') {
          setShowRejectModal(null);
          setRejectReason('');
        }
        fetchInterests();
      } else {
        toast.error(data.error || `Failed to ${action.toLowerCase()} request`);
      }
    } catch (_e) {
      toast.error('An error occurred');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48 border border-gray-200 rounded-lg bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b3578]"></div>
      </div>
    );
  }

  const filteredInterests = filter === 'ALL' 
    ? interests 
    : interests.filter(i => i.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Faculty Subject Interests</h2>
          <p className="text-sm text-gray-500">Review teaching requests submitted by faculty.</p>
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
          {filteredInterests.map((interest) => (
            <div key={interest.id} className="bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 border border-blue-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${
                  interest.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  interest.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' :
                  'bg-red-50 text-red-700 border-red-200'
                }`}>
                  {interest.status}
                </span>
                <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                  <Calendar size={10} />
                  {new Date(interest.created_at).toLocaleDateString()}
                </span>
              </div>
              
              <div className="flex-grow">
                <h3 className="font-bold text-gray-900 text-lg mb-1 leading-tight">{interest.subject_code}</h3>
                <p className="text-sm text-gray-600 line-clamp-2 mb-3 h-10" title={interest.subject_name}>{interest.subject_name}</p>
                
                <div className="space-y-2 py-3 border-t border-gray-100 text-sm">
                  <div className="flex items-start gap-2 text-gray-700">
                    <User size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <div className="leading-tight">
                      <span className="font-medium">{interest.faculty_name}</span>
                      <div className="text-xs text-gray-400 mt-0.5">{interest.employee_id}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <BookOpen size={14} className="text-gray-400 shrink-0" />
                    <span>{interest.branch} <span className="text-gray-300 mx-1">•</span> Sem {interest.semester}</span>
                  </div>
                </div>
              </div>

              {interest.status === 'PENDING' && (
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-100">
                  <button 
                    onClick={() => handleAction(interest.id, 'APPROVED')}
                    disabled={processingId === interest.id}
                    className="flex justify-center items-center gap-1.5 py-2 bg-green-50 text-green-700 border border-green-200 rounded-md hover:bg-green-600 hover:text-white hover:border-green-600 text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <Check size={14} /> Approve
                  </button>
                  <button 
                    onClick={() => setShowRejectModal(interest)}
                    disabled={processingId === interest.id}
                    className="flex justify-center items-center gap-1.5 py-2 bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-600 hover:text-white hover:border-red-600 text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <X size={14} /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 p-8 border border-dashed border-gray-300 text-center rounded-xl">
          <p className="text-gray-500 font-medium">No {filter !== 'ALL' ? filter.toLowerCase() : ''} requests found.</p>
        </div>
      )}

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
    </div>
  );
}
