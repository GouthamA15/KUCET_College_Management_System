'use client';
/* eslint-disable @next/next/no-img-element */
import { useState, _useEffect } from 'react';
import toast from 'react-hot-toast';
import FacultyAcademicCalendar from './FacultyAcademicCalendar';
import { useFacultyAttendance } from '@/context/FacultyAttendanceContext';
import { canonicalizeRollNo } from '@/lib/rollNumber';
import dynamic from 'next/dynamic';
import LectureTopicModal from './LectureTopicModal';
import { getAssetUrl } from '@/lib/assets';

const QRScannerPanel = dynamic(() => import('./QRScannerPanel'), {
  ssr: false,
  loading: () => <div className="p-6 text-center text-emerald-600 bg-emerald-50 rounded-xl mb-6">Loading camera module...</div>
});

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}-${month}-${year}`;
};

const SubjectIdentityPanel = () => {
  const { assignment } = useFacultyAttendance();
  return (
  <div className="bg-white border-2 border-gray-200 p-4 rounded-lg mb-6">
    <div className="flex justify-between items-center border-b-2 border-gray-200 pb-2 mb-4">
      <h2 className="text-xl font-bold text-gray-800">Attendance Register</h2>
      <span className={`text-sm font-bold px-3 py-1 rounded-full ${assignment.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
        {assignment.is_active ? 'Active' : 'History'}
      </span>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
      <div className="font-semibold text-gray-500">Subject:</div>
      <div className="font-mono text-gray-900 col-span-3">{assignment.subject_name}</div>

      <div className="font-semibold text-gray-500">Code:</div>
      <div className="font-mono text-gray-900">{assignment.subject_code}</div>

      <div className="font-semibold text-gray-500">Branch:</div>
      <div className="font-mono text-gray-900">{assignment.branch}</div>

      <div className="font-semibold text-gray-500">Semester:</div>
      <div className="font-mono text-gray-900">{assignment.semester}</div>

      <div className="font-semibold text-gray-500">Academic Year:</div>
      <div className="font-mono text-gray-900">{assignment.academic_year}</div>
    </div>
  </div>
  );
};

const SessionControlPanel = () => {
  const { 
    activeSession, 
    startSession, 
    endSession, 
    submitting, 
    verifiedStudentIds, 
    students, 
    setAttendanceStatus, 
    handleManualRefresh,
    selectedDate,
    dateValidation
  } = useFacultyAttendance();

  const verifiedList = (students || []).filter((s) => verifiedStudentIds?.has?.(s.id));

  const handleConfirmAll = () => {
    (students || []).forEach((s) => {
      if (verifiedStudentIds?.has?.(s.id)) {
        setAttendanceStatus(s.id, 'PRESENT');
      } else if (s.status === null) {
        setAttendanceStatus(s.id, 'ABSENT');
      }
    });
    toast.success('Marked verified students as PRESENT and others as ABSENT.');
  };

  return (
    <div className="bg-indigo-50 border-2 border-indigo-200 p-4 rounded-xl mb-6 shadow-sm">
      <div className="flex flex-col lg:flex-row justify-between gap-6">
        <div className="flex-1">
          <h3 className="text-indigo-900 font-bold flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${activeSession ? 'bg-green-400' : 'bg-gray-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${activeSession ? 'bg-green-500' : 'bg-gray-500'}`}></span>
            </span>
            SECURE ATTENDANCE (PIN + GPS)
          </h3>
          <p className="text-xs text-indigo-700 mt-1">
            {activeSession 
              ? 'Session is live! Students must enter the 4-digit PIN on their dashboard to verify.' 
              : 'Start a secure session to allow students to mark their own attendance via GPS verification.'}
          </p>

          {activeSession && (
            <div className="mt-4 p-3 bg-white rounded-lg border border-indigo-100 shadow-inner">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-indigo-400 uppercase">Live Verifications ({verifiedList.length})</span>
                  <button 
                    onClick={handleManualRefresh}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors group"
                    title="Manual Refresh"
                  >
                    <svg className="w-3.5 h-3.5 text-indigo-500 group-active:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                  </button>
                </div>
                {verifiedList.length > 0 && (
                  <button 
                    onClick={handleConfirmAll}
                    className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded font-bold hover:bg-indigo-700 active:scale-95 transition-all"
                  >
                    Confirm All
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
                {verifiedList.length > 0 ? verifiedList.map(s => (
                  <div key={s.id} className="text-[10px] font-bold bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 animate-fadeIn">
                    {s.roll_no}
                  </div>
                )) : (
                  <p className="text-[10px] text-gray-400 italic">Waiting for students to enter PIN...</p>
                )}
              </div>
            </div>
          )}
        </div>

        {activeSession ? (
          <div className="flex items-center gap-8 bg-white p-4 rounded-lg border border-indigo-100 shadow-sm shrink-0">
            <div className="text-center px-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">ATTENDANCE PIN</p>
              <p className="text-5xl font-black text-indigo-600 tracking-tighter">{activeSession.session_pin}</p>
            </div>
            <button
              onClick={endSession}
              disabled={submitting}
              className="ml-4 px-6 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors uppercase"
            >
              End Session
            </button>
          </div>
        ) : (
          <button
            onClick={startSession}
            disabled={submitting || !selectedDate || !dateValidation.isValid}
            className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
            title={!selectedDate ? "Please select a date first" : !dateValidation.isValid ? "Please select a valid working day" : "Start Secure Session"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3c4.183 0 7.66 2.567 9.106 6H22.25m-9.448 10a10.003 10.003 0 01-1.106-2.04m0 0l.054-.09A10.003 10.003 0 0122.5 12"></path></svg>
            START SECURE SESSION
          </button>
        )}
      </div>
    </div>
  );
};

const SessionSelector = () => {
  const { assignment, selectedSession, setSelectedSession, existingSessionsForSelectedDate } = useFacultyAttendance();

  return (
    <div className="flex-1">
      <label className="block text-[11px] font-bold text-gray-500 uppercase mb-2">SESSIONS</label>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg border-2">
        {[1, 2, 3, 4, 5].map((num) => {
          const isExisting = existingSessionsForSelectedDate.includes(num);
          const isAllowedSequential = num === 1 || existingSessionsForSelectedDate.includes(num - 1);
          const isDisabled = !assignment.is_active || !isAllowedSequential;
          const isSelected = selectedSession === num;

          return (
            <button
              key={num}
              type="button"
              onClick={() => !isDisabled && setSelectedSession(num)}
              disabled={isDisabled}
              className={`flex-1 h-9 rounded-md text-[11px] font-bold tracking-wide uppercase transition-colors border ${
                isSelected
                  ? 'bg-gray-900 text-white border-gray-900'
                  : isExisting
                  ? 'bg-gray-50 text-gray-900 border-gray-300'
                  : 'bg-white text-gray-600 border-gray-200'
              } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              title={
                isDisabled && num !== 1
                  ? `Session S${num} will be available after S${num - 1} is recorded.`
                  : isExisting
                  ? `S${num} already has attendance records.`
                  : ''
              }
            >
              S{num}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[11px] text-gray-500">Sessions unlock sequentially. S2 requires recorded attendance for S1, and so on.</p>
    </div>
  );
};

const SaveControls = () => {
  const { assignment, submitting, students, dateValidation, existingSessionsForSelectedDate, selectedSession, handleSaveAttendance, handleDeleteAttendance } =
    useFacultyAttendance();

  return (
    <div className="flex flex-col items-stretch md:items-end gap-2 min-w-[180px]">
      {assignment.is_active ? (
        <>
          <button
            type="button"
            onClick={handleSaveAttendance}
            disabled={submitting || !students.length || !dateValidation.isValid || !assignment.is_active}
            className="px-4 py-2 bg-gray-900 text-white text-xs font-bold uppercase tracking-wide border border-gray-900 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Save Attendance'}
          </button>
          <button
            type="button"
            onClick={handleDeleteAttendance}
            disabled={
              submitting ||
              !existingSessionsForSelectedDate.includes(selectedSession) ||
              !dateValidation.isValid ||
              !assignment.is_active
            }
            className="px-4 py-2 bg-white text-red-700 text-xs font-bold uppercase tracking-wide border border-red-300 disabled:opacity-50"
          >
            Delete Session
          </button>
        </>
      ) : (
        <div className="px-4 py-2 bg-gray-200 text-gray-600 text-[11px] font-bold uppercase tracking-[0.18em] border text-center">Semester Ended</div>
      )}
    </div>
  );
};

const FollowPreviousButton = () => {
  const { assignment, selectedSession, selectedDate, existingSessionsForSelectedDate, setAttendanceStatus, students } = useFacultyAttendance();
  const [loadingCopy, setLoadingCopy] = useState(false);

  if (!selectedDate) return null;
  if (selectedSession <= 1) return null;

  const prev = selectedSession - 1;
  if (!existingSessionsForSelectedDate.includes(prev)) return null;

  const handleFollow = async () => {
    if (!assignment?.id) return;
    setLoadingCopy(true);
    try {
      const url = `/api/clerk/faculty/attendance/status?assignment_id=${assignment.id}&date=${encodeURIComponent(
        selectedDate,
      )}&session=${encodeURIComponent(prev)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch previous session');

      const statusMap = (data.data || []).reduce((acc, r) => {
        acc[r.student_id] = r.status;
        return acc;
      }, { /* empty */ });

      (students || []).forEach((s) => {
        setAttendanceStatus(s.id, statusMap[s.id] ?? null);
      });

      toast.success('Session attendance copied from previous session');
    } catch (err) {
      toast.error(err.message || 'Unable to copy previous session');
    } finally {
      setLoadingCopy(false);
    }
  };

  return (
    <div className="flex items-center md:justify-center w-full md:w-auto">
      <button
        type="button"
        onClick={handleFollow}
        disabled={loadingCopy}
        className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 text-sm font-semibold text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-60"
        title="Copy attendance from previous session"
      >
        {loadingCopy ? 'Copying…' : 'Follow previous session'}
      </button>
    </div>
  );
};

const AttendanceGrid = () => {
  const { students, assignment, dateValidation, toggleAttendanceStatus, setAllAttendanceStatus, statusLoading, verifiedStudentIds } = useFacultyAttendance();

  return (
    <div className="w-full">
      {/* Mobile Header Actions (Visible only on mobile) */}
      <div className="md:hidden flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Bulk Actions</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => assignment.is_active && dateValidation.isValid && setAllAttendanceStatus('PRESENT')}
            disabled={!assignment.is_active || !dateValidation.isValid || statusLoading}
            className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-black rounded hover:bg-green-700 disabled:opacity-50 transition-colors uppercase"
          >
            All P
          </button>
          <button
            type="button"
            onClick={() => assignment.is_active && dateValidation.isValid && setAllAttendanceStatus('ABSENT')}
            disabled={!assignment.is_active || !dateValidation.isValid || statusLoading}
            className="px-3 py-1.5 bg-red-600 text-white text-[10px] font-black rounded hover:bg-red-700 disabled:opacity-50 transition-colors uppercase"
          >
            All A
          </button>
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden flex flex-col gap-3">
        {students.map((student) => (
          <div key={student.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-500 flex-shrink-0">
                  {student.pfp ? (
                    <img src={getAssetUrl(student.pfp)} alt={student.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerText = student.name.charAt(0).toUpperCase(); }} />
                  ) : (
                    student.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono font-bold text-slate-800">{student.roll_no}</span>
                    {verifiedStudentIds.has(student.id) && (
                      <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Self-Verified via QR/PIN"></span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{student.name}</span>
                    {verifiedStudentIds.has(student.id) && (
                      <span className="text-[8px] font-black text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 uppercase">Verified</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="pt-3 border-t border-slate-100">
              {statusLoading ? (
                <div className="flex justify-center py-2">
                  <span className="inline-block h-6 w-6 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <button
                  onClick={() => assignment.is_active && toggleAttendanceStatus(student.id)}
                  disabled={!assignment.is_active || !dateValidation.isValid}
                  className={`w-full py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${
                    student.status === null
                      ? 'bg-slate-100 text-slate-500 border border-slate-200'
                      : student.status === 'PRESENT'
                      ? 'bg-green-500 text-white shadow-md shadow-green-500/20'
                      : student.status === 'ABSENT'
                      ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                      : student.status === 'NCC'
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                      : student.status === 'MEDICAL'
                      ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                      : 'bg-slate-100 text-slate-500'
                  } ${!assignment.is_active || !dateValidation.isValid ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'}`}
                >
                  {student.status === null ? 'NOT SET (TAP TO CHANGE)' : student.status}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y-2 divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-16">Photo</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Roll No</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                <div className="flex flex-col items-center gap-2">
                  <div className="inline-flex items-center justify-center gap-2">
                    <span>Status</span>
                    {statusLoading && (
                      <span className="inline-block h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  {/* Bulk Toggle Buttons */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => assignment.is_active && dateValidation.isValid && setAllAttendanceStatus('PRESENT')}
                      disabled={!assignment.is_active || !dateValidation.isValid || statusLoading}
                      className="px-2 py-1 bg-green-600 text-white text-[9px] font-black rounded hover:bg-green-700 disabled:opacity-50 transition-colors uppercase"
                      title="Mark All Present"
                    >
                      All P
                    </button>
                    <button
                      type="button"
                      onClick={() => assignment.is_active && dateValidation.isValid && setAllAttendanceStatus('ABSENT')}
                      disabled={!assignment.is_active || !dateValidation.isValid || statusLoading}
                      className="px-2 py-1 bg-red-600 text-white text-[9px] font-black rounded hover:bg-red-700 disabled:opacity-50 transition-colors uppercase"
                      title="Mark All Absent"
                    >
                      All A
                    </button>
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {students.map((student) => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-500">
                    {student.pfp ? (
                      <img src={getAssetUrl(student.pfp)} alt={student.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerText = student.name.charAt(0).toUpperCase(); }} />
                    ) : (
                      student.name.charAt(0).toUpperCase()
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-800">
                  <div className="flex items-center gap-2">
                    {student.roll_no}
                    {verifiedStudentIds.has(student.id) && (
                      <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Self-Verified via QR/PIN"></span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    {student.name}
                    {verifiedStudentIds.has(student.id) && (
                      <span className="text-[9px] font-black text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 uppercase">Verified</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  {statusLoading ? (
                    <div className="flex justify-center">
                      <span className="inline-block h-6 w-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <button
                      onClick={() => assignment.is_active && toggleAttendanceStatus(student.id)}
                      disabled={!assignment.is_active || !dateValidation.isValid}
                      className={`w-28 px-3 py-2 rounded text-sm font-bold uppercase ${
                        student.status === null
                          ? 'bg-gray-100 text-gray-700'
                          : student.status === 'PRESENT'
                          ? 'bg-green-100 text-green-800'
                          : student.status === 'ABSENT'
                          ? 'bg-red-100 text-red-800'
                          : student.status === 'NCC'
                          ? 'bg-blue-100 text-blue-800'
                          : student.status === 'MEDICAL'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-700'
                      } ${!assignment.is_active || !dateValidation.isValid ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
                    >
                      {student.status === null ? 'NOT SET' : student.status}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PendingSyncIndicator = () => {
  const { pendingSyncs, syncOfflineAttendance, submitting } = useFacultyAttendance();

  if (!pendingSyncs || pendingSyncs.length === 0) return null;

  return (
    <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-xl mb-6 shadow-sm animate-fadeIn">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-amber-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-amber-900 font-bold text-sm uppercase tracking-wide">Pending Offline Attendance ({pendingSyncs.length})</h3>
            <p className="text-xs text-amber-700 mt-0.5 font-medium">
              You recorded attendance while offline. These records need to be synced with the server.
            </p>
          </div>
        </div>
        <button
          onClick={() => syncOfflineAttendance()}
          disabled={submitting}
          className="w-full sm:w-auto px-6 py-2.5 bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-amber-700 transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? 'Syncing...' : 'Sync All Now'}
          {!submitting && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>}
        </button>
      </div>
      
      <div className="mt-3 flex flex-wrap gap-2">
        {pendingSyncs.map(p => (
          <div key={p.id} className="text-[10px] font-bold bg-white/60 text-amber-800 px-2.5 py-1 rounded border border-amber-200">
            {p.subject_name || 'Subject'} | {p.date} | S{p.session}
          </div>
        ))}
      </div>
    </div>
  );
};

export default function AttendanceSheet({ onBack, mode }) {
  const { assignment, loading, students, selectedDate, dayInfo, dateValidation, handleCalendarSelect, setAttendanceStatus, verifiedStudentIds: _verifiedStudentIds, setVerifiedStudentIds, topicModalSession, setTopicModalSession } = useFacultyAttendance();

  const handleQRScan = (rollNo) => {
    if (!selectedDate || !dateValidation?.isValid) {
      toast.error('Select a valid WORKING day from the calendar first.', { id: 'qr-error' });
      return;
    }
    const targetRoll = canonicalizeRollNo(rollNo);
    const student = students.find(s => canonicalizeRollNo(s.roll_no) === targetRoll);
    if (student) {
      setAttendanceStatus(student.id, 'PRESENT');
      // optionally add them to verified list to show visual feedback
      if (setVerifiedStudentIds) {
        setVerifiedStudentIds(prev => {
          const next = new Set(prev);
          next.add(student.id);
          return next;
        });
      }
      toast.success(`Marked ${rollNo} present!`, { id: 'qr-success' });
    } else {
      toast.error(`Student with Roll No ${rollNo} not found in this class.`);
    }
  };

  const handleQRStop = () => {
    let changed = false;
    (students || []).forEach(s => {
      if (s.status === null) {
        setAttendanceStatus(s.id, 'ABSENT');
        changed = true;
      }
    });
    if (changed) {
      toast.success('Scanner stopped. Remaining students marked as ABSENT.', { id: 'qr-stop' });
    }
  };

  if (loading && !students.length) return <div className="text-center py-4">Loading students...</div>;

  return (
    <div>
      {/* Back Button */}
      <button onClick={onBack} className="text-sm font-medium text-gray-700 hover:text-gray-900 mb-4 inline-flex items-center">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        Back to Subjects
      </button>

      {/* Pending Sync Section */}
      <PendingSyncIndicator />

      {/* Subject Identity Panel */}
      <SubjectIdentityPanel assignment={assignment} />

      {/* MODE SPECIFIC PANELS */}
      {assignment.is_active && mode === 'gps' && <SessionControlPanel />}
      {assignment.is_active && mode === 'qr' && <QRScannerPanel onScanSuccess={handleQRScan} onScannerStop={handleQRStop} />}

      {/* FACULTY ACADEMIC CALENDAR */}
      <FacultyAcademicCalendar
        assignment={assignment}
        selectedDate={selectedDate}
        onSelectDate={handleCalendarSelect}
        attendanceSectionId="faculty-attendance-section"
      />

      {/* ATTENDANCE ENTRY SECTION */}
      <section id="faculty-attendance-section" className="bg-white p-4 sm:p-6 rounded-lg border-2 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 border-b pb-3">
          <div>
            <p className="text-[11px] font-bold text-gray-500 tracking-[0.18em] uppercase">ATTENDANCE ENTRY</p>
            <p className="text-sm text-gray-600 mt-1">Select a WORKING day from the calendar to record attendance.</p>
          </div>
          <div className="mt-3 md:mt-0 flex flex-col items-end text-xs gap-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-500 uppercase tracking-wide">DATE</span>
              <span className="font-mono text-gray-900">{selectedDate ? formatDisplayDate(selectedDate) : '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-500 uppercase tracking-wide">DAY TYPE</span>
              <span className="text-gray-900 font-semibold">{dayInfo?.day_type || '—'}</span>
            </div>
          </div>
        </div>

        {!selectedDate && (
          <div className="text-sm text-gray-600 bg-gray-50 border border-dashed border-gray-300 rounded-md p-3">Select a WORKING day in the academic calendar above to enable attendance entry.</div>
        )}

        {selectedDate && !dateValidation.isValid && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-3 font-semibold">{dateValidation.message}</div>
        )}

        {selectedDate && (
          <>
            <div className="mb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <SessionSelector />
              <FollowPreviousButton />
              <SaveControls />
            </div>

            <AttendanceGrid />
          </>
        )}
      </section>

      {/* Lecture Topic Modal after successful attendance save */}
      <LectureTopicModal
        isOpen={Boolean(topicModalSession)}
        assignmentId={topicModalSession?.assignmentId}
        date={topicModalSession?.date}
        session={topicModalSession?.session}
        initialTopic={topicModalSession?.initialTopic || ''}
        onClose={() => setTopicModalSession(null)}
      />
    </div>
  );
}
