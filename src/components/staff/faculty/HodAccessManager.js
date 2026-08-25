import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useStaff } from '@/context/StaffContext';
import AcademicYearSelect from '@/components/ui/AcademicYearSelect';

export default function HodAccessManager() {
  const { staffData } = useStaff();
  const [requests, setRequests] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [departmentCode, setDepartmentCode] = useState('');
  
  // Use current active academic year from staff data or fallback
  const currentAcademicYear = staffData?.academic_year || '2025-26';
  const [academicYear, setAcademicYear] = useState(currentAcademicYear);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/staff/hod/requests');
      const data = await res.json();
      if (res.ok && data.data) {
        // Fallback for transition
        if (Array.isArray(data.data)) {
           setRequests(data.data);
           setAssignments([]);
        } else {
           setRequests(data.data.requests || []);
           setAssignments(data.data.assignments || []);
        }
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
    
    // Check duplicate pending
    if (requests.some(r => r.status === 'PENDING' && r.department_code === departmentCode && r.academic_year === academicYear)) {
       toast.error('A request for this department and academic year is already pending.');
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

  if (loading) {
    return <div className="text-center py-4 text-slate-500 text-sm">Loading HOD Access status...</div>;
  }

  const activeAssignments = assignments.filter(a => a.is_active);
  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const rejectedRequests = requests.filter(r => r.status === 'REJECTED');

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-300 rounded-md p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">HOD Access Status</h2>
        
        {activeAssignments.length > 0 && (
          <div className="mb-4">
            {activeAssignments.map(a => (
              <div key={a.id} className="bg-green-50 border border-green-200 text-green-800 rounded p-4 mb-3">
                <h3 className="font-bold mb-1">HOD Access Active - {a.department_code}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                  <div><span className="text-green-600/80 uppercase text-[10px] tracking-wider block font-black">Academic Year</span>{a.academic_year}</div>
                  <div><span className="text-green-600/80 uppercase text-[10px] tracking-wider block font-black">Status</span>{a.is_active ? 'Active' : 'Inactive'}</div>
                  <div><span className="text-green-600/80 uppercase text-[10px] tracking-wider block font-black">Valid From</span>{new Date(a.start_date).toLocaleDateString()}</div>
                  <div><span className="text-green-600/80 uppercase text-[10px] tracking-wider block font-black">Valid Until</span>{a.end_date ? new Date(a.end_date).toLocaleDateString() : 'N/A'}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {pendingRequests.length > 0 && (
          <div className="mb-4">
            {pendingRequests.map(p => (
              <div key={p.id} className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded p-4 mb-3">
                <h3 className="font-bold mb-1">Request Pending</h3>
                <p className="text-sm">Your request for HOD access ({p.department_code}, {p.academic_year}) is pending approval by the Admin.</p>
              </div>
            ))}
          </div>
        )}

        {rejectedRequests.length > 0 && (
           <div className="mb-4">
             {rejectedRequests.map(r => (
               <div key={r.id} className="bg-red-50 border border-red-200 text-red-800 rounded p-4 mb-3">
                 <h3 className="font-bold mb-1">Request Rejected - {r.department_code} ({r.academic_year})</h3>
                 <p className="text-sm">{r.rejection_reason || 'No specific reason provided.'}</p>
                 <p className="text-xs text-red-600 mt-2">Reviewed on {new Date(r.reviewed_at).toLocaleDateString()}</p>
               </div>
             ))}
           </div>
        )}

        {activeAssignments.length === 0 && pendingRequests.length === 0 && rejectedRequests.length === 0 && (
          <div className="bg-slate-50 border border-slate-200 text-slate-700 rounded p-4 mb-4">
             <h3 className="font-bold mb-1">No Active Access</h3>
             <p className="text-sm">You do not currently have HOD access for any department.</p>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-300 rounded-md p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Request HOD Access</h2>
        <p className="text-sm text-gray-600 mb-6">If you are the designated Head of Department, submit a request below to gain administrative access over department scheduling and approvals.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label htmlFor="dept" className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Department</label>
            {staffData?.branches && staffData.branches.length > 0 ? (
              <select
                id="dept"
                value={departmentCode}
                onChange={(e) => setDepartmentCode(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-[#0b3578]/10 outline-none transition-colors"
              >
                <option value="">Select Department...</option>
                {staffData.branches.map(br => (
                  <option key={br} value={br}>{br}</option>
                ))}
              </select>
            ) : (
              <input
                id="dept"
                type="text"
                required
                value={departmentCode}
                onChange={(e) => setDepartmentCode(e.target.value.toUpperCase())}
                placeholder="e.g. CSE"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-[#0b3578]/10 outline-none transition-colors"
              />
            )}
          </div>

          <div>
            <label htmlFor="acadYear" className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Academic Year</label>
            <AcademicYearSelect
              id="acadYear"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-[#0b3578]/10 outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full py-2.5 bg-[#0b3578] text-white rounded font-semibold text-sm hover:bg-blue-900 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </div>
  );
}
