'use client';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import FacultyAcademicCalendar from './FacultyAcademicCalendar';

const MobileSubjectIdentityPanel = ({ assignment }) => (
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


export default function MobileAttendanceSheet({ assignment, onBack }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSession, setSelectedSession] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [dateValidation, setDateValidation] = useState({
    isValid: false,
    message: 'Select a WORKING day from the academic calendar.',
  });
  const [dayInfo, setDayInfo] = useState(null);

  const [existingSessionsForSelectedDate, setExistingSessionsForSelectedDate] = useState([]);

  // Removed attendance percentage for mobile.

  const [baseStudents, setBaseStudents] = useState([]);

  const fetchBaseStudents = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/clerk/faculty/students?assignment_id=${assignment.id}&base=1`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch students');

      const base = (data.data || []).map(s => ({ id: s.id, roll_no: s.roll_no, name: s.name }));
      setBaseStudents(base);
      setStudents(base.map(s => ({ ...s, status: null })));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [assignment.id, selectedSession, selectedDate]);

  const fetchAttendanceStatus = useCallback(async () => {
    if (!selectedDate) return;
    setLoading(true);
    try {
      const url = `/api/clerk/faculty/attendance/status?assignment_id=${assignment.id}&date=${encodeURIComponent(selectedDate)}&session=${encodeURIComponent(selectedSession)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch attendance status');

      const statusMap = (data.data || []).reduce((acc, r) => { acc[r.student_id] = r.status; return acc; }, {});
      const merged = baseStudents.map(s => ({ ...s, status: statusMap[s.id] ?? null }));
      setStudents(merged);
      setExistingSessionsForSelectedDate(data.sessions || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [assignment.id, selectedDate, selectedSession, baseStudents]);

  // History/grid removed for mobile — single-session flow only

  useEffect(() => {
    fetchBaseStudents();
  }, [assignment.id, fetchBaseStudents]);

  useEffect(() => {
    if (selectedDate) {
      fetchAttendanceStatus();
    } else {
      setStudents(baseStudents.map(s => ({ ...s, status: null })));
      setExistingSessionsForSelectedDate([]);
    }
  }, [selectedDate, selectedSession, baseStudents, fetchAttendanceStatus]);

  const toggleStatus = (studentId) => {
    setStudents(students.map(s => {
      if (s.id !== studentId) return s;
      if (s.status === null) return { ...s, status: 'PRESENT' };
      if (s.status === 'PRESENT') return { ...s, status: 'ABSENT' };
      return { ...s, status: 'PRESENT' };
    }));
  };

  const handleSaveAttendance = async () => {
    setSubmitting(true);
    try {
      if (!selectedDate || !dateValidation.isValid) {
        throw new Error('Select a valid WORKING day from the calendar.');
      }

      // Saving allowed for new sessions; do not block on NOT SET here.

      const res = await fetch('/api/clerk/faculty/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignment.id,
          date: selectedDate,
          session: selectedSession,
          attendance_data: students.map(s => ({ student_id: s.id, status: s.status }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save attendance');

      toast.success('Attendance saved successfully');
      await fetchAttendanceStatus();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAttendance = async () => {
    if (!selectedDate) return toast.error('No date selected');

    if (!confirm(`Are you sure you want to delete attendance for Session ${selectedSession} on ${selectedDate}?`)) return;
    
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clerk/faculty/attendance?assignment_id=${assignment.id}&date=${selectedDate}&session=${selectedSession}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete attendance');

      toast.success('Attendance deleted successfully');
      await fetchAttendanceStatus();
      setSelectedSession(1);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // percentage removed in mobile UI

  const handleCalendarSelect = (dateStr, info) => {
    setSelectedDate(dateStr);
    if (info) {
      setDayInfo(info);
      if (info.day_type === 'WORKING') {
        setDateValidation({ isValid: true, message: null });
      } else {
        setDateValidation({ isValid: false, message: `Attendance cannot be marked. Reason: ${info.day_type}` });
      }
    }
  };

  // history save removed

  if (loading) return <div className="text-center py-4">Loading students...</div>;

  return (
    <div>
      {/* Back Button */}
      <button onClick={onBack} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-4 inline-flex items-center">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        Back to Subjects
      </button>

      {/* Subject Identity Panel */}
      <MobileSubjectIdentityPanel assignment={assignment} />

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
              <span className="font-mono text-gray-900">{selectedDate || '—'}</span>
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
              {students.length > 0 ? (
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
                      <th className="px-3 py-2 text-center font-semibold text-gray-600" style={{ fontSize: '12px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 align-middle font-mono text-gray-800" style={{ fontSize: '12px', fontWeight: 600 }}>{student.roll_no}</td>
                        <td className="px-3 py-2 align-middle text-gray-800" style={{ fontSize: '13px', fontWeight: 500, wordBreak: 'break-word', whiteSpace: 'normal' }}>{student.name}</td>
                        <td className="px-3 py-2 align-middle text-center">
                          <button
                            type="button"
                            onClick={() => assignment.is_active && dateValidation.isValid && toggleStatus(student.id)}
                            disabled={!assignment.is_active || !dateValidation.isValid}
                            style={{ width: '48px', height: '32px', textAlign: 'center', fontWeight: 700, fontSize: '12px', borderRadius: '6px' }}
                            className={`${student.status === null ? 'bg-gray-100 text-gray-700' : student.status === 'PRESENT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} ${(!assignment.is_active || !dateValidation.isValid) ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
                          >
                            {student.status === null ? 'N/A' : student.status === 'PRESENT' ? 'P' : 'A'}
                          </button>
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
