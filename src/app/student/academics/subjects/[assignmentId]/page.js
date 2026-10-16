"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Calendar, XCircle, Info, Paperclip, Upload, Trash2, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SubjectDetailPage({ params }) {
  const router = useRouter();
  const { assignmentId } = React.use(params);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [disputes, setDisputes] = useState([]);
  const [selectedDisputeSession, setSelectedDisputeSession] = useState(null);
  const [disputeForm, setDisputeForm] = useState({ 
    category: 'INCORRECT_MARKING', 
    requested_status: 'PRESENT', 
    reason: '', 
    declaration: false, 
    files: [] 
  });
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

  // More Info Response state
  const [respondingDispute, setRespondingDispute] = useState(null);
  const [responseForm, setResponseForm] = useState({ additional_explanation: '', files: [] });
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);

  const refreshDisputes = React.useCallback(async () => {
    try {
      const res = await fetch('/api/student/attendance/disputes');
      const json = await res.json();
      if (res.ok && json.data) {
        setDisputes(json.data.filter(d => d.assignment_id === Number(assignmentId)));
      }
    } catch (_e) {
      // Ignore background refetch error
    }
  }, [assignmentId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });

    let isMounted = true;
    async function loadData() {
      try {
        const [subjectRes, disputesRes] = await Promise.all([
          fetch(`/api/student/academics/subjects/${assignmentId}`),
          fetch('/api/student/attendance/disputes')
        ]);
        const subjectJson = await subjectRes.json();
        const disputesJson = await disputesRes.json();
        
        if (!isMounted) return;

        if (!subjectRes.ok) {
          throw new Error(subjectJson.error || 'Failed to fetch subject details');
        }
        setData(subjectJson.data);
        if (disputesRes.ok && disputesJson.data) {
          setDisputes(disputesJson.data.filter(d => d.assignment_id === Number(assignmentId)));
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          toast.error(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    
    loadData();
    return () => {
      isMounted = false;
    };
  }, [assignmentId]);

  const handleOpenDispute = (session) => {
    setSelectedDisputeSession(session);
    setDisputeForm({ 
      category: 'INCORRECT_MARKING', 
      requested_status: 'PRESENT', 
      reason: '', 
      declaration: false, 
      files: [] 
    });
  };

  const handleFileSelect = (e, formSetter) => {
    const selectedFiles = Array.from(e.target.files || []);
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    const valid = [];

    for (const file of selectedFiles) {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`"${file.name}" is not supported. Please choose JPG, PNG, or PDF.`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds the 5MB size limit.`);
        continue;
      }
      valid.push(file);
    }

    formSetter(prev => {
      const combined = [...prev.files, ...valid];
      if (combined.length > 5) {
        toast.error('Maximum 5 files allowed.');
        return { ...prev, files: combined.slice(0, 5) };
      }
      return { ...prev, files: combined };
    });
    // Reset input
    e.target.value = '';
  };

  const removeFile = (index, formSetter) => {
    formSetter(prev => ({
      ...prev,
      files: prev.files.filter((_, idx) => idx !== index)
    }));
  };

  const handleSubmitDispute = async (e) => {
    e.preventDefault();
    if (!selectedDisputeSession) return;
    if (!disputeForm.reason || disputeForm.reason.trim().length < 5) {
      toast.error('Please enter a clear explanation (minimum 5 characters).');
      return;
    }
    if (!disputeForm.declaration) {
      toast.error('You must confirm the truthfulness declaration before submitting.');
      return;
    }

    setIsSubmittingDispute(true);
    try {
      const formData = new FormData();
      formData.append('assignment_id', String(Number(assignmentId)));
      formData.append('attendance_date', selectedDisputeSession.date);
      formData.append('session', String(Number(selectedDisputeSession.sessionNumber)));
      formData.append('category', disputeForm.category);
      formData.append('requested_status', disputeForm.requested_status);
      formData.append('reason', disputeForm.reason.trim());
      formData.append('student_declaration', 'true');

      disputeForm.files.forEach(file => {
        formData.append('evidence', file);
        formData.append('files', file);
      });

      const res = await fetch('/api/student/attendance/disputes', {
        method: 'POST',
        body: formData
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to submit dispute');
      }

      toast.success('Attendance dispute submitted successfully');
      setSelectedDisputeSession(null);
      refreshDisputes();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  const handleSubmitResponse = async (e) => {
    e.preventDefault();
    if (!respondingDispute) return;
    if (!responseForm.additional_explanation?.trim() && responseForm.files.length === 0) {
      toast.error('Please enter additional explanation or attach evidence files.');
      return;
    }

    setIsSubmittingResponse(true);
    try {
      const formData = new FormData();
      if (responseForm.additional_explanation?.trim()) {
        formData.append('additional_explanation', responseForm.additional_explanation.trim());
      }

      responseForm.files.forEach(file => {
        formData.append('evidence', file);
        formData.append('files', file);
      });

      const res = await fetch(`/api/student/attendance/disputes/${respondingDispute.id}`, {
        method: 'PATCH',
        body: formData
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to submit response');
      }

      toast.success('Additional details and evidence submitted');
      setRespondingDispute(null);
      refreshDisputes();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmittingResponse(false);
    }
  };

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
                
                if (session.status === 'PRESENT') {
                  statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
                } else if (session.status === 'ABSENT') {
                  statusBadge = "bg-rose-50 text-rose-700 border-rose-200";
                } else if (session.status === 'NCC') {
                  statusBadge = "bg-blue-50 text-blue-700 border-blue-200";
                }
                
                const dateObj = new Date(session.date);
                const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

                const sessionDateStr = session.date instanceof Date ? session.date.toISOString().split('T')[0] : session.date;
                const existingDispute = disputes.find(d => {
                  const dDateStr = d.attendance_date instanceof Date ? d.attendance_date.toISOString().split('T')[0] : d.attendance_date;
                  return dDateStr === sessionDateStr && d.session === session.sessionNumber;
                });

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
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <div className={`text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 rounded border tracking-wide flex items-center justify-center whitespace-nowrap ${statusBadge}`}>
                        {session.status}
                      </div>

                      {session.status === 'ABSENT' && (
                        existingDispute ? (
                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                              existingDispute.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              existingDispute.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              existingDispute.status === 'MORE_INFO_REQUIRED' ? 'bg-amber-50 text-amber-800 border-amber-300 font-bold' :
                              'bg-sky-50 text-sky-700 border-sky-200'
                            }`}>
                              {existingDispute.status === 'MORE_INFO_REQUIRED' ? 'Info Requested' : `Dispute ${existingDispute.status.toLowerCase()}`}
                            </span>
                            {existingDispute.status === 'MORE_INFO_REQUIRED' && (
                              <button
                                onClick={() => {
                                  setRespondingDispute(existingDispute);
                                  setResponseForm({ additional_explanation: '', files: [] });
                                }}
                                className="text-[10px] font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded transition-colors cursor-pointer"
                              >
                                Respond
                              </button>
                            )}
                            {existingDispute.status === 'PENDING' && (
                              <button
                                onClick={() => {
                                  setRespondingDispute(existingDispute);
                                  setResponseForm({ additional_explanation: '', files: [] });
                                }}
                                className="text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
                              >
                                Add Evidence
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenDispute(session)}
                            className="text-[11px] font-medium text-[#0b3578] hover:text-blue-900 border border-[#0b3578]/20 bg-blue-50/50 hover:bg-blue-50 px-2.5 py-1 rounded transition-colors cursor-pointer"
                          >
                            Dispute
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Attendance Dispute Modal */}
      {selectedDisputeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 border border-gray-200 animate-slideDown my-8">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">Request Attendance Correction</h3>
              <button 
                onClick={() => setSelectedDisputeSession(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitDispute} className="mt-4 space-y-4">
              <div className="bg-gray-50 p-3 rounded border border-gray-200 text-xs space-y-1">
                <div><strong>Subject:</strong> {data.subject_name} ({data.subject_code})</div>
                <div><strong>Date:</strong> {selectedDisputeSession.date}</div>
                <div><strong>Session:</strong> Session {selectedDisputeSession.sessionNumber}</div>
                <div><strong>Recorded Status:</strong> <span className="text-rose-600 font-bold">ABSENT</span></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Dispute Category *</label>
                  <select
                    value={disputeForm.category}
                    onChange={(e) => setDisputeForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none"
                  >
                    <option value="INCORRECT_MARKING">Incorrect Marking (Was in Class)</option>
                    <option value="MEDICAL">Medical Leave / Illness</option>
                    <option value="AUTHORIZED_ACTIVITY">Sports / Cultural / Event Duty</option>
                    <option value="OTHER">Other Authorized Reason</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Requested Status *</label>
                  <select
                    value={disputeForm.requested_status}
                    onChange={(e) => setDisputeForm(prev => ({ ...prev, requested_status: e.target.value }))}
                    className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none"
                  >
                    <option value="PRESENT">PRESENT (Actually attended)</option>
                    <option value="NCC">NCC (Official NCC duty)</option>
                    <option value="MEDICAL">MEDICAL (Approved medical leave)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Detailed Explanation *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why you believe this session was marked absent incorrectly..."
                  value={disputeForm.reason}
                  onChange={(e) => setDisputeForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none"
                />
              </div>

              {/* Multi-file Evidence Upload */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Supporting Evidence (Prescriptions, Hospital Bills, Event Certificates)
                </label>
                <p className="text-[11px] text-gray-500 mb-2">
                  Upload up to 5 documents (Max 5MB each, PDF, JPG, PNG). Evidence remains private to authorized faculty and HOD.
                </p>

                <div className="border border-dashed border-gray-300 rounded-md p-3 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
                  <input
                    type="file"
                    id="evidence-upload"
                    multiple
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => handleFileSelect(e, setDisputeForm)}
                    className="hidden"
                  />
                  <label
                    htmlFor="evidence-upload"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0b3578] hover:underline cursor-pointer"
                  >
                    <Upload size={14} /> Choose Evidence Files
                  </label>
                </div>

                {disputeForm.files.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {disputeForm.files.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs bg-white border border-gray-200 px-2.5 py-1.5 rounded">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <Paperclip size={12} className="text-gray-400 shrink-0" />
                          <span className="truncate font-medium text-gray-700">{file.name}</span>
                          <span className="text-[10px] text-gray-400 shrink-0">({Math.round(file.size / 1024)} KB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx, setDisputeForm)}
                          className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mandatory Declaration Checkbox */}
              <div className="pt-2 border-t border-gray-100">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={disputeForm.declaration}
                    onChange={(e) => setDisputeForm(prev => ({ ...prev, declaration: e.target.checked }))}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-[#0b3578] focus:ring-[#0b3578]"
                  />
                  <span className="text-[11px] text-gray-600 leading-tight">
                    I confirm that the submitted details and supporting evidence documents are genuine, authentic, and accurate.
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedDisputeSession(null)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDispute || !disputeForm.declaration}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0b3578] hover:bg-blue-900 rounded transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingDispute ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Respond / Add Evidence Modal */}
      {respondingDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 border border-gray-200 animate-slideDown my-8">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 text-blue-900">
              <div className="flex items-center gap-2">
                <Paperclip size={18} className="text-[#0b3578]" />
                <h3 className="text-base font-semibold text-gray-800">
                  {respondingDispute.status === 'PENDING' ? 'Upload Supporting Evidence' : 'Provide Additional Information'}
                </h3>
              </div>
              <button 
                onClick={() => setRespondingDispute(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitResponse} className="mt-4 space-y-4">
              {respondingDispute.reviewer_comments && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded text-xs space-y-1">
                  <div className="font-bold text-amber-900">Reviewer Instructions:</div>
                  <div className="text-amber-800 leading-relaxed">{respondingDispute.reviewer_comments}</div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {respondingDispute.status === 'PENDING' ? 'Additional Notes / Explanation (Optional)' : 'Additional Explanation *'}
                </label>
                <textarea
                  rows={3}
                  placeholder={respondingDispute.status === 'PENDING' ? 'Add any extra context regarding your evidence documents...' : 'Provide the requested details or context...'}
                  value={responseForm.additional_explanation}
                  onChange={(e) => setResponseForm(prev => ({ ...prev, additional_explanation: e.target.value }))}
                  className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none"
                />
              </div>

              {/* Additional files upload */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Upload Additional Documents (Optional)
                </label>
                <div className="border border-dashed border-gray-300 rounded-md p-3 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
                  <input
                    type="file"
                    id="response-evidence-upload"
                    multiple
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => handleFileSelect(e, setResponseForm)}
                    className="hidden"
                  />
                  <label
                    htmlFor="response-evidence-upload"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0b3578] hover:underline cursor-pointer"
                  >
                    <Upload size={14} /> Attach Supplementary Files
                  </label>
                </div>

                {responseForm.files.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {responseForm.files.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs bg-white border border-gray-200 px-2.5 py-1.5 rounded">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <Paperclip size={12} className="text-gray-400 shrink-0" />
                          <span className="truncate font-medium text-gray-700">{file.name}</span>
                          <span className="text-[10px] text-gray-400 shrink-0">({Math.round(file.size / 1024)} KB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx, setResponseForm)}
                          className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRespondingDispute(null)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResponse}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingResponse ? 'Submitting...' : 'Submit to Reviewer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

