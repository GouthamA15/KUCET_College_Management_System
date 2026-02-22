'use client';
import FacultyAcademicCalendar from './FacultyAcademicCalendar';
import { useFacultyAttendance } from '@/context/FacultyAttendanceContext';

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

const AttendanceGrid = () => {
  const { students, assignment, dateValidation, toggleAttendanceStatus, statusLoading } = useFacultyAttendance();

  return (
    <table className="min-w-full divide-y-2 divide-gray-200 border">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Roll No</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
          <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
            <div className="inline-flex items-center justify-center gap-2">
              <span>Status</span>
              {statusLoading && (
                <span className="inline-block h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {students.map((student) => (
          <tr key={student.id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-800">{student.roll_no}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{student.name}</td>
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
                      : 'bg-red-100 text-red-800'
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
  );
};

export default function AttendanceSheet({ onBack }) {
  const { assignment, loading, students, selectedDate, dayInfo, dateValidation, handleCalendarSelect } = useFacultyAttendance();

  if (loading && !students.length) return <div className="text-center py-4">Loading students...</div>;

  return (
    <div>
      {/* Back Button */}
      <button onClick={onBack} className="text-sm font-medium text-gray-700 hover:text-gray-900 mb-4 inline-flex items-center">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        Back to Subjects
      </button>

      {/* Subject Identity Panel */}
      <SubjectIdentityPanel assignment={assignment} />

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
              <SaveControls />
            </div>

            <AttendanceGrid />
          </>
        )}
      </section>

      {/* History removed — single-session grid only */}
    </div>
  );
}
