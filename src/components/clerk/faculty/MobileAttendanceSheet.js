'use client';
import { useState, _useEffect } from 'react';
import toast from 'react-hot-toast';
import FacultyAcademicCalendar from './FacultyAcademicCalendar';
import { useFacultyAttendance } from '@/context/FacultyAttendanceContext';
import dynamic from 'next/dynamic';

const QRScannerPanel = dynamic(() => import('./QRScannerPanel'), {
  ssr: false,
  loading: () => <div className="p-4 text-center text-emerald-600 bg-emerald-50 rounded-lg mb-4 text-sm font-bold">Loading camera module...</div>
});

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}-${month}-${year}`;
};

const MobileSubjectIdentityPanel = () => {
  const { assignment } = useFacultyAttendance();
  return (
    <div className="bg-white border-b shadow-sm p-3 mb-4 sticky top-[52px] z-20">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1">
          <h2 className="text-sm font-black text-gray-900 uppercase leading-tight line-clamp-1">{assignment.subject_name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 uppercase">{assignment.subject_code}</span>
            <span className="text-[10px] font-bold text-indigo-600">{assignment.branch} • Sem {assignment.semester}</span>
          </div>
        </div>
        <div className={`text-[10px] font-black px-2 py-1 rounded-full shrink-0 ${assignment.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {assignment.is_active ? 'ACTIVE' : 'HISTORY'}
        </div>
      </div>
    </div>
  );
};

const MobileSessionControlPanel = () => {
  const { 
    activeSession, 
    startSession, 
    endSession, 
    submitting, 
    selectedDate, 
    dateValidation,
    verifiedStudentIds,
    students,
    setAttendanceStatus,
    fetchAttendanceStatus
  } = useFacultyAttendance();

  const verifiedList = students.filter(s => verifiedStudentIds.has(s.id));

  const handleConfirmAll = () => {
    students.forEach(s => {
      if (verifiedStudentIds.has(s.id)) {
        setAttendanceStatus(s.id, 'PRESENT');
      } else if (s.status === null) {
        setAttendanceStatus(s.id, 'ABSENT');
      }
    });
    toast.success(`Marked verified students as PRESENT and others as ABSENT.`);
  };

  return (
    <div className="bg-indigo-50 border-2 border-indigo-200 p-4 rounded-xl mb-6 shadow-sm">
      <h3 className="text-indigo-900 font-bold flex items-center gap-2 text-sm mb-3">
        <span className="relative flex h-3 w-3">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${activeSession ? 'bg-green-400' : 'bg-gray-400'} opacity-75`}></span>
          <span className={`relative inline-flex rounded-full h-3 w-3 ${activeSession ? 'bg-green-500' : 'bg-gray-500'}`}></span>
        </span>
        SECURE ATTENDANCE
      </h3>

      {activeSession ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 bg-white p-3 rounded-lg border border-indigo-100 text-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">PIN</p>
              <p className="text-3xl font-black text-indigo-600 tracking-tight">{activeSession.session_pin}</p>
            </div>
            <button
              onClick={endSession}
              disabled={submitting}
              className="px-4 py-3 bg-red-600 text-white text-xs font-bold rounded-lg uppercase shadow-sm active:bg-red-700"
            >
              End
            </button>
          </div>

          {/* Live verification list for mobile */}
          <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-inner">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">Live Logs ({verifiedList.length})</span>
                <button 
                  onClick={() => {
                    fetchAttendanceStatus();
                    toast.success('List updated', { duration: 1000, id: 'mobile-refresh' });
                  }}
                  className="p-1 text-indigo-500 hover:bg-indigo-50 rounded-full transition-all group"
                >
                  <svg className="w-3.5 h-3.5 group-active:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                </button>
              </div>
              {verifiedList.length > 0 && (
                <button 
                  onClick={handleConfirmAll}
                  className="text-[9px] bg-indigo-600 text-white px-2 py-1 rounded-md font-bold uppercase active:scale-95 transition-all"
                >
                  Confirm All
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
              {verifiedList.length > 0 ? verifiedList.map(s => (
                <div key={s.id} className="text-[9px] font-bold bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100">
                  {s.roll_no}
                </div>
              )) : (
                <p className="text-[9px] text-gray-400 italic">No one has entered PIN yet...</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={startSession}
          disabled={submitting || !selectedDate || !dateValidation.isValid}
          className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm active:bg-indigo-700 disabled:opacity-50 disabled:grayscale"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3c4.183 0 7.66 2.567 9.106 6H22.25m-9.448 10a10.003 10.003 0 01-1.106-2.04m0 0l.054-.09A10.003 10.003 0 0122.5 12"></path></svg>
          START SECURE SESSION
        </button>
      )}
    </div>
  );
};

const MobilePendingSyncIndicator = () => {
  const { pendingSyncs, syncOfflineAttendance, submitting } = useFacultyAttendance();

  if (!pendingSyncs || pendingSyncs.length === 0) return null;

  return (
    <div className="bg-amber-50 border-2 border-amber-200 p-3 rounded-xl mb-4 shadow-sm">
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1">
          <h3 className="text-amber-900 font-black text-[10px] uppercase tracking-wider">Offline Sync Pending ({pendingSyncs.length})</h3>
          <p className="text-[10px] text-amber-700 mt-0.5 leading-tight">
            Recorded while offline. Click to sync with server.
          </p>
        </div>
        <button
          onClick={() => syncOfflineAttendance()}
          disabled={submitting}
          className="px-3 py-1.5 bg-amber-600 text-white text-[9px] font-black uppercase tracking-widest rounded-md shadow-sm active:scale-95 disabled:opacity-50"
        >
          {submitting ? '...' : 'Sync Now'}
        </button>
      </div>
      <div className="mt-2 flex gap-1 overflow-x-auto no-scrollbar">
        {pendingSyncs.map(p => (
          <div key={p.id} className="text-[8px] font-bold bg-white/60 text-amber-800 px-1.5 py-0.5 rounded border border-amber-100 whitespace-nowrap">
            {p.date} • S{p.session}
          </div>
        ))}
      </div>
    </div>
  );
};

export default function MobileAttendanceSheet({ onBack, mode }) {
  const {
    assignment,
    students,
    loading,
    statusLoading,
    selectedDate,
    selectedSession,
    setSelectedSession,
    setAttendanceStatus,
    submitting,
    dateValidation,
    dayInfo,
    existingSessionsForSelectedDate,
    handleSaveAttendance,
    handleDeleteAttendance,
    handleCalendarSelect,
    toggleAttendanceStatus,
    setAllAttendanceStatus,
    verifiedStudentIds,
    setVerifiedStudentIds
  } = useFacultyAttendance();

  const handleQRScan = (rollNo) => {
    if (!selectedDate || !dateValidation?.isValid) {
      toast.error('Select a valid WORKING day from the calendar first.', { id: 'qr-error' });
      return;
    }
    const student = students.find(s => s.roll_no === rollNo);
    if (student) {
      setAttendanceStatus(student.id, 'PRESENT');
      if (setVerifiedStudentIds) {
        setVerifiedStudentIds(prev => {
          const next = new Set(prev);
          next.add(student.id);
          return next;
        });
      }
      toast.success(`Marked ${rollNo} present!`, { id: 'qr-success-mobile' });
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
      toast.success('Scanner stopped. Remaining students marked as ABSENT.', { id: 'qr-stop-mobile' });
    }
  };

  return (
    <div className="pb-24">
      {/* Back Button */}
      <button onClick={onBack} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-4 inline-flex items-center">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        Back to Subjects
      </button>

      {/* Pending Sync (Mobile) */}
      <MobilePendingSyncIndicator />

      {/* Subject Identity Panel */}
      <MobileSubjectIdentityPanel />

      {/* MODE SPECIFIC PANELS (MOBILE) */}
      {assignment.is_active && mode === 'gps' && <MobileSessionControlPanel />}
      {assignment.is_active && mode === 'qr' && <QRScannerPanel onScanSuccess={handleQRScan} onScannerStop={handleQRStop} />}

      {/* FACULTY ACADEMIC CALENDAR (MOBILE) */}
      <FacultyAcademicCalendar
        assignment={assignment}
        selectedDate={selectedDate}
        onSelectDate={handleCalendarSelect}
        attendanceSectionId="mobile-faculty-attendance-section"
      />

      {/* ATTENDANCE ENTRY SECTION */}
      <section id="mobile-faculty-attendance-section" className="bg-white p-4 rounded-lg border-2 mb-6">
        <div className="mb-4 border-b pb-3 flex flex-col gap-2">
          <div>
            <p className="text-[11px] font-bold text-gray-500 tracking-[0.18em] uppercase">ATTENDANCE ENTRY</p>
            <p className="text-xs text-gray-600 mt-1">
              Select a WORKING day from the calendar to record attendance.
            </p>
          </div>
          <div className="flex justify-between text-[11px] text-gray-600">
            <div>
              <span className="font-semibold mr-2">DATE</span>
              <span className="font-mono text-gray-900">{selectedDate ? formatDisplayDate(selectedDate) : '—'}</span>
            </div>
            <div className="text-right">
              <span className="font-semibold mr-2">DAY TYPE</span>
              <span className="font-semibold text-gray-900">{dayInfo?.day_type || '—'}</span>
            </div>
          </div>
        </div>

        {!selectedDate && (
          <div className="text-xs text-gray-600 bg-gray-50 border border-dashed border-gray-300 rounded-md p-3 mb-2">
            Select a WORKING day in the academic calendar above to enable attendance entry.
          </div>
        )}

        {selectedDate && !dateValidation.isValid && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-3 font-semibold">
            {dateValidation.message}
          </div>
        )}

        {selectedDate && dateValidation.isValid && (
          <>
            {/* Session Selector */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase">Sessions</label>
                {verifiedStudentIds.size > 0 && (
                  <div className="flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-[9px] font-black text-green-700">{verifiedStudentIds.size} VERIFIED</span>
                  </div>
                )}
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                {[1, 2, 3, 4, 5].map(num => {
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
                      className={`flex-1 h-10 rounded-lg text-[11px] font-black flex items-center justify-center min-w-[50px] border-2 transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : isExisting
                          ? 'bg-indigo-50 text-indigo-900 border-indigo-100'
                          : 'bg-white text-gray-400 border-gray-100'
                      } ${isDisabled ? 'opacity-30' : 'active:scale-95'}`}
                    >
                      S{num}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons (Condensed) */}
            <div className="space-y-2 mb-6">
              {assignment.is_active && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => assignment.is_active && dateValidation.isValid && setAllAttendanceStatus('PRESENT')}
                      disabled={submitting || !students.length}
                      className="bg-green-50 text-green-700 py-2.5 rounded-xl font-bold text-[10px] uppercase border-2 border-green-100 active:bg-green-100"
                    >
                      All Present
                    </button>
                    <button
                      type="button"
                      onClick={() => assignment.is_active && dateValidation.isValid && setAllAttendanceStatus('ABSENT')}
                      disabled={submitting || !students.length}
                      className="bg-red-50 text-red-700 py-2.5 rounded-xl font-bold text-[10px] uppercase border-2 border-red-100 active:bg-red-100"
                    >
                      All Absent
                    </button>
                  </div>
                  
                  {selectedSession > 1 && existingSessionsForSelectedDate.includes(selectedSession - 1) && (
                    <FollowPreviousMobileButton
                      assignment={assignment}
                      prevSession={selectedSession - 1}
                      selectedDate={selectedDate}
                      students={students}
                      setAttendanceStatus={setAttendanceStatus}
                    />
                  )}
                </>
              )}
            </div>

            {/* Mobile Table */}
            <div className="mt-2">
              {loading && students.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-xs">Loading students...</div>
              ) : students.length > 0 ? (
                <table className="w-full table-fixed border-collapse">
                  <colgroup>
                    <col style={{ width: '28%' }} />
                    <col style={{ width: '52%' }} />
                    <col style={{ width: '20%' }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 text-[12px]">Roll No</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 text-[12px]">Name</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-600 text-[12px]">
                        <span className="inline-flex items-center justify-center gap-1">
                          <span>Status</span>
                          {statusLoading && (
                            <span className="inline-block h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          )}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 align-middle font-mono text-gray-800 text-[12px] font-semibold">
                          <div className="flex items-center gap-1">
                            {student.roll_no}
                            {verifiedStudentIds.has(student.id) && (
                              <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-middle text-gray-800 text-[13px] font-medium break-words">
                          {student.name}
                          {verifiedStudentIds.has(student.id) && (
                            <div className="text-[8px] font-black text-green-600 uppercase">Verified</div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle text-center">
                          {statusLoading ? (
                            <span className="inline-block h-6 w-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <button
                              type="button"
                              onClick={() => assignment.is_active && dateValidation.isValid && toggleAttendanceStatus(student.id)}
                              disabled={!assignment.is_active || !dateValidation.isValid}
                              style={{ width: '56px', height: '32px', textAlign: 'center', fontWeight: 700, fontSize: '12px', borderRadius: '6px' }}
                              className={`${
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
                              } ${(!assignment.is_active || !dateValidation.isValid) ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
                            >
                              {student.status === null ? 'N/A' : 
                               student.status === 'PRESENT' ? 'P' : 
                               student.status === 'ABSENT' ? 'A' :
                               student.status === 'NCC' ? 'NCC' :
                               student.status === 'MEDICAL' ? 'M' : '?'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-4 text-gray-500 text-xs">No students found.</div>
              )}
            </div>
          </>
        )}
      </section>

      {/* STICKY BOTTOM ACTION BAR */}
      {selectedDate && dateValidation.isValid && assignment.is_active && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex gap-3 z-30 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <button
            type="button"
            onClick={handleDeleteAttendance}
            disabled={submitting || !existingSessionsForSelectedDate.includes(selectedSession)}
            className="p-3 text-red-600 border-2 border-red-50 rounded-xl active:bg-red-50 disabled:opacity-30"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
          <button
            type="button"
            onClick={handleSaveAttendance}
            disabled={submitting || !students.length}
            className="flex-1 bg-indigo-600 text-white font-black py-3 rounded-xl shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-sm disabled:bg-gray-300 disabled:shadow-none"
          >
            {submitting ? (
              <span className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            )}
            Save Session S{selectedSession}
          </button>
        </div>
      )}
    </div>
  );
}

  {/* Follow Previous Mobile Button Component */}
  function FollowPreviousMobileButton({ assignment, prevSession, selectedDate, students, setAttendanceStatus }) {
    const [loading, setLoading] = useState(false);

    const handleFollow = async () => {
      if (!assignment?.id || !selectedDate) return;
      setLoading(true);
      try {
        const url = `/api/clerk/faculty/attendance/status?assignment_id=${assignment.id}&date=${encodeURIComponent(
          selectedDate,
        )}&session=${encodeURIComponent(prevSession)}`;
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
        setLoading(false);
      }
    };

    return (
      <button
        type="button"
        onClick={handleFollow}
        disabled={loading}
        className="w-full py-2 rounded-lg bg-white border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
      >
        {loading ? 'Copying…' : 'Follow previous session'}
      </button>
    );
  }
