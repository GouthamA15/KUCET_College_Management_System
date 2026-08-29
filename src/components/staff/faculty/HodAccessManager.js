import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useStaff } from '@/context/StaffContext';
import AcademicYearSelect, { getCurrentFrontendAcademicYear } from '@/components/ui/AcademicYearSelect';
import { formatDate } from '@/lib/date';

export default function HodAccessManager() {
  const { staffData } = useStaff();
  const [requests, setRequests] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const currentAcademicYear = getCurrentFrontendAcademicYear();
  // Using 0 numYears logic implicitly via standard select means only the current year is available!
  // We'll restrict AcademicYearSelect to startYear=currentYear, numYears=1
  const startYearNumber = parseInt(currentAcademicYear.substring(0, 4));

  const [academicYear, setAcademicYear] = useState(currentAcademicYear);

  // Read-only department from staff data
  const facultyDepartment = staffData?.department || staffData?.departments?.[0] || 'Unknown Department';
  const facultyDepartmentName = staffData?.department_name || staffData?.department_names?.[0] || facultyDepartment;

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/staff/hod/requests');
      const data = await res.json();
      if (res.ok && data.data) {
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
    if (!facultyDepartment || facultyDepartment === 'Unknown Department') {
      toast.error('Your department is unknown. Please contact administration.');
      return;
    }
    
    // Check duplicate pending
    if (requests.some(r => r.status === 'PENDING' && r.department_code === facultyDepartment && r.academic_year === academicYear)) {
       toast.error('A request for this department and academic year is already pending.');
       return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/staff/hod/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_code: facultyDepartment, academic_year: academicYear }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request');
      toast.success('HOD access request submitted');
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

  const now = new Date();
  const nowStr = now.toISOString().split('T')[0];

  const activeAssignments = assignments.filter(a => a.is_active && (!a.end_date || a.end_date >= nowStr));
  const expiredAssignments = assignments.filter(a => a.is_active && a.end_date && a.end_date < nowStr);
  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const rejectedRequests = requests.filter(r => r.status === 'REJECTED');

  const hasActiveAccess = activeAssignments.some(a => a.department_code === facultyDepartment);
  const hasPendingRequest = pendingRequests.some(r => r.department_code === facultyDepartment);

  return (
    <div className="space-y-6">
      <div className="border border-blue-100 rounded-md bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">HOD Access</h2>
        
        <div className="space-y-6">
            <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Department</label>
                <div className="text-sm font-medium text-gray-800">{facultyDepartmentName}</div>
            </div>

            <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Current Status</label>
                {activeAssignments.length > 0 ? (
                    <div>
                        {activeAssignments.map(a => (
                        <div key={a.id} className="bg-green-50 border border-green-200 text-green-800 rounded p-4 mb-3">
                            <h3 className="font-bold mb-1">HOD Access Active</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                            <div><span className="text-green-600/80 uppercase text-[10px] tracking-wider block font-black">Department</span>{a.department_code}</div>
                            <div><span className="text-green-600/80 uppercase text-[10px] tracking-wider block font-black">Academic Year</span>{a.academic_year}</div>
                            <div><span className="text-green-600/80 uppercase text-[10px] tracking-wider block font-black">Valid From</span>{formatDate(a.start_date)}</div>
                            <div><span className="text-green-600/80 uppercase text-[10px] tracking-wider block font-black">Valid Until</span>{a.end_date ? formatDate(a.end_date) : 'N/A'}</div>
                            </div>
                        </div>
                        ))}
                    </div>
                ) : pendingRequests.length > 0 ? (
                    <div>
                        {pendingRequests.map(p => (
                        <div key={p.id} className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded p-4 mb-3">
                            <h3 className="font-bold mb-1">Request Pending</h3>
                            <p className="text-sm">Your request for HOD access ({p.department_code}, {p.academic_year}) is pending approval by the Admin.</p>
                        </div>
                        ))}
                    </div>
                ) : expiredAssignments.length > 0 ? (
                    <div>
                        {expiredAssignments.map(a => (
                        <div key={a.id} className="bg-gray-50 border border-gray-200 text-gray-500 rounded p-4 mb-3">
                            <h3 className="font-bold mb-1">HOD Access Expired</h3>
                            <p className="text-sm">Your previous HOD access for {a.department_code} ({a.academic_year}) expired on {formatDate(a.end_date)}.</p>
                        </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm font-medium text-gray-800">Not Assigned</div>
                )}
            </div>
            
            {rejectedRequests.length > 0 && !hasActiveAccess && !hasPendingRequest && (
                <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Previous Requests</label>
                    {rejectedRequests.map(r => (
                    <div key={r.id} className="bg-red-50 border border-red-200 text-red-800 rounded p-4 mb-3">
                        <h3 className="font-bold mb-1">Rejected</h3>
                        <p className="text-sm">Your request for {r.department_code} ({r.academic_year}) was rejected.</p>
                        {r.rejection_reason && <p className="text-sm mt-1">Reason: {r.rejection_reason}</p>}
                        <p className="text-xs text-red-600 mt-2">Reviewed on {formatDate(r.reviewed_at)}</p>
                    </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {!hasActiveAccess && (
        <div className="border border-blue-100 rounded-md bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Request HOD Access</h2>
            <p className="text-sm text-gray-600 mb-6">If you are the designated Head of Department, submit a request below to gain administrative access.</p>
            
            <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div>
                <label htmlFor="acadYear" className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Academic Year</label>
                <AcademicYearSelect
                    id="acadYear"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    required
                    startYear={startYearNumber}
                    numYears={1}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-[#0b3578]/10 outline-none transition-colors"
                />
            </div>

            <button
                type="submit"
                disabled={submitting || hasPendingRequest || facultyDepartment === 'Unknown Department'}
                className="mt-2 w-full py-2.5 bg-[#0b3578] text-white rounded font-semibold text-sm hover:bg-blue-900 transition-colors disabled:opacity-50"
            >
                {submitting ? 'Submitting...' : hasPendingRequest ? 'Request Pending...' : 'Request HOD Access'}
            </button>
            </form>
        </div>
      )}
    </div>
  );
}
