'use client';

import React, { useState } from 'react';
import { Paperclip, Upload, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/date';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 5;

/**
 * Normalizes a Date or date-string to YYYY-MM-DD without timezone shifts.
 */
export function toDateKey(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return String(val).slice(0, 10);
}

/**
 * Matches an existing student dispute to a specific class session.
 */
export function findMatchingDispute(disputes, { assignmentId, date, sessionNumber }) {
  if (!Array.isArray(disputes) || !assignmentId || !date || !sessionNumber) return null;
  const targetDate = toDateKey(date);
  return (
    disputes.find(
      (d) =>
        Number(d.assignment_id) === Number(assignmentId) &&
        toDateKey(d.attendance_date) === targetDate &&
        Number(d.session) === Number(sessionNumber)
    ) || null
  );
}

function handleEvidenceFileSelect(e, formSetter) {
  const selectedFiles = Array.from(e.target.files || []);
  const valid = [];

  for (const file of selectedFiles) {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      toast.error(`"${file.name}" is not supported. Please choose JPG, PNG, or PDF.`);
      continue;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`"${file.name}" exceeds the 5MB size limit.`);
      continue;
    }
    valid.push(file);
  }

  formSetter((prev) => {
    const combined = [...prev.files, ...valid];
    if (combined.length > MAX_FILES) {
      toast.error('Maximum 5 files allowed.');
      return { ...prev, files: combined.slice(0, MAX_FILES) };
    }
    return { ...prev, files: combined };
  });
  e.target.value = '';
}

function removeEvidenceFile(index, formSetter) {
  formSetter((prev) => ({
    ...prev,
    files: prev.files.filter((_, idx) => idx !== index),
  }));
}

/**
 * Renders either the compact Dispute button or the existing dispute status badge & action
 * strictly for ABSENT attendance records.
 */
export function DisputeStatusActions({ status, existingDispute, onOpenDispute, onRespond }) {
  if (status !== 'ABSENT') return null;

  if (existingDispute) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
            existingDispute.status === 'APPROVED'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : existingDispute.status === 'REJECTED'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : existingDispute.status === 'MORE_INFO_REQUIRED'
              ? 'bg-amber-50 text-amber-800 border-amber-300 font-bold'
              : 'bg-sky-50 text-sky-700 border-sky-200'
          }`}
        >
          {existingDispute.status === 'MORE_INFO_REQUIRED'
            ? 'Info Requested'
            : `Dispute ${existingDispute.status.toLowerCase()}`}
        </span>
        {existingDispute.status === 'MORE_INFO_REQUIRED' && (
          <button
            type="button"
            onClick={() => onRespond?.(existingDispute)}
            className="text-[10px] font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded transition-colors cursor-pointer"
          >
            Respond
          </button>
        )}
        {existingDispute.status === 'PENDING' && (
          <button
            type="button"
            onClick={() => onRespond?.(existingDispute)}
            className="text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
          >
            Add Evidence
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenDispute}
      className="text-[11px] font-medium text-[#0b3578] hover:text-blue-900 border border-[#0b3578]/20 bg-blue-50/50 hover:bg-blue-50 px-2.5 py-0.5 rounded transition-colors cursor-pointer"
    >
      Dispute
    </button>
  );
}

/**
 * Reusable Request Attendance Correction modal.
 */
export function AttendanceDisputeModal({
  session,
  subjectName,
  subjectCode,
  assignmentId,
  onClose,
  onSuccess,
}) {
  if (!session) return null;
  const sessionKey = `${assignmentId}-${toDateKey(session.date)}-${session.sessionNumber}`;
  return (
    <AttendanceDisputeModalInner
      key={sessionKey}
      session={session}
      subjectName={subjectName}
      subjectCode={subjectCode}
      assignmentId={assignmentId}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

function AttendanceDisputeModalInner({
  session,
  subjectName,
  subjectCode,
  assignmentId,
  onClose,
  onSuccess,
}) {
  const [disputeForm, setDisputeForm] = useState({
    category: 'INCORRECT_MARKING',
    requested_status: 'PRESENT',
    reason: '',
    declaration: false,
    files: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!disputeForm.reason || disputeForm.reason.trim().length < 5) {
      toast.error('Please enter a clear explanation (minimum 5 characters).');
      return;
    }
    if (!disputeForm.declaration) {
      toast.error('You must confirm the truthfulness declaration before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('assignment_id', String(Number(assignmentId)));
      formData.append('attendance_date', toDateKey(session.date));
      formData.append('session', String(Number(session.sessionNumber)));
      formData.append('category', disputeForm.category);
      formData.append('requested_status', disputeForm.requested_status);
      formData.append('reason', disputeForm.reason.trim());
      formData.append('student_declaration', 'true');

      disputeForm.files.forEach((file) => {
        formData.append('evidence', file);
        formData.append('files', file);
      });

      const res = await fetch('/api/student/attendance/disputes', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to submit dispute');
      }

      toast.success('Attendance dispute submitted successfully');
      onClose?.();
      await onSuccess?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 border border-gray-200 animate-slideDown my-8">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">Request Attendance Correction</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="bg-gray-50 p-3 rounded border border-gray-200 text-xs space-y-1">
            <div>
              <strong>Subject:</strong> {subjectName} ({subjectCode})
            </div>
            <div>
              <strong>Date:</strong> {formatDate(session.date)}
            </div>
            <div>
              <strong>Session:</strong> Session {session.sessionNumber}
            </div>
            <div>
              <strong>Recorded Status:</strong>{' '}
              <span className="text-rose-600 font-bold">ABSENT</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Dispute Category *
              </label>
              <select
                value={disputeForm.category}
                onChange={(e) =>
                  setDisputeForm((prev) => ({ ...prev, category: e.target.value }))
                }
                className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none"
              >
                <option value="INCORRECT_MARKING">Incorrect Marking (Was in Class)</option>
                <option value="MEDICAL">Medical Leave / Illness</option>
                <option value="AUTHORIZED_ACTIVITY">Sports / Cultural / Event Duty</option>
                <option value="OTHER">Other Authorized Reason</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Requested Status *
              </label>
              <select
                value={disputeForm.requested_status}
                onChange={(e) =>
                  setDisputeForm((prev) => ({ ...prev, requested_status: e.target.value }))
                }
                className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none"
              >
                <option value="PRESENT">PRESENT (Actually attended)</option>
                <option value="NCC">NCC (Official NCC duty)</option>
                <option value="MEDICAL">MEDICAL (Approved medical leave)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Detailed Explanation *
            </label>
            <textarea
              rows={3}
              required
              placeholder="Explain why you believe this session was marked absent incorrectly..."
              value={disputeForm.reason}
              onChange={(e) => setDisputeForm((prev) => ({ ...prev, reason: e.target.value }))}
              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Supporting Evidence (Prescriptions, Hospital Bills, Event Certificates)
            </label>
            <p className="text-[11px] text-gray-500 mb-2">
              Upload up to 5 documents (Max 5MB each, PDF, JPG, PNG). Evidence remains private to
              authorized faculty and HOD.
            </p>

            <div className="border border-dashed border-gray-300 rounded-md p-3 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
              <input
                type="file"
                id="evidence-upload"
                multiple
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) => handleEvidenceFileSelect(e, setDisputeForm)}
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
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs bg-white border border-gray-200 px-2.5 py-1.5 rounded"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <Paperclip size={12} className="text-gray-400 shrink-0" />
                      <span className="truncate font-medium text-gray-700">{file.name}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        ({Math.round(file.size / 1024)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEvidenceFile(idx, setDisputeForm)}
                      className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={disputeForm.declaration}
                onChange={(e) =>
                  setDisputeForm((prev) => ({ ...prev, declaration: e.target.checked }))
                }
                className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-[#0b3578] focus:ring-[#0b3578]"
              />
              <span className="text-[11px] text-gray-600 leading-tight">
                I confirm that the submitted details and supporting evidence documents are genuine,
                authentic, and accurate.
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !disputeForm.declaration}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0b3578] hover:bg-blue-900 rounded transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Reusable Respond / Add Evidence modal for PENDING or MORE_INFO_REQUIRED disputes.
 */
export function AttendanceDisputeResponseModal({ dispute, onClose, onSuccess }) {
  if (!dispute) return null;
  return (
    <AttendanceDisputeResponseModalInner
      key={dispute.id}
      dispute={dispute}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

function AttendanceDisputeResponseModalInner({ dispute, onClose, onSuccess }) {
  const [responseForm, setResponseForm] = useState({ additional_explanation: '', files: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!responseForm.additional_explanation?.trim() && responseForm.files.length === 0) {
      toast.error('Please enter additional explanation or attach evidence files.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      if (responseForm.additional_explanation?.trim()) {
        formData.append('additional_explanation', responseForm.additional_explanation.trim());
      }

      responseForm.files.forEach((file) => {
        formData.append('evidence', file);
        formData.append('files', file);
      });

      const res = await fetch(`/api/student/attendance/disputes/${dispute.id}`, {
        method: 'PATCH',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to submit additional information');
      }

      toast.success('Additional information submitted successfully');
      onClose?.();
      await onSuccess?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 border border-gray-200 animate-slideDown my-8">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 text-blue-900">
          <div className="flex items-center gap-2">
            <Paperclip size={18} className="text-[#0b3578]" />
            <h3 className="text-base font-semibold text-gray-800">
              {dispute.status === 'PENDING'
                ? 'Upload Supporting Evidence'
                : 'Provide Additional Information'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {dispute.reviewer_comments && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded text-xs space-y-1">
              <div className="font-bold text-amber-900">Reviewer Instructions:</div>
              <div className="text-amber-800 leading-relaxed">{dispute.reviewer_comments}</div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {dispute.status === 'PENDING'
                ? 'Additional Notes / Explanation (Optional)'
                : 'Additional Explanation *'}
            </label>
            <textarea
              rows={3}
              placeholder={
                dispute.status === 'PENDING'
                  ? 'Add any extra context regarding your evidence documents...'
                  : 'Provide the requested details or context...'
              }
              value={responseForm.additional_explanation}
              onChange={(e) =>
                setResponseForm((prev) => ({ ...prev, additional_explanation: e.target.value }))
              }
              className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none"
            />
          </div>

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
                onChange={(e) => handleEvidenceFileSelect(e, setResponseForm)}
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
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs bg-white border border-gray-200 px-2.5 py-1.5 rounded"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <Paperclip size={12} className="text-gray-400 shrink-0" />
                      <span className="truncate font-medium text-gray-700">{file.name}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        ({Math.round(file.size / 1024)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEvidenceFile(idx, setResponseForm)}
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
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Submitting...' : 'Submit to Reviewer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
