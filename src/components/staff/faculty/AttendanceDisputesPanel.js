'use client';

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ExternalLink, Paperclip, MessageSquare, Eye, X, Download } from 'lucide-react';
import { formatDate } from '@/lib/date';

const CATEGORY_LABELS = {
  INCORRECT_MARKING: 'Incorrect Marking',
  MEDICAL: 'Medical Leave',
  AUTHORIZED_ACTIVITY: 'Authorized Activity',
  OTHER: 'Other'
};

function DisputesTableSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded shadow-xs overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[10px]">
            <th className="p-3">Student</th>
            <th className="p-3">Subject & Branch</th>
            <th className="p-3">Session</th>
            <th className="p-3">Category & Request</th>
            <th className="p-3">Details & Evidence</th>
            <th className="p-3">Status</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {[1, 2, 3, 4, 5].map((i) => (
            <tr key={i} className="animate-pulse">
              <td className="p-3 space-y-1.5">
                <div className="h-3.5 bg-gray-200 rounded w-20"></div>
                <div className="h-2.5 bg-gray-100 rounded w-28"></div>
              </td>
              <td className="p-3 space-y-1.5">
                <div className="h-3.5 bg-gray-200 rounded w-36"></div>
                <div className="h-2.5 bg-gray-100 rounded w-24"></div>
              </td>
              <td className="p-3 space-y-1.5">
                <div className="h-3.5 bg-gray-200 rounded w-20"></div>
                <div className="h-2.5 bg-gray-100 rounded w-16"></div>
              </td>
              <td className="p-3 space-y-1.5">
                <div className="h-4 bg-indigo-100/70 rounded w-24"></div>
                <div className="h-5 bg-blue-100/70 rounded w-16"></div>
              </td>
              <td className="p-3 space-y-1.5 max-w-sm">
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                <div className="h-4 bg-gray-100 rounded w-28 mt-2"></div>
              </td>
              <td className="p-3">
                <div className="h-5 bg-amber-100/70 rounded-full w-20"></div>
              </td>
              <td className="p-3 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <div className="h-6 w-14 bg-gray-200 rounded"></div>
                  <div className="h-6 w-14 bg-gray-200 rounded"></div>
                  <div className="h-6 w-14 bg-gray-200 rounded"></div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AttendanceDisputesPanel() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [rejectingDispute, setRejectingDispute] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [requestingInfoDispute, setRequestingInfoDispute] = useState(null);
  const [infoComment, setInfoComment] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const fetchDisputes = useCallback(async () => {
    try {
      const url = statusFilter ? `/api/staff/faculty/attendance/disputes?status=${statusFilter}` : '/api/staff/faculty/attendance/disputes';
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok && json.data) {
        setDisputes(json.data);
      } else {
        toast.error(json.error || json.message || 'Unable to load attendance disputes. Please try again.');
      }
    } catch (_e) {
      toast.error('Unable to connect to the server while loading disputes. Please check your internet connection.');
    }
  }, [statusFilter]);

  const handleTabChange = (newStatus) => {
    if (newStatus === statusFilter) return;
    setLoading(true);
    setStatusFilter(newStatus);
  };

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const url = statusFilter ? `/api/staff/faculty/attendance/disputes?status=${statusFilter}` : '/api/staff/faculty/attendance/disputes';
        const res = await fetch(url);
        const json = await res.json();
        if (isMounted) {
          if (res.ok && json.data) {
            setDisputes(json.data);
          } else {
            toast.error(json.error || json.message || 'Unable to load attendance disputes. Please try again.');
          }
        }
      } catch (_e) {
        if (isMounted) toast.error('Unable to connect to the server while loading disputes. Please check your internet connection.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [statusFilter]);

  const handleApprove = async (dispute) => {
    if (!confirm(`Are you sure you want to approve this dispute for ${dispute.roll_no} (${dispute.requested_status})? Attendance will be automatically updated.`)) {
      return;
    }

    setProcessingId(dispute.id);
    try {
      const res = await fetch(`/api/staff/faculty/attendance/disputes/${dispute.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Approval failed');

      toast.success('Dispute approved and attendance corrected');
      fetchDisputes();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectingDispute) return;
    if (!rejectReason || rejectReason.trim().length === 0) {
      toast.error('Rejection reason is required');
      return;
    }

    setProcessingId(rejectingDispute.id);
    try {
      const res = await fetch(`/api/staff/faculty/attendance/disputes/${rejectingDispute.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED', rejection_reason: rejectReason.trim() })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Rejection failed');

      toast.success('Dispute rejected');
      setRejectingDispute(null);
      setRejectReason('');
      fetchDisputes();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRequestInfoSubmit = async (e) => {
    e.preventDefault();
    if (!requestingInfoDispute) return;
    if (!infoComment || infoComment.trim().length < 5) {
      toast.error('Please enter instructions for the student (minimum 5 characters)');
      return;
    }

    setProcessingId(requestingInfoDispute.id);
    try {
      const res = await fetch(`/api/staff/faculty/attendance/disputes/${requestingInfoDispute.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'MORE_INFO_REQUIRED', reviewer_comments: infoComment.trim() })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to request information');

      toast.success('Additional information requested from student');
      setRequestingInfoDispute(null);
      setInfoComment('');
      fetchDisputes();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Attendance Disputes Queue</h2>
          <p className="text-xs text-gray-500">Review student attendance correction requests, verify evidence documents, and resolve absences.</p>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-gray-100 p-1 rounded flex-wrap">
          {[
            { label: 'Pending', val: 'PENDING' },
            { label: 'Needs Info', val: 'MORE_INFO_REQUIRED' },
            { label: 'Approved', val: 'APPROVED' },
            { label: 'Rejected', val: 'REJECTED' },
            { label: 'All', val: '' }
          ].map((tab) => (
            <button
              key={tab.label}
              onClick={() => handleTabChange(tab.val)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                statusFilter === tab.val ? 'bg-white text-[#0b3578] shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Indeterminate Loading Bar */}
      {loading && (
        <div className="h-1 w-full bg-blue-100/60 overflow-hidden rounded">
          <div className="h-full bg-gradient-to-r from-[#0b3578] via-blue-500 to-indigo-600 animate-pulse w-full"></div>
        </div>
      )}

      {/* Disputes Table or Skeleton */}
      {loading ? (
        <DisputesTableSkeleton />
      ) : disputes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded p-8 text-center text-sm text-gray-500">
          No attendance disputes found {statusFilter ? `with status ${statusFilter}` : ''}.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded shadow-xs overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[10px]">
                <th className="p-3">Student</th>
                <th className="p-3">Subject & Branch</th>
                <th className="p-3">Session</th>
                <th className="p-3">Category & Request</th>
                <th className="p-3">Details & Evidence</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {disputes.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50/50 transition-colors align-top">
                  <td className="p-3">
                    <div className="font-semibold text-gray-800">{d.roll_no}</div>
                    <div className="text-gray-500 text-[11px]">{d.student_name}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-gray-800">{d.subject_name}</div>
                    <div className="text-gray-500 text-[11px]">{d.subject_code} • {d.branch} Sem {d.course_semester}</div>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <div className="font-medium text-gray-700">{formatDate(d.attendance_date)}</div>
                    <div className="text-gray-500 text-[11px]">Session {d.session}</div>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <div className="inline-block text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded mb-1">
                      {CATEGORY_LABELS[d.category] || d.category || 'Dispute'}
                    </div>
                    <div>
                      <span className="font-bold text-[#0b3578] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px]">
                        {d.requested_status}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 max-w-sm">
                    <div className="text-gray-800 font-medium leading-relaxed">{d.reason}</div>
                    
                    {d.additional_explanation && (
                      <div className="mt-1.5 bg-gray-50 border border-gray-200 p-2 rounded text-[11px] text-gray-700">
                        <strong className="text-gray-900 block text-[10px] uppercase tracking-wider mb-0.5">Student Update:</strong>
                        {d.additional_explanation}
                      </div>
                    )}

                    {/* Attachments List */}
                    {d.attachments && d.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                          <Paperclip size={11} /> Supporting Evidence ({d.attachments.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {d.attachments.map((att) => (
                            <div
                              key={att.id}
                              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded transition-colors"
                              title={`${att.file_name} (${Math.round(att.file_size / 1024)} KB)`}
                            >
                              <button
                                type="button"
                                onClick={() => setPreviewAttachment(att)}
                                className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                              >
                                <Eye size={12} className="text-blue-600 shrink-0" />
                                <span className="truncate max-w-[130px]">{att.file_name}</span>
                              </button>
                              <a
                                href={att.download_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-500 hover:text-blue-800 p-0.5 rounded cursor-pointer"
                                title="Open in new window"
                              >
                                <ExternalLink size={10} className="shrink-0" />
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {d.proof_url && (!d.attachments || d.attachments.length === 0) && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setPreviewAttachment({
                            id: 'direct-proof',
                            file_name: 'Supporting_Evidence',
                            download_url: d.proof_url,
                            mime_type: 'image/jpeg',
                            file_size: 0
                          })}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded transition-colors cursor-pointer"
                        >
                          <Eye size={12} className="text-blue-600" />
                          <span>View Evidence Document</span>
                        </button>
                      </div>
                    )}

                    {(!d.attachments || d.attachments.length === 0) && !d.proof_url && (
                      <div className="text-[11px] text-gray-400 italic mt-1.5">
                        No evidence attached
                      </div>
                    )}

                    {d.reviewer_comments && (
                      <div className="text-amber-700 bg-amber-50 border border-amber-200 p-1.5 rounded text-[11px] mt-2">
                        <strong>Reviewer note:</strong> {d.reviewer_comments}
                      </div>
                    )}

                    {d.rejection_reason && (
                      <div className="text-red-700 bg-red-50 border border-red-200 p-1.5 rounded text-[11px] mt-2">
                        <strong>Rejection:</strong> {d.rejection_reason}
                      </div>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      d.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      d.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      d.status === 'MORE_INFO_REQUIRED' ? 'bg-amber-50 text-amber-800 border-amber-300' :
                      'bg-sky-50 text-sky-700 border-sky-200'
                    }`}>
                      {d.status === 'MORE_INFO_REQUIRED' ? 'NEEDS INFO' : d.status}
                    </span>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {d.status === 'PENDING' || d.status === 'MORE_INFO_REQUIRED' ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleApprove(d)}
                          disabled={processingId === d.id}
                          className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => { setRequestingInfoDispute(d); setInfoComment(d.reviewer_comments || ''); }}
                          disabled={processingId === d.id}
                          className="px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Need Info
                        </button>
                        <button
                          onClick={() => { setRejectingDispute(d); setRejectReason(''); }}
                          disabled={processingId === d.id}
                          className="px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectingDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 border border-gray-200 animate-slideDown">
            <h3 className="text-base font-semibold text-gray-800 pb-2 border-b border-gray-100">
              Reject Attendance Dispute
            </h3>
            <p className="text-xs text-gray-500 mt-2">
              Provide a reason for rejecting the dispute for <strong>{rejectingDispute.roll_no}</strong> ({formatDate(rejectingDispute.attendance_date)}, Session {rejectingDispute.session}).
            </p>

            <form onSubmit={handleRejectSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Rejection Reason *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Absconded from lecture hall; medical certificate not authorized by college doctor."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRejectingDispute(null)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId === rejectingDispute.id}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {processingId === rejectingDispute.id ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request More Information Modal */}
      {requestingInfoDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200 animate-slideDown">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100 text-amber-600">
              <MessageSquare size={18} />
              <h3 className="text-base font-semibold text-gray-800">
                Request More Information
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Request additional details or specific supporting evidence from <strong>{requestingInfoDispute.roll_no}</strong> for Session {requestingInfoDispute.session} on {formatDate(requestingInfoDispute.attendance_date)}.
            </p>

            <form onSubmit={handleRequestInfoSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Instructions for Student *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Please provide hospital admission slip or stamped participation certificate from the event coordinator."
                  value={infoComment}
                  onChange={(e) => setInfoComment(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRequestingInfoDispute(null)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId === requestingInfoDispute.id}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {processingId === requestingInfoDispute.id ? 'Sending...' : 'Request Information'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Attachment Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-5 border border-gray-200 animate-slideDown flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Paperclip size={18} className="text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-gray-800 truncate max-w-md">{previewAttachment.file_name}</h3>
                  <span className="text-[11px] text-gray-500">{previewAttachment.mime_type} • {Math.round(previewAttachment.file_size / 1024)} KB</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewAttachment.download_url}
                  target="_blank"
                  rel="noreferrer"
                  download={previewAttachment.file_name}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors"
                >
                  <Download size={13} /> Download
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-50 rounded-lg mt-3 flex items-center justify-center min-h-[300px]">
              {previewAttachment.mime_type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(previewAttachment.file_name) ? (
                <img
                  src={previewAttachment.download_url}
                  alt={previewAttachment.file_name}
                  className="max-h-[70vh] max-w-full object-contain rounded shadow-xs"
                />
              ) : (
                <iframe
                  src={previewAttachment.download_url}
                  className="w-full h-[70vh] rounded border border-gray-200 bg-white"
                  title="Document Viewer"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

