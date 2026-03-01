'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import FacultyAcademicCalendar from './FacultyAcademicCalendar';
import { useFacultyAttendance } from '@/context/FacultyAttendanceContext';
import QRCode from 'qrcode';

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
  <div className="bg-white border-2 border-gray-200 p-4 rounded-lg mb-6">
    <div className="border-b-2 border-gray-200 pb-2 mb-4">
      <h2 className="text-lg font-bold text-gray-800">Attendance Register</h2>
      <span className={`text-xs font-bold px-3 py-1 rounded-full ${assignment.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
        {assignment.is_active ? 'Active' : 'History'}
      </span>
    </div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <div className="font-semibold text-gray-500">Subject:</div>
      <div className="font-mono text-gray-900">{assignment.subject_name}</div>

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

const MobileSessionControlPanel = () => {
  const { activeSession, startSession, endSession, submitting } = useFacultyAttendance();
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (activeSession?.session_token) {
      QRCode.toDataURL(activeSession.session_token, { width: 256, margin: 2 }, (err, url) => {
        if (!err) setQrDataUrl(url);
      });
    }
  }, [activeSession]);

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
          <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-indigo-100">
            <div className="text-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">PIN</p>
              <p className="text-3xl font-black text-indigo-600">{activeSession.session_pin}</p>
            </div>
            {qrDataUrl && (
              <div className="flex flex-col items-center">
                <img src={qrDataUrl} alt="Session QR" className="w-16 h-16" />
                <p className="text-[8px] font-bold text-gray-400 mt-1 uppercase">Scan QR</p>
              </div>
            )}
          </div>
          <button
            onClick={endSession}
            disabled={submitting}
            className="w-full py-2.5 bg-red-600 text-white text-xs font-bold rounded-lg uppercase tracking-wider"
          >
            End Session
          </button>
        </div>
      ) : (
        <button
          onClick={startSession}
          disabled={submitting}
          className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3c4.183 0 7.66 2.567 9.106 6H22.25m-9.448 10a10.003 10.003 0 01-1.106-2.04m0 0l.054-.09A10.003 10.003 0 0122.5 12"></path></svg>
          START SESSION
        </button>
      )}
    </div>
  );
};

export default function MobileAttendanceSheet({ onBack }) {
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
    verifiedStudentIds
  } = useFacultyAttendance();

  return (
    <div>
      {/* Back Button */}
      <button onClick={onBack} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-4 inline-flex items-center">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        Back to Subjects
      </button>

      {/* Subject Identity Panel */}
      <MobileSubjectIdentityPanel />

      {/* SECURE SESSION PANEL (MOBILE) */}
      {assignment.is_active && <MobileSessionControlPanel />}

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

        {selectedDate && (
          <>
            {/* Session Selector */}
            <div className="flex flex-col gap-2 mb-4">
              <label className="block text-[11px] font-bold text-gray-500 uppercase">Sessions</label>
              <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-lg border-2">
                {[1, 2, 3, 4, 5].map(num => {
                  const isExisting = existingSessionsForSelectedDate.includes(num);
                  const isAllowedSequential = num === 1 || existingSessionsForSelectedDate.includes(num - 1);
                  const isDisabled = !assignment.is_active || !isAllowedSequential || !dateValidation.isValid;
                  const isSelected = selectedSession === num;

                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => !isDisabled && setSelectedSession(num)}
                      disabled={isDisabled}
                      className={`flex-grow h-9 rounded-md text-[11px] font-bold flex items-center justify-center min-w-[60px] border ${
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
              <p className="text-[11px] text-gray-500">
                Sessions unlock sequentially. S2 requires recorded attendance for S1, and so on.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 mb-4">
              {assignment.is_active ? (
                <>
                  {/* Follow previous session button (mobile) */}
                  {selectedSession > 1 && existingSessionsForSelectedDate.includes(selectedSession - 1) && dateValidation.isValid && (
                    <FollowPreviousMobileButton
                      assignment={assignment}
                      prevSession={selectedSession - 1}
                      selectedDate={selectedDate}
                      students={students}
                      setAttendanceStatus={setAttendanceStatus}
                    />
                  )}

                  {/* Bulk Mark All Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => assignment.is_active && dateValidation.isValid && setAllAttendanceStatus('PRESENT')}
                      disabled={submitting || !students.length || !dateValidation.isValid}
                      className="bg-green-600 text-white py-2 rounded-lg font-bold text-[10px] uppercase tracking-wide border border-green-600 disabled:opacity-50"
                    >
                      Mark All Present
                    </button>
                    <button
                      type="button"
                      onClick={() => assignment.is_active && dateValidation.isValid && setAllAttendanceStatus('ABSENT')}
                      disabled={submitting || !students.length || !dateValidation.isValid}
                      className="bg-red-600 text-white py-2 rounded-lg font-bold text-[10px] uppercase tracking-wide border border-red-600 disabled:opacity-50"
                    >
                      Mark All Absent
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveAttendance}
                    disabled={submitting || !students.length || !dateValidation.isValid}
                    className="bg-gray-900 text-white w-full py-2 rounded-lg font-bold text-xs uppercase tracking-wide border border-gray-900 disabled:opacity-50"
                  >
                    {submitting ? 'Saving…' : 'Save Attendance'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAttendance}
                    disabled={submitting || !existingSessionsForSelectedDate.includes(selectedSession) || !dateValidation.isValid}
                    className="bg-white text-red-700 border-2 border-red-200 w-full py-2 rounded-lg font-bold text-xs uppercase tracking-wide disabled:opacity-50"
                  >
                    Delete Session
                  </button>
                </>
              ) : (
                <div className="bg-gray-200 text-gray-600 px-4 py-2 rounded-lg font-bold text-[11px] border uppercase tracking-[0.18em] text-center">
                  Semester Ended
                </div>
              )}
            </div>

            {/* Mobile table view */}
            <div className="mt-2">
              {loading && students.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-xs">Loading students...</div>
              ) : students.length > 0 ? (
                <table className="w-full table-fixed border-collapse" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '28%' }} />
                    <col style={{ width: '52%' }} />
                    <col style={{ width: '20%' }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left font-semibold text-gray-600" style={{ fontSize: '12px' }}>Roll No</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600" style={{ fontSize: '12px' }}>Name</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-600" style={{ fontSize: '12px' }}>
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
                        <td className="px-3 py-2 align-middle font-mono text-gray-800" style={{ fontSize: '12px', fontWeight: 600 }}>
                          <div className="flex items-center gap-1">
                            {student.roll_no}
                            {verifiedStudentIds.has(student.id) && (
                              <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-middle text-gray-800" style={{ fontSize: '13px', fontWeight: 500, wordBreak: 'break-word', whiteSpace: 'normal' }}>
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

      {/* ATTENDANCE HISTORY (READ-ONLY) */}
      <section className="bg-white p-4 rounded-lg border-2">
        <div className="text-sm text-gray-600">
          Attendance history is available in the desktop view. Mobile supports single-session daily entry only.
        </div>
      </section>
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
        }, {});

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

