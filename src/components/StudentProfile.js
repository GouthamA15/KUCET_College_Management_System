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
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-2xl p-8 mt-10 animate-slideDown">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[#0b3578]">Student Profile</h2>
        <button onClick={onLogout} className="text-sm text-blue-700 hover:underline">Logout</button>
      </div>
      <div className="space-y-4">
        <div><span className="font-medium">Roll No:</span> {student.roll_no}</div>
        <div><span className="font-medium">Name:</span> {student.name}</div>
        <div><span className="font-medium">Father Name:</span> {student.father_name}</div>
        <div><span className="font-medium">Gender:</span> {student.gender}</div>
        <div><span className="font-medium">Category:</span> {student.category}</div>
        <form onSubmit={handleSave} className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b3578] focus:border-transparent transition-all duration-200 text-gray-800"
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#0b3578] text-white py-3 rounded-lg font-semibold hover:bg-[#0a2d66] transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          {success && <div className="text-green-600 text-sm mt-2">Phone updated successfully!</div>}
          {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
        </form>
      </div>
    </div>
  );
}
