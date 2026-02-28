'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function FacultyInterestsManager() {
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchInterests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/faculty/interests');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch interests');
      setInterests(data.data || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterests();
  }, []);

  const handleAction = async (interestId, status) => {
    setProcessing(true);
    try {
      const res = await fetch('/api/admin/faculty/approve-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interest_id: interestId, status })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update interest');
      toast.success(`Interest ${status.toLowerCase()} successfully`);
      fetchInterests(); // Refresh list
    } catch (error) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="text-center py-4">Loading faculty interests...</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-6">Faculty Subject Interests Management</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {interests.map((interest) => (
              <tr key={interest.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{interest.faculty_name}</div>
                  <div className="text-xs text-gray-500">ID: {interest.employee_id}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{interest.subject_name}</div>
                  <div className="text-xs text-gray-500">{interest.subject_code}</div>
                  {interest.allocated_faculty_name && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Already allocated to: {interest.allocated_faculty_name}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {interest.branch} | Sem {interest.semester} | {interest.academic_year}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    interest.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    interest.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {interest.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {interest.status === 'PENDING' && (
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleAction(interest.id, 'APPROVED')}
                        disabled={processing}
                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(interest.id, 'REJECTED')}
                        disabled={processing}
                        className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {interest.status !== 'PENDING' && (
                    <span className="text-gray-400 italic">No actions</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {interests.length === 0 && (
        <div className="text-center py-8 text-gray-500">No faculty interests found.</div>
      )}
    </div>
  );
}
