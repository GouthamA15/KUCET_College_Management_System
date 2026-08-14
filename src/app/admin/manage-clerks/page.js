"use client";

import { useState, useMemo } from 'react';
import { useAdmin } from '@/context/AdminContext';
import toast from 'react-hot-toast';
import PendingClerkRequests from '@/components/admin/PendingClerkRequests';
import { FACULTY_BRANCHES } from '@/lib/staff-config';

export default function ManageStaffPage() {
  const { clerks, loading, refreshClerks } = useAdmin();
  const [activeTab, setActiveTab] = useState('faculty'); // 'faculty' | 'scholarship' | 'admission'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [editingClerkId, setEditingClerkId] = useState(null);
  const [editedClerk, setEditedClerk] = useState({});

  // Map active tab to staff category for pending requests
  const categoryFilterMap = {
    faculty: 'FACULTY',
    scholarship: 'SCHOLARSHIP_CLERK',
    admission: 'ADMISSION_CLERK',
  };

  // Filter clerks based on active tab, search query, and branch filter
  const filteredClerks = useMemo(() => {
    return clerks.filter((clerk) => {
      // Role match
      const roleMatch = clerk.role === activeTab;
      if (!roleMatch) return false;

      // Branch filter (for faculty)
      if (activeTab === 'faculty' && selectedBranch !== 'ALL') {
        if (clerk.branch !== selectedBranch) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = clerk.name?.toLowerCase().includes(q);
        const emailMatch = clerk.email?.toLowerCase().includes(q);
        const empIdMatch = clerk.employee_id?.toLowerCase().includes(q);
        const branchMatch = clerk.branch?.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !empIdMatch && !branchMatch) return false;
      }

      return true;
    });
  }, [clerks, activeTab, selectedBranch, searchQuery]);

  // Tab Stats Summary
  const stats = useMemo(() => {
    const facultyClerks = clerks.filter(c => c.role === 'faculty');
    const scholarshipClerks = clerks.filter(c => c.role === 'scholarship');
    const admissionClerks = clerks.filter(c => c.role === 'admission');
    const hodCount = facultyClerks.filter(c => c.is_hod).length;

    return {
      facultyTotal: facultyClerks.length,
      facultyActive: facultyClerks.filter(c => c.is_active).length,
      hodCount,
      scholarshipTotal: scholarshipClerks.length,
      scholarshipActive: scholarshipClerks.filter(c => c.is_active).length,
      admissionTotal: admissionClerks.length,
      admissionActive: admissionClerks.filter(c => c.is_active).length,
    };
  }, [clerks]);

  const handleEdit = (clerk) => {
    setEditingClerkId(clerk.id);
    setEditedClerk({ ...clerk });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditedClerk((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async (id) => {
    const toastId = toast.loading('Saving changes...');
    try {
      const res = await fetch(`/api/admin/clerks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedClerk),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update staff record');
      }

      toast.success('Staff record updated successfully!', { id: toastId });
      setEditingClerkId(null);
      setEditedClerk({});
      refreshClerks();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  };

  const handleToggleHOD = async (clerk, targetIsHOD) => {
    const actionName = targetIsHOD ? 'Assign HOD' : 'Remove HOD';
    if (!confirm(`Are you sure you want to ${actionName} status for ${clerk.name} (${clerk.branch || 'No branch'})?`)) {
      return;
    }

    const toastId = toast.loading(`${actionName}...`);
    try {
      const res = await fetch(`/api/admin/clerks/${clerk.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_hod: targetIsHOD,
          branch: clerk.branch,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${actionName.toLowerCase()}`);
      }

      toast.success(`${clerk.name} is now ${targetIsHOD ? `HOD of ${clerk.branch}` : 'reverted to Faculty'}`, { id: toastId });
      refreshClerks();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to deactivate this staff account?')) {
      return;
    }

    const toastId = toast.loading('Deactivating staff account...');
    try {
      const res = await fetch(`/api/admin/clerks/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete staff account');
      }

      toast.success('Staff account deactivated successfully!', { id: toastId });
      refreshClerks();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-full max-w-6xl mx-auto bg-white border border-slate-200 shadow-sm p-8 text-center">
          <p className="text-slate-500 animate-pulse uppercase text-xs font-bold tracking-widest">Loading institutional staff directories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-2 sm:p-4">
      <div className="w-full max-w-6xl mx-auto space-y-6">
        
        {/* Page Header */}
        <div className="bg-[#0b3578] text-white p-5 rounded-lg shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tight">Institutional Staff & Role Management</h1>
            <p className="text-xs text-blue-100 mt-1">
              Manage Faculty, HOD promotions, Scholarship Clerks, and Admission Clerks with zero-trust RBAC isolation.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded text-xs">
            <span className="font-semibold text-amber-300">{stats.facultyTotal}</span> Faculty ({stats.hodCount} HODs) |{' '}
            <span className="font-semibold text-emerald-300">{stats.scholarshipTotal}</span> Scholarship |{' '}
            <span className="font-semibold text-cyan-300">{stats.admissionTotal}</span> Admission
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex border-b border-slate-200 bg-white rounded-t-lg overflow-x-auto shadow-sm">
          <button
            onClick={() => { setActiveTab('faculty'); setSelectedBranch('ALL'); }}
            className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'faculty'
                ? 'border-[#0b3578] text-[#0b3578] bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>🎓 Academic Faculty ({stats.facultyTotal})</span>
            {stats.hodCount > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-mono">{stats.hodCount} HODs</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('scholarship')}
            className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'scholarship'
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>💰 Scholarship Clerks ({stats.scholarshipTotal})</span>
          </button>

          <button
            onClick={() => setActiveTab('admission')}
            className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'admission'
                ? 'border-cyan-600 text-cyan-800 bg-cyan-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>📝 Admission Clerks ({stats.admissionTotal})</span>
          </button>
        </div>

        {/* Pending Requests Component scoped to current tab */}
        <PendingClerkRequests
          onRequestAction={refreshClerks}
          categoryFilter={categoryFilterMap[activeTab]}
        />

        {/* Directory Controls & Table Container */}
        <div className="bg-white border border-slate-200 shadow-sm p-4 sm:p-6 rounded-b-lg">
          
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-full sm:w-auto flex items-center gap-2">
              <input
                type="text"
                placeholder={`Search ${activeTab} staff by name, email, ID...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-72 px-3 py-2 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-[#0b3578]"
              />
            </div>

            {/* Branch Filter for Faculty Tab */}
            {activeTab === 'faculty' && (
              <div className="w-full sm:w-auto flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Branch Filter:</span>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded text-xs bg-white font-medium text-slate-700 focus:ring-2 focus:ring-[#0b3578]"
                >
                  <option value="ALL">All Academic Branches ({stats.facultyTotal})</option>
                  {FACULTY_BRANCHES.map(b => (
                    <option key={b} value={b}>{b} Branch</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Directory Table */}
          {filteredClerks.length === 0 ? (
            <div className="text-center py-8 text-slate-500 italic text-sm">
              No active {activeTab} staff members found matching your search criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-slate-200">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="py-3 px-4 border-b border-slate-200 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">ID</th>
                    <th className="py-3 px-4 border-b border-slate-200 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Name</th>
                    <th className="py-3 px-4 border-b border-slate-200 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email</th>
                    <th className="py-3 px-4 border-b border-slate-200 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Emp ID</th>
                    {activeTab === 'faculty' && (
                      <th className="py-3 px-4 border-b border-slate-200 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Branch & HOD Status</th>
                    )}
                    <th className="py-3 px-4 border-b border-slate-200 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="py-3 px-4 border-b border-slate-200 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClerks.map((clerk) => (
                    <tr key={clerk.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-[11px] text-slate-400 font-mono">#{clerk.id}</td>
                      <td className="py-3 px-4 text-xs font-bold text-slate-800">
                        {editingClerkId === clerk.id ? (
                          <input
                            type="text"
                            name="name"
                            value={editedClerk.name ?? ''}
                            onChange={handleChange}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                          />
                        ) : (
                          clerk.name
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-[150px] truncate">
                        {editingClerkId === clerk.id ? (
                          <input
                            type="email"
                            name="email"
                            value={editedClerk.email ?? ''}
                            onChange={handleChange}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                          />
                        ) : (
                          clerk.email
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 font-mono">
                        {editingClerkId === clerk.id ? (
                          <input
                            type="text"
                            name="employee_id"
                            value={editedClerk.employee_id ?? ''}
                            onChange={handleChange}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                          />
                        ) : (
                          clerk.employee_id
                        )}
                      </td>

                      {activeTab === 'faculty' && (
                        <td className="py-3 px-4 text-xs">
                          {editingClerkId === clerk.id ? (
                            <select
                              name="branch"
                              value={editedClerk.branch ?? 'CSE'}
                              onChange={handleChange}
                              className="border border-slate-300 rounded px-2 py-1 text-xs bg-white"
                            >
                              {FACULTY_BRANCHES.map(b => (
                                <option key={b} value={b}>{b}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#0b3578] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px]">
                                {clerk.branch || 'Unassigned'}
                              </span>
                              {clerk.is_hod && (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider shadow-xs">
                                  👑 HOD
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      )}

                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                          clerk.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {clerk.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {activeTab === 'faculty' && (
                            <>
                              {clerk.is_hod ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleHOD(clerk, false)}
                                  className="text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded transition-colors"
                                  title="Remove HOD status and revert to Faculty"
                                >
                                  Demote HOD
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleHOD(clerk, true)}
                                  className="text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded transition-colors"
                                  title="Promote Faculty member to Head of Department (HOD)"
                                >
                                  Promote HOD
                                </button>
                              )}
                            </>
                          )}

                          {editingClerkId === clerk.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSave(clerk.id)}
                                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 border border-emerald-200 px-2 py-1 rounded bg-emerald-50"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => { setEditingClerkId(null); setEditedClerk({}); }}
                                className="text-[11px] font-medium text-slate-500 hover:text-slate-700 border border-slate-200 px-2 py-1 rounded"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleEdit(clerk)}
                                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 border border-slate-200 px-2 py-1 rounded hover:bg-slate-100"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(clerk.id)}
                                className="text-[11px] font-bold text-red-600 hover:text-red-800 border border-red-200 px-2 py-1 rounded hover:bg-red-50"
                              >
                                Deactivate
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}