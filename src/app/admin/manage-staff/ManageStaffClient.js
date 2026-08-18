"use client";

import { useState, useMemo } from 'react';
import { useAdmin } from '@/context/AdminContext';
import toast from 'react-hot-toast';

import { FACULTY_BRANCHES } from '@/lib/staff-config';
import { 
  Users, CheckCircle2, XCircle, Search, 
  AlertTriangle, UserX, UserCheck, Save
} from 'lucide-react';

export default function ManageStaffClient() {
  const { staffList, loading, refreshStaff } = useAdmin();
  const [activeTab, setActiveTab] = useState('faculty');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [editedStaff, setEditedStaff] = useState({});
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Filter staffList based on active tab, search query, and branch filter
  const filteredStaffList = useMemo(() => {
    return staffList.filter((staffMember) => {
      // Role match
      const roleMatch = staffMember.roles?.includes(activeTab);
      if (!roleMatch) return false;

      // Branch filter (for faculty)
      if (activeTab === 'faculty' && selectedBranch !== 'ALL') {
        if (!staffMember.branches?.includes(selectedBranch)) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = staffMember.name?.toLowerCase().includes(q);
        const emailMatch = staffMember.email?.toLowerCase().includes(q);
        const empIdMatch = staffMember.employee_id?.toLowerCase().includes(q);
        const branchMatch = staffMember.branches?.some(b => b.toLowerCase().includes(q));
        if (!nameMatch && !emailMatch && !empIdMatch && !branchMatch) return false;
      }

      return true;
    });
  }, [staffList, activeTab, selectedBranch, searchQuery]);

  // Tab Stats Summary
  const stats = useMemo(() => {
    const facultystaffList = staffList.filter(c => c.roles?.includes('faculty'));
    const scholarshipstaffList = staffList.filter(c => c.roles?.includes('scholarship'));
    const admissionstaffList = staffList.filter(c => c.roles?.includes('admission'));
    
    return {
      total: staffList.length,
      active: staffList.filter(c => c.is_active).length,
      inactive: staffList.filter(c => !c.is_active).length,
      facultyTotal: facultystaffList.length,
      scholarshipTotal: scholarshipstaffList.length,
      admissionTotal: admissionstaffList.length,
      hodCount: facultystaffList.filter(c => c.is_hod).length
    };
  }, [staffList]);

  const openDetails = (staffMember) => {
    setSelectedStaff(staffMember);
    setEditedStaff({ ...staffMember });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditedStaff((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleToggleHOD = (e) => {
    setEditedStaff(prev => ({
      ...prev,
      is_hod: e.target.checked
    }));
  };

  const handleSave = async () => {
    if (!selectedStaff) return;
    setProcessing(true);
    const toastId = toast.loading('Saving changes...');
    try {
      const res = await fetch(`/api/admin/staff/${selectedStaff.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedStaff),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update staff record');
      }

      toast.success('Staff record updated successfully!', { id: toastId });
      setSelectedStaff(null);
      setEditedStaff({});
      refreshStaff();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedStaff) return;
    setProcessing(true);
    const toastId = toast.loading('Deactivating staff account...');
    try {
      const res = await fetch(`/api/admin/staff/${selectedStaff.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to deactivate staff account');
      }

      toast.success('Staff account deactivated successfully! You can reactivate it at any time.', { id: toastId });
      setIsDeleteModalOpen(false);
      setSelectedStaff(null);
      refreshStaff();
    } catch (error) {
      toast.error(error.message, { id: toastId });
      setIsDeleteModalOpen(false);
    } finally {
      setProcessing(false);
    }
  };

  const hasChanges = selectedStaff && JSON.stringify(selectedStaff) !== JSON.stringify(editedStaff);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm p-2 sm:p-4">
      <header className="mb-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Staff & Role Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage institutional staff accounts, roles, and status.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center text-[#0b3578] mb-2">
            <Users className="w-5 h-5 mr-2" />
            <h3 className="font-semibold">Total Staff</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center text-green-600 mb-2">
            <CheckCircle2 className="w-5 h-5 mr-2" />
            <h3 className="font-semibold">Active Accounts</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.active}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center text-red-600 mb-2">
            <XCircle className="w-5 h-5 mr-2" />
            <h3 className="font-semibold">Deactivated</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.inactive}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50">
          <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => { setActiveTab('faculty'); setSelectedBranch('ALL'); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'faculty'
                  ? 'bg-blue-50 text-[#0b3578] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              Faculty ({stats.facultyTotal})
            </button>
            <button
              onClick={() => setActiveTab('scholarship')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'scholarship'
                  ? 'bg-emerald-50 text-emerald-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              Scholarship ({stats.scholarshipTotal})
            </button>
            <button
              onClick={() => setActiveTab('admission')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'admission'
                  ? 'bg-cyan-50 text-cyan-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              Admission ({stats.admissionTotal})
            </button>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {activeTab === 'faculty' && (
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#0b3578]"
              >
                <option value="ALL">All Branches</option>
                {FACULTY_BRANCHES.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0b3578] outline-none text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-full">Staff Member</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Emp ID</th>
                {activeTab === 'faculty' && (
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Branch & Role</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={activeTab === 'faculty' ? "5" : "4"} className="px-6 py-8 text-center text-slate-500">Loading staff directory...</td></tr>
              ) : filteredStaffList.length === 0 ? (
                <tr><td colSpan={activeTab === 'faculty' ? "5" : "4"} className="px-6 py-8 text-center text-slate-500">No active staff members found matching criteria.</td></tr>
              ) : (
                filteredStaffList.map((staffMember) => (
                  <tr 
                    key={staffMember.id} 
                    onClick={() => openDetails(staffMember)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-[#0b3578] font-bold">
                          {staffMember.name.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-slate-900">{staffMember.name}</div>
                          <div className="text-sm text-slate-500">{staffMember.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-900 font-mono bg-slate-100 px-2 py-1 rounded border border-slate-200">{staffMember.employee_id}</span>
                    </td>
                    {activeTab === 'faculty' && (
                      <td className="px-6 py-4">
                        <div className="flex flex-row items-center gap-1.5 flex-wrap">
                          {staffMember.branches && staffMember.branches.length > 0 ? (
                            staffMember.branches.map(b => (
                              <span key={b} className="font-bold text-[#0b3578] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px] whitespace-nowrap inline-flex">
                                {b}
                              </span>
                            ))
                          ) : (
                            <span className="font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                              Unassigned
                            </span>
                          )}
                          {staffMember.is_hod && (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider shadow-xs whitespace-nowrap inline-flex">
                              👑 HOD
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {staffMember.is_active ? (
                        <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                          <UserCheck className="w-3 h-3 mr-1" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-md border border-red-200">
                          <UserX className="w-3 h-3 mr-1" /> Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={(e) => { e.stopPropagation(); openDetails(staffMember); }}
                        className="text-[#0b3578] hover:text-blue-900 font-medium cursor-pointer"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unified Action Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={() => {
              if (!processing && !isDeleteModalOpen) setSelectedStaff(null);
            }}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="relative z-10 inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full border border-slate-200">
              
              {!isDeleteModalOpen ? (
                <>
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start">
                      <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                        <h3 className="text-xl leading-6 font-semibold text-slate-900 mb-6 flex justify-between items-center" id="modal-title">
                          Manage Staff Account
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded border border-slate-200 font-mono">
                              ID: #{selectedStaff.id}
                            </span>
                          </div>
                        </h3>
                        
                        <div className="bg-slate-50 rounded-lg p-5 grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 border border-slate-100 mb-6">
                          <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                            <input
                              type="text"
                              name="name"
                              value={editedStaff.name ?? ''}
                              onChange={handleChange}
                              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Official Email</label>
                            <input
                              type="email"
                              name="email"
                              value={editedStaff.email ?? ''}
                              readOnly
                              disabled
                              className="w-full border border-slate-200 rounded px-3 py-2 text-sm bg-slate-100 text-slate-500 cursor-not-allowed outline-none"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">Email cannot be edited directly.</p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Employee ID</label>
                            <input
                              type="text"
                              name="employee_id"
                              value={editedStaff.employee_id ?? ''}
                              onChange={handleChange}
                              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none bg-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Account Status</label>
                            <div className="flex items-center h-[38px]">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  name="is_active" 
                                  checked={editedStaff.is_active || false} 
                                  onChange={handleChange}
                                  className="sr-only peer" 
                                />
                                <div className="w-11 h-6 bg-red-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                <span className="ml-3 text-sm font-medium text-slate-700">
                                  {editedStaff.is_active ? 'Active' : 'Disabled'}
                                </span>
                              </label>
                            </div>
                            {!editedStaff.is_active && (
                              <p className="text-[10px] text-red-600 mt-1 flex items-center">
                                <AlertTriangle className="w-3 h-3 mr-1 inline" /> Account disabled. User cannot log in.
                              </p>
                            )}
                          </div>
                        </div>

                        {activeTab === 'faculty' && (
                          <div className="bg-slate-50 rounded-lg p-5 border border-slate-100 mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="w-full">
                              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Academic Branches</label>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {FACULTY_BRANCHES.map(b => (
                                  <label key={b} className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 rounded px-3 py-2 hover:bg-slate-50">
                                    <input
                                      type="checkbox"
                                      className="rounded border-slate-300 text-[#0b3578] focus:ring-[#0b3578]"
                                      checked={editedStaff.branches?.includes(b) || false}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setEditedStaff(prev => {
                                          const currentBranches = prev.branches || [];
                                          if (checked) {
                                            return { ...prev, branches: [...currentBranches, b] };
                                          } else {
                                            return { ...prev, branches: currentBranches.filter(branch => branch !== b) };
                                          }
                                        });
                                      }}
                                    />
                                    <span className="text-sm font-medium text-slate-700">{b}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="w-full">
                              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">HOD Status</label>
                              <div className="flex items-center h-[38px]">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={editedStaff.is_hod || false} 
                                    onChange={handleToggleHOD}
                                    className="sr-only peer" 
                                  />
                                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                  <span className="ml-3 text-sm font-medium text-slate-700">
                                    {editedStaff.is_hod ? 'Head of Department' : 'Regular Faculty'}
                                  </span>
                                </label>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="border border-slate-200 bg-slate-50 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                          <div>
                            <h4 className="text-sm font-semibold text-slate-800 flex items-center">
                              <AlertTriangle className="w-4 h-4 mr-2 text-amber-600" /> Account Access Control
                            </h4>
                            <p className="text-xs text-slate-600 mt-1">
                              {editedStaff.is_active 
                                ? 'Deactivating revokes active sessions while preserving institutional history.' 
                                : 'This account is currently deactivated. You can reactivate it at any time.'}
                            </p>
                          </div>
                          {editedStaff.is_active ? (
                            <button
                              onClick={() => setIsDeleteModalOpen(true)}
                              className="px-3 py-1.5 bg-white border border-red-300 text-red-600 rounded text-sm font-medium hover:bg-red-50 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              Deactivate Account
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setEditedStaff(prev => ({ ...prev, is_active: true }));
                                toast.success('Status set to Active. Click "Save Changes" to apply.');
                              }}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              Reactivate Account
                            </button>
                          )}
                        </div>

                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={processing || !hasChanges}
                      className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[#0b3578] text-base font-medium text-white hover:bg-blue-900 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Save className="w-4 h-4 mr-2" /> Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStaff(null)}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="bg-amber-50 px-4 py-5 sm:p-6 border-t border-amber-200">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-6 w-6 text-amber-600" aria-hidden="true" />
                    </div>
                    <div className="ml-3 w-full">
                      <h3 className="text-sm font-medium text-amber-900">Deactivate Staff Account</h3>
                      <div className="mt-2 text-sm text-amber-800 space-y-2">
                        <p>Are you sure you want to deactivate <strong>{selectedStaff.name}</strong>?</p>
                        <p>Their account will be set to <strong>Suspended</strong>, active sessions will be terminated, and they will be prevented from logging in. <br/><strong>All student records, audit history, and academic assignments are safely preserved, and this account can be reactivated at any time.</strong></p>
                      </div>
                      <div className="mt-4 flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={processing}
                          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-amber-600 text-base font-medium text-white hover:bg-amber-700 sm:w-auto sm:text-sm disabled:opacity-50 cursor-pointer"
                        >
                          {processing ? 'Deactivating...' : 'Confirm Deactivation'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsDeleteModalOpen(false)}
                          disabled={processing}
                          className="w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 sm:w-auto sm:text-sm disabled:opacity-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
