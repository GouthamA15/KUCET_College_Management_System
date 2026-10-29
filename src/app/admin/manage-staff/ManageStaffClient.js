"use client";

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/context/AdminContext';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/date';

import { FACULTY_BRANCHES } from '@/lib/staff-config';
import { 
  Users, CheckCircle2, Search, 
  AlertTriangle, UserX, UserCheck, Save,
  ShieldCheck, BookOpen, ExternalLink, Award, GraduationCap, X
} from 'lucide-react';

export default function ManageStaffClient() {
  const { staffList, activeHodDirectory = {}, loading, updateStaffInList, setStaffActiveStatus, refreshStaff } = useAdmin();
  const [activeTab, setActiveTab] = useState('faculty');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [editedStaff, setEditedStaff] = useState({});
  const [staffRequestsHistory, setStaffRequestsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [reassignConfirmModal, setReassignConfirmModal] = useState({
    isOpen: false,
    branch: '',
    currentHod: '',
    academicYear: '',
    newHodName: ''
  });
  const [processing, setProcessing] = useState(false);

  // Coordinator Modal State
  const [isCoordModalOpen, setIsCoordModalOpen] = useState(false);
  const [coordAssignments, setCoordAssignments] = useState([]);
  const [loadingCoord, setLoadingCoord] = useState(false);
  const [coordActionLoading, setCoordActionLoading] = useState(false);
  const [showNewCoordForm, setShowNewCoordForm] = useState(false);
  const [newCoordData, setNewCoordData] = useState({
    staff_account_id: '',
    academic_year: '2024-2025',
    start_date: new Date().toISOString().split('T')[0],
    end_date: ''
  });

  // Resiliently fetch staff list on mount if empty
  useEffect(() => {
    let ignore = false;
    if (typeof refreshStaff === 'function' && staffList.length === 0 && !loading) {
      Promise.resolve().then(() => {
        if (!ignore) {
          refreshStaff();
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [refreshStaff, staffList.length, loading]);

  const fetchCoordinatorAssignments = async () => {
    setLoadingCoord(true);
    try {
      const res = await fetch('/api/admin/coordinator-assignments');
      const json = await res.json();
      if (res.ok) {
        setCoordAssignments(json.data || []);
        if (json.currentAcademicYear) {
          setNewCoordData(prev => ({ ...prev, academic_year: json.currentAcademicYear }));
        }
      } else {
        toast.error(json.error || 'Failed to load coordinator assignments');
      }
    } catch (_err) {
      toast.error('Failed to load coordinator assignments');
    } finally {
      setLoadingCoord(false);
    }
  };

  const handleRevokeCoord = async (assignmentId) => {
    if (!confirm('Are you sure you want to revoke this First Year Coordinator assignment?')) return;
    setCoordActionLoading(true);
    try {
      const res = await fetch(`/api/admin/coordinator-assignments/${assignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REVOKE' })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to revoke assignment');
      toast.success('Coordinator assignment revoked');
      await fetchCoordinatorAssignments();
      if (refreshStaff) await refreshStaff();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCoordActionLoading(false);
    }
  };

  const handleCreateCoordAssignment = async (e) => {
    e.preventDefault();
    if (!newCoordData.staff_account_id) {
      toast.error('Please select a faculty member');
      return;
    }
    setCoordActionLoading(true);
    try {
      const res = await fetch('/api/admin/coordinator-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCoordData)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create assignment');
      toast.success('First Year Coordinator appointed successfully');
      setShowNewCoordForm(false);
      await fetchCoordinatorAssignments();
      if (refreshStaff) await refreshStaff();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCoordActionLoading(false);
    }
  };

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
      hodCount: facultystaffList.filter(c => c.is_hod || (c.hod_branches && c.hod_branches.length > 0)).length,
      principalCount: facultystaffList.filter(c => c.is_principal).length,
      coordCount: facultystaffList.filter(c => c.is_first_year_coordinator).length
    };
  }, [staffList]);

  const openDetails = async (staffMember) => {
    setSelectedStaff(staffMember);
    setEditedStaff({
      ...staffMember,
      branches: Array.isArray(staffMember.branches) ? [...staffMember.branches] : [],
      hod_branches: Array.isArray(staffMember.hod_branches) ? [...staffMember.hod_branches] : (staffMember.is_hod && staffMember.branches ? [...staffMember.branches] : []),
      is_principal: !!staffMember.is_principal,
      is_first_year_coordinator: !!staffMember.is_first_year_coordinator,
      coordinator_start_date: staffMember.coordinator_assignment?.start_date || new Date().toISOString().split('T')[0],
      coordinator_end_date: staffMember.coordinator_assignment?.end_date || ''
    });
    
    // Fetch their latest requests
    setLoadingHistory(true);
    setStaffRequestsHistory([]);
    try {
      const res = await fetch('/api/admin/hod-requests');
      const data = await res.json();
      if (res.ok && data.requests) {
        const theirRequests = data.requests.filter(r => r.staff_account_id === staffMember.id);
        setStaffRequestsHistory(theirRequests);
      }
    } catch (err) {
      console.error('Failed to fetch requests history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditedStaff((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleToggleHodBranch = (branchCode) => {
    setEditedStaff((prev) => {
      const current = prev.hod_branches || [];
      const updated = current.includes(branchCode)
        ? current.filter(b => b !== branchCode)
        : [...current, branchCode];
      return {
        ...prev,
        hod_branches: updated,
        is_hod: updated.length > 0
      };
    });
  };

  const handleTogglePrincipal = (e) => {
    const checked = e.target.checked;
    setEditedStaff((prev) => ({
      ...prev,
      is_principal: checked
    }));
  };

  const handleSave = async (confirmedReassignBranches = null) => {
    if (!selectedStaff) return;

    setProcessing(true);
    const toastId = toast.loading('Saving staff changes...');
    try {
      const payload = {
        ...editedStaff,
        is_hod: (editedStaff.hod_branches && editedStaff.hod_branches.length > 0) || !!editedStaff.is_hod,
        is_first_year_coordinator: !!editedStaff.is_first_year_coordinator,
        coordinator_start_date: editedStaff.coordinator_start_date,
        coordinator_end_date: editedStaff.coordinator_end_date || null,
        ...(confirmedReassignBranches && confirmedReassignBranches.length > 0 
          ? { reassign_branches: confirmedReassignBranches } 
          : {})
      };

      const res = await fetch(`/api/admin/staff/${selectedStaff.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.conflictDetails) {
          toast.dismiss(toastId);
          setReassignConfirmModal({
            isOpen: true,
            branch: data.conflictDetails.branch,
            currentHod: data.conflictDetails.current_hod,
            academicYear: data.conflictDetails.academic_year,
            newHodName: editedStaff.name || selectedStaff.name
          });
          return;
        }
        throw new Error(data.error || 'Failed to update staff record');
      }

      if (data.data && typeof updateStaffInList === 'function') {
        updateStaffInList(data.data);
      }

      // Refresh list to update all states & HOD directory
      if (typeof refreshStaff === 'function') {
        await refreshStaff();
      } else {
        const fetchRes = await fetch('/api/admin/staff');
        const fetchData = await fetchRes.json();
        if (fetchRes.ok && fetchData.data) {
          const updatedStaff = fetchData.data.find(s => s.id === selectedStaff.id);
          if (updatedStaff) {
            updateStaffInList(updatedStaff);
          }
        }
      }

      toast.success('Staff record updated successfully!', { id: toastId });
      setReassignConfirmModal({ isOpen: false, branch: '', currentHod: '', academicYear: '', newHodName: '' });
      setSelectedStaff(null);
      setEditedStaff({});
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

      setStaffActiveStatus(selectedStaff.id, false);

      toast.success('Staff account deactivated successfully!', { id: toastId });
      setIsDeleteModalOpen(false);
      setSelectedStaff(null);
    } catch (error) {
      toast.error(error.message, { id: toastId });
      setIsDeleteModalOpen(false);
    } finally {
      setProcessing(false);
    }
  };

  const hasChanges = selectedStaff && (
    selectedStaff.name !== editedStaff.name ||
    selectedStaff.employee_id !== editedStaff.employee_id ||
    selectedStaff.is_active !== editedStaff.is_active ||
    selectedStaff.is_principal !== editedStaff.is_principal ||
    selectedStaff.is_first_year_coordinator !== editedStaff.is_first_year_coordinator ||
    selectedStaff.coordinator_start_date !== editedStaff.coordinator_start_date ||
    selectedStaff.coordinator_end_date !== editedStaff.coordinator_end_date ||
    JSON.stringify((selectedStaff.branches || []).sort()) !== JSON.stringify((editedStaff.branches || []).sort()) ||
    JSON.stringify((selectedStaff.hod_branches || []).sort()) !== JSON.stringify((editedStaff.hod_branches || []).sort()) ||
    JSON.stringify((selectedStaff.roles || []).sort()) !== JSON.stringify((editedStaff.roles || []).sort())
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
      <header className="mb-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Staff & Role Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage institutional staff accounts, branch HOD appointments, academic affiliations, and supervisory roles.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIsCoordModalOpen(true);
              fetchCoordinatorAssignments();
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <GraduationCap className="w-4 h-4 text-sky-600" />
            <span>1st Year Coordinators ({stats.coordCount})</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
          <div className="flex items-center text-amber-600 mb-2">
            <Award className="w-5 h-5 mr-2" />
            <h3 className="font-semibold">Branch HODs</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.hodCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center text-purple-600 mb-2">
            <ShieldCheck className="w-5 h-5 mr-2" />
            <h3 className="font-semibold">Principal Sup.</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.principalCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center text-sky-600 mb-2">
            <GraduationCap className="w-5 h-5 mr-2" />
            <h3 className="font-semibold">1st Year Coord</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.coordCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50">
          <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => { setActiveTab('faculty'); setSelectedBranch('ALL'); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'faculty'
                  ? 'bg-blue-50 text-[#0b3578] shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              Faculty ({stats.facultyTotal})
            </button>
            <button
              onClick={() => setActiveTab('scholarship')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'scholarship'
                  ? 'bg-emerald-50 text-emerald-800 shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              Scholarship ({stats.scholarshipTotal})
            </button>
            <button
              onClick={() => setActiveTab('admission')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'admission'
                  ? 'bg-cyan-50 text-cyan-800 shadow-sm font-semibold'
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-2/5">Staff Member</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Emp ID</th>
                {activeTab === 'faculty' && (
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Branch & Roles</th>
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
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Academic Affiliation Chips */}
                          {staffMember.branches && staffMember.branches.length > 0 ? (
                            staffMember.branches.map(b => (
                              <span key={b} className="font-semibold text-[#0b3578] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px] whitespace-nowrap inline-flex shrink-0">
                                {b}
                              </span>
                            ))
                          ) : (
                            <span className="font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[11px] shrink-0">
                              Unassigned
                            </span>
                          )}

                          {/* Branch-Specific HOD Badges */}
                          {staffMember.hod_branches && staffMember.hod_branches.length > 0 ? (
                            staffMember.hod_branches.map(b => (
                              <span key={`hod-${b}`} className="bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider shadow-xs whitespace-nowrap inline-flex items-center gap-0.5 shrink-0">
                                👑 HOD ({b})
                              </span>
                            ))
                          ) : staffMember.is_hod ? (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider shadow-xs whitespace-nowrap inline-flex shrink-0">
                              👑 HOD
                            </span>
                          ) : null}

                          {/* Principal Supervisor Badge */}
                          {staffMember.is_principal && (
                            <span className="bg-purple-100 text-purple-900 border border-purple-300 font-extrabold text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider shadow-xs whitespace-nowrap inline-flex items-center gap-0.5 shrink-0">
                              🏛️ Principal Supervisor
                            </span>
                          )}

                          {/* First Year Coordinator Badge */}
                          {staffMember.is_first_year_coordinator && (
                            <span className="bg-sky-100 text-sky-900 border border-sky-300 font-extrabold text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider shadow-xs whitespace-nowrap inline-flex items-center gap-0.5 shrink-0">
                              🎓 1st Year Coord
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
              if (!processing && !isDeleteModalOpen && !reassignConfirmModal.isOpen) setSelectedStaff(null);
            }}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="relative z-10 inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl w-full border border-slate-200">
              
              {!isDeleteModalOpen && (
                <>
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 max-h-[85vh] overflow-y-auto">
                    <div className="sm:flex sm:items-start">
                      <div className="mt-3 text-center sm:mt-0 sm:text-left w-full space-y-6">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                          <h3 className="text-xl font-bold text-slate-900" id="modal-title">
                            Manage Staff Account & Assignments
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md border border-slate-200 font-mono">
                              Staff ID: #{selectedStaff.id}
                            </span>
                          </div>
                        </div>
                        
                        {/* Section 1: Staff Account & Activation Status */}
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            1. Account Information & Status
                          </h4>
                          <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border border-slate-200">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                              <input
                                type="text"
                                name="name"
                                value={editedStaff.name ?? ''}
                                onChange={handleChange}
                                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none bg-white font-medium"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Official Email</label>
                              <input
                                type="email"
                                name="email"
                                value={editedStaff.email ?? ''}
                                readOnly
                                disabled
                                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-slate-100 text-slate-500 cursor-not-allowed outline-none"
                              />
                              <p className="text-[10px] text-slate-400 mt-1">Official email is fixed to login identity.</p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Employee ID</label>
                              <input
                                type="text"
                                name="employee_id"
                                value={editedStaff.employee_id ?? ''}
                                onChange={handleChange}
                                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none bg-white font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Account Active Status</label>
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
                                  <span className="ml-3 text-sm font-semibold text-slate-700">
                                    {editedStaff.is_active ? 'Active' : 'Disabled'}
                                  </span>
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>

                        {activeTab === 'faculty' && (
                          <>
                            {/* Section 2: Academic Branch Affiliations */}
                            <div>
                              <div className="flex justify-between items-baseline mb-1">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                  2. Academic Branch Affiliations (Home Department)
                                </h4>
                              </div>
                              <p className="text-xs text-slate-500 mb-2.5">
                                Academic affiliations denote the faculty member&apos;s home department. Teaching assignments are managed independently and faculty can teach across any department or semester.
                              </p>
                              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                <div className="grid grid-cols-3 gap-3">
                                  {FACULTY_BRANCHES.map(b => {
                                    const isAffiliated = editedStaff.branches?.includes(b) || false;
                                    return (
                                      <label 
                                        key={b} 
                                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                                          isAffiliated 
                                            ? 'bg-blue-50/70 border-blue-300 text-[#0b3578]' 
                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5">
                                          <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-[#0b3578] focus:ring-[#0b3578]"
                                            checked={isAffiliated}
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
                                          <span className="font-bold text-sm">{b}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 uppercase font-semibold">
                                          {isAffiliated ? 'Affiliated' : 'Optional'}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Section 3: Teaching Assignments */}
                            <div>
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                3. Faculty Teaching Assignments
                              </h4>
                              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-blue-100 rounded-lg text-[#0b3578]">
                                    <BookOpen className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-slate-800">
                                      Cross-Branch Teaching Eligibility
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      Active faculty are eligible to teach courses across any department (CSE, IT, CSD) without requiring HOD assignment or affiliation change.
                                    </p>
                                  </div>
                                </div>
                                <Link
                                  href="/staff/faculty/academics"
                                  target="_blank"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 rounded-md text-xs font-semibold shadow-xs whitespace-nowrap"
                                >
                                  View Subject Assignments <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                              </div>
                            </div>

                            {/* Section 4: Branch-HOD Appointments */}
                            <div>
                              <div className="flex justify-between items-baseline mb-1">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                  4. Branch-Specific HOD Appointments
                                </h4>
                              </div>
                              <p className="text-xs text-slate-500 mb-2.5">
                                Select branches where this faculty member serves as the active Head of Department. A faculty member can hold multiple HOD appointments if authorized.
                              </p>
                              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
                                {FACULTY_BRANCHES.map(b => {
                                  const isAssignedHod = (editedStaff.hod_branches || []).includes(b);
                                  const currentActive = activeHodDirectory[b];
                                  const isSelfActive = currentActive && currentActive.staff_id === selectedStaff.id;
                                  const isOtherActive = currentActive && currentActive.staff_id !== selectedStaff.id;

                                  return (
                                    <div
                                      key={b}
                                      className={`p-3 rounded-lg border transition-all ${
                                        isAssignedHod 
                                          ? 'bg-amber-50/70 border-amber-300' 
                                          : 'bg-white border-slate-200'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                            checked={isAssignedHod}
                                            onChange={() => handleToggleHodBranch(b)}
                                          />
                                          <div>
                                            <span className="font-bold text-sm text-slate-900">
                                              Head of Department — {b}
                                            </span>
                                            <p className="text-[11px] text-slate-500">
                                              {b === 'CSE' && 'Computer Science & Engineering'}
                                              {b === 'IT' && 'Information Technology'}
                                              {b === 'CSD' && 'Computer Science and Design'}
                                            </p>
                                          </div>
                                        </label>

                                        {/* Status Tag */}
                                        <div>
                                          {isSelfActive ? (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                              <CheckCircle2 className="w-3.5 h-3.5" /> Current Active HOD
                                            </span>
                                          ) : isOtherActive ? (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                              Active: <strong className="text-slate-800">{currentActive.name}</strong> ({currentActive.academic_year})
                                            </span>
                                          ) : (
                                            <span className="text-[11px] text-slate-400 italic">
                                              Vacant
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Conflict Warning Preview */}
                                      {isAssignedHod && isOtherActive && !isSelfActive && (
                                        <div className="mt-2.5 pt-2 border-t border-amber-200/60 flex items-center gap-2 text-xs text-amber-800">
                                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                          <span>
                                            Saving will prompt confirmation to reassign <strong>{b} HOD</strong> from <strong>{currentActive.name}</strong> to <strong>{editedStaff.name}</strong>. Previous HOD remains an active faculty member.
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Section 5: Principal-Level Supervisory Designation */}
                            <div>
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                5. Principal-Level Supervisory Designation
                              </h4>
                              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                <label className="flex items-start gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="mt-1 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                    checked={editedStaff.is_principal || false}
                                    onChange={handleTogglePrincipal}
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-sm text-slate-900">
                                        Principal / Multi-Branch Academic Supervisor
                                      </span>
                                      <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-200">
                                        CSE + IT + CSD
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-600 mt-1">
                                      Grants cross-departmental supervisory authority across all three branches (CSE, IT, CSD) for timetable, faculty load, attendance analytics, student requests, and academic exceptions.
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-1 italic">
                                      Note: This supervisory role operates within the Staff Portal without granting institution-wide Super Admin access or requiring a separate login.
                                    </p>
                                  </div>
                                </label>
                              </div>

                              {/* First Year Coordinator Section */}
                              <div className="bg-sky-50/60 rounded-lg p-5 border border-sky-100">
                                <label className="flex items-start gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    name="is_first_year_coordinator"
                                    checked={!!editedStaff.is_first_year_coordinator}
                                    onChange={handleChange}
                                    className="mt-1 h-4 w-4 text-sky-600 focus:ring-sky-500 border-slate-300 rounded cursor-pointer"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold text-slate-800">
                                        First Year Coordinator
                                      </span>
                                      <span className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded border border-sky-200">
                                        All Branches (Sem 1 & 2)
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-600 mt-1">
                                      Grants cross-branch authority over Semesters 1 and 2 across all institutional branches (CSE, IT, CSD, ECE, EEE, CIVIL, MECH). Responsible for 1st-year subjects, syllabi, timetables, faculty subject-interest reviews, and 1st-year student ID cards.
                                    </p>
                                    
                                    {editedStaff.is_first_year_coordinator && (
                                      <div className="mt-3 pt-3 border-t border-sky-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                            Appointment Start Date
                                          </label>
                                          <input
                                            type="date"
                                            name="coordinator_start_date"
                                            value={editedStaff.coordinator_start_date || ''}
                                            onChange={handleChange}
                                            className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:border-sky-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                            Appointment End Date (Optional)
                                          </label>
                                          <input
                                            type="date"
                                            name="coordinator_end_date"
                                            value={editedStaff.coordinator_end_date || ''}
                                            onChange={handleChange}
                                            className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:border-sky-500"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </label>
                              </div>
                            </div>
                          </>
                        )}

                        {activeTab !== 'faculty' && (
                          <div className="bg-slate-50 rounded-lg p-5 border border-slate-100">
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Administrative Role</label>
                            <select
                               className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-[#0b3578] outline-none bg-white"
                               value={editedStaff.roles?.find(r => ['admission', 'scholarship'].includes(r)) || ''}
                               onChange={(e) => {
                                 const newRole = e.target.value;
                                 setEditedStaff(prev => {
                                   const otherRoles = prev.roles?.filter(r => !['admission', 'scholarship'].includes(r)) || [];
                                   return { ...prev, roles: [...otherRoles, newRole] };
                                 });
                               }}
                            >
                               <option value="admission">Admission Staff</option>
                               <option value="scholarship">Scholarship Staff</option>
                            </select>
                            <p className="text-[10px] text-slate-500 mt-2">Non-teaching staff can be reassigned between administrative departments.</p>
                          </div>
                        )}
                          
                        {/* HOD Requests History Section */}
                        {selectedStaff?.roles?.includes('faculty') && (
                          <div className="mt-6">
                            <h4 className="text-sm font-semibold text-slate-800 mb-3 border-b border-slate-200 pb-2">HOD Request History</h4>
                            {loadingHistory ? (
                              <p className="text-xs text-slate-500">Loading history...</p>
                            ) : staffRequestsHistory.length === 0 ? (
                              <p className="text-xs text-slate-500 italic">No previous HOD requests found for this staff member.</p>
                            ) : (
                              <div className="space-y-3">
                                {staffRequestsHistory.map(req => (
                                  <div key={req.id} className="bg-white border border-slate-200 rounded p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-sm">
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-sm text-slate-800">{req.department_code}</span>
                                        <span className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{req.academic_year}</span>
                                      </div>
                                      <p className="text-xs text-slate-500">
                                        Submitted: {formatDate(req.created_at)}
                                      </p>
                                      {req.status === 'REJECTED' && req.rejection_reason && (
                                        <p className="text-xs text-red-600 mt-1">Reason: {req.rejection_reason}</p>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                        req.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                                        req.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                        'bg-red-100 text-red-800'
                                      }`}>
                                        {req.status}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Section 6: Account Access Control */}
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
                      onClick={() => handleSave()}
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
              )}

              {isDeleteModalOpen && (
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

      {/* Safe Reassignment Confirmation Modal */}
      {reassignConfirmModal.isOpen && (
        <div className="fixed inset-0 z-[60] overflow-y-auto" aria-labelledby="reassign-modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={() => !processing && setReassignConfirmModal({ isOpen: false, branch: '', currentHod: '', academicYear: '', newHodName: '' })}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="relative z-10 inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full border border-amber-300">
              <div className="bg-amber-50 px-6 pt-5 pb-4 border-b border-amber-200">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 p-2 bg-amber-100 rounded-full text-amber-600">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900" id="reassign-modal-title">
                      Confirm HOD Branch Reassignment
                    </h3>
                    <p className="text-xs text-amber-800 mt-1">
                      An active HOD appointment already exists for this branch in the current academic year.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4 text-sm text-slate-700 bg-white">
                <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Department / Branch:</span>
                    <span className="font-bold text-[#0b3578] text-sm">{reassignConfirmModal.branch}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Current Active HOD:</span>
                    <span className="font-semibold text-slate-900">{reassignConfirmModal.currentHod} ({reassignConfirmModal.academicYear})</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">New Appointed HOD:</span>
                    <span className="font-bold text-emerald-700">{reassignConfirmModal.newHodName}</span>
                  </div>
                </div>
                <div className="text-xs text-slate-600 space-y-1.5 bg-blue-50 border border-blue-100 rounded-md p-3">
                  <p className="font-semibold text-[#0b3578] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Safe Transactional Reassignment
                  </p>
                  <p>
                    Confirming will retire <strong>{reassignConfirmModal.currentHod}</strong>&apos;s active HOD assignment for <strong>{reassignConfirmModal.branch}</strong>.
                  </p>
                  <p>
                    Their staff account will <strong>remain active</strong>, all previous historical records, audit logs, and any other assigned duties are safely preserved.
                  </p>
                </div>
              </div>
              <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => setReassignConfirmModal({ isOpen: false, branch: '', currentHod: '', academicYear: '', newHodName: '' })}
                  className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleSave([reassignConfirmModal.branch])}
                  className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm font-semibold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {processing ? 'Reassigning...' : 'Confirm Reassignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Coordinator Assignment Hub Modal ─────────────────────────────────── */}
      {isCoordModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-100 text-sky-700 rounded-lg">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">First Year Coordinator Management Hub</h3>
                  <p className="text-xs text-slate-500">Appoint, track, and revoke time-bounded First Year Coordinator responsibilities</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCoordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Actions Header */}
              <div className="flex justify-between items-center bg-sky-50/70 p-4 rounded-lg border border-sky-100">
                <div>
                  <h4 className="text-sm font-bold text-sky-950">First Year Coordination Scope</h4>
                  <p className="text-xs text-sky-800 mt-0.5">
                    Coordinators oversee Semesters 1 & 2 across all institutional branches. Retains Faculty duties.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewCoordForm(!showNewCoordForm)}
                  className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  {showNewCoordForm ? 'Cancel New Appointment' : '+ Appoint Coordinator'}
                </button>
              </div>

              {/* New Appointment Form */}
              {showNewCoordForm && (
                <form onSubmit={handleCreateCoordAssignment} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">New Coordinator Appointment</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Select Active Faculty Member *
                      </label>
                      <select
                        required
                        value={newCoordData.staff_account_id}
                        onChange={(e) => setNewCoordData({ ...newCoordData, staff_account_id: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-800 focus:outline-none focus:border-sky-500"
                      >
                        <option value="">-- Choose Faculty Member --</option>
                        {staffList
                          .filter(s => s.roles?.includes('faculty') && s.is_active)
                          .map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.employee_id || 'ID: ' + s.id}) {s.branches?.length ? `— ${s.branches.join(', ')}` : ''}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Academic Year *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 2024-2025"
                        value={newCoordData.academic_year}
                        onChange={(e) => setNewCoordData({ ...newCoordData, academic_year: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-800 focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={newCoordData.start_date}
                        onChange={(e) => setNewCoordData({ ...newCoordData, start_date: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-800 focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        End Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={newCoordData.end_date}
                        onChange={(e) => setNewCoordData({ ...newCoordData, end_date: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-800 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowNewCoordForm(false)}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={coordActionLoading}
                      className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {coordActionLoading ? 'Saving...' : 'Confirm Appointment'}
                    </button>
                  </div>
                </form>
              )}

              {/* Assignment History & Active List */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Appointment History & Status</h4>
                {loadingCoord ? (
                  <div className="py-8 text-center text-xs text-slate-500">Loading coordinator assignments...</div>
                ) : coordAssignments.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 italic bg-slate-50 rounded-lg border border-slate-200">
                    No First Year Coordinator assignments on record.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold">
                        <tr>
                          <th className="px-4 py-2.5">Faculty Member</th>
                          <th className="px-4 py-2.5">Academic Year</th>
                          <th className="px-4 py-2.5">Appointment Period</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {coordAssignments.map(asgn => (
                          <tr key={asgn.id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 font-medium text-slate-900">
                              <div>{asgn.staff_name || 'Staff #' + asgn.staff_account_id}</div>
                              <div className="text-[10px] text-slate-400">{asgn.employee_id || asgn.email}</div>
                            </td>
                            <td className="px-4 py-3 font-mono">{asgn.academic_year}</td>
                            <td className="px-4 py-3">
                              {asgn.start_date} to {asgn.end_date || 'Ongoing'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                asgn.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                asgn.status === 'SCHEDULED' ? 'bg-sky-100 text-sky-800 border border-sky-200' :
                                asgn.status === 'REVOKED' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                                'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {asgn.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {asgn.status === 'ACTIVE' && (
                                <button
                                  type="button"
                                  disabled={coordActionLoading}
                                  onClick={() => handleRevokeCoord(asgn.id)}
                                  className="text-xs text-red-600 hover:text-red-800 font-medium cursor-pointer disabled:opacity-50"
                                >
                                  Revoke
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCoordModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
