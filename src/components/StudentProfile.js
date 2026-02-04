'use client';

import { useState } from 'react';


export default function StudentProfile({ student, onLogout }) {
  const [phone, setPhone] = useState(student.phone || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const res = await fetch('/api/student/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roll_no: student.roll_no, phone }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || 'Update failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-[19rem] sm:max-w-md mx-auto bg-white border border-gray-200 rounded-none sm:rounded-xl shadow sm:shadow-2xl p-1 sm:p-6 mt-2 sm:mt-10 animate-slideDown overflow-x-hidden">
      <div className="mb-2 sm:mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 px-1 sm:px-0">
        <h2 className="text-xl sm:text-2xl font-bold text-[#0b3578] text-center sm:text-left">Student Profile</h2>
        <button onClick={onLogout} className="text-sm text-blue-700 hover:underline self-end sm:self-auto">Logout</button>
      </div>
      <div className="flex justify-center">
        <div className="w-full max-w-xs bg-gray-50 rounded-lg shadow p-3 sm:p-5 space-y-2 sm:space-y-4 text-sm sm:text-lg break-words">
          <div><span className="font-medium">Roll No:</span> {student.roll_no}</div>
          <div>
            <span className="font-medium">Academic Year:</span> 2023–27
          </div>
          <div><span className="font-medium">Name:</span> {student.name}</div>
          <div><span className="font-medium">Father Name:</span> {(student.personal_details && student.personal_details.father_name) || student.father_name}</div>
          <div><span className="font-medium">Gender:</span> {student.gender}</div>
          <div><span className="font-medium">Category:</span> {student.category}</div>
        </div>
      </div>
      <form onSubmit={handleSave} className="flex flex-col gap-2 sm:gap-4 mt-2 sm:mt-4">
          <div className="flex flex-col gap-1 w-full">
            <label className="block text-xs sm:text-sm font-medium text-gray-700">Phone</label>
            <input
              type="text"
              value={phone ?? ''}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-2 py-1.5 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b3578] focus:border-transparent transition-all duration-200 text-gray-800 text-sm sm:text-base"
              required
            />
          </div>
          <div className="flex flex-col gap-1 w-full">
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[#0b3578] text-white py-1.5 sm:py-3 rounded-lg font-semibold hover:bg-[#0a2d66] transition-all duration-200 shadow hover:shadow-xl text-sm sm:text-base"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            {/* If you have a cancel button, add it here. Example: */}
            {/* <button type="button" className="w-full bg-gray-200 text-gray-800 py-2 sm:py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all duration-200">Cancel</button> */}
          </div>
          {success && <div className="text-green-600 text-sm mt-2">Phone updated successfully!</div>}
          {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
        </form>
      </div>
  );
}
