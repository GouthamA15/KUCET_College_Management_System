import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useStaff } from '@/context/StaffContext';

export default function HodAccessManager() {
  const { staffData } = useStaff();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [departmentCode, setDepartmentCode] = useState('');
  const defaultYear = (() => {
    const y = new Date().getFullYear();
    return `${y}-${(y + 1).toString().slice(-2)}`;
  })();
  const [academicYear, setAcademicYear] = useState(defaultYear);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/staff/hod/requests');
      const data = await res.json();
      if (res.ok && data.data) {
        setRequests(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch requests');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load HOD access requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRequests();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!departmentCode || !academicYear) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/staff/hod/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_code: departmentCode, academic_year: academicYear }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request');
      toast.success('HOD access request submitted');
      setDepartmentCode('');
      fetchRequests();
    } catch (error) {
      toast.error(error.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const isHodActive = staffData?.roles?.includes('hod'); // This needs to check actual assignment but staff roles provide basic auth


  if (loading) {
    return <div className="text-center py-4 text-slate-500 text-sm">Loading HOD Access status...</div>;
  }

  const pendingRequest = requests.find(r => r.status === 'PENDING');
  const rejectedRequests = requests.filter(r => r.status === 'REJECTED');
  const approvedRequests = requests.filter(r => r.status === 'APPROVED');

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-300 rounded-md p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">HOD Access Status</h2>
        
        {isHodActive || approvedRequests.length > 0 ? (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded p-4 mb-4">
            <h3 className="font-bold mb-1">HOD Access Active</h3>
            <p className="text-sm">You currently have active HOD privileges.</p>
            {approvedRequests.map(r => (
               <p key={r.id} className="text-sm font-medium mt-1">Scope: {r.department_code} ({r.academic_year})</p>
            ))}
          </div>
        ) : pendingRequest ? (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded p-4 mb-4">
            <h3 className="font-bold mb-1">Request Pending</h3>
            <p className="text-sm">Your request for HOD access ({pendingRequest.department_code}, {pendingRequest.academic_year}) is pending approval by the Admin.</p>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 text-slate-700 rounded p-4 mb-4">
             <h3 className="font-bold mb-1">Not a HOD</h3>
             <p className="text-sm">You do not currently have HOD access.</p>
          </div>
        )}

        {!isHodActive && !pendingRequest && (
          <div className="mt-6 border-t border-gray-100 pt-6">
            <h3 className="text-md font-semibold text-gray-800 mb-4">Request HOD Access</h3>
            <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department (Branch)</label>
                {staffData?.branches && staffData.branches.length > 0 ? (
                  <select
                    required
                    value={departmentCode}
                    onChange={(e) => setDepartmentCode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0b3578] bg-white"
                  >
                    <option value="">Select Department</option>
                    {staffData.branches.map(br => (
                      <option key={br} value={br}>{br}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={departmentCode}
                    onChange={(e) => setDepartmentCode(e.target.value.toUpperCase())}
                    placeholder="e.g. CSE"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0b3578]"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
                <input
                  type="text"
                  required
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="e.g. 2026-27"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0b3578]"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#0b3578] text-white py-2 px-4 rounded font-medium text-sm hover:bg-[#0a2d66] disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Submitting...' : 'Request Access'}
              </button>
            </form>
          </div>
        )}

        {rejectedRequests.length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-6">
            <h3 className="text-md font-semibold text-gray-800 mb-3">Previous Rejected Requests</h3>
            <div className="space-y-2">
              {rejectedRequests.map(req => (
                <div key={req.id} className="bg-red-50 border border-red-200 text-red-800 rounded p-3 text-sm">
                  <div className="font-semibold">{req.department_code} ({req.academic_year})</div>
                  {req.rejection_reason && <div className="mt-1">Reason: {req.rejection_reason}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
