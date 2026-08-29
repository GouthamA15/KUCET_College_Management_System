'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Mail, Briefcase, UserCircle, CheckCircle, Search, AlertTriangle } from 'lucide-react';

export default function ActiveFacultyList() {
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [manageModal, setManageModal] = useState(null);
  const [processing, setProcessing] = useState(false);

  const fetchFaculty = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/staff/hod/active-faculty');
      if (res.ok) {
        const data = await res.json();
        setFacultyList(data.data || []);
      } else {
        toast.error('Failed to load faculty list');
      }
    } catch (_e) {
      toast.error('An error occurred loading faculty');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFaculty();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48 border border-gray-200 rounded-lg bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b3578]"></div>
      </div>
    );
  }

  const confirmManageStatus = async () => {
    if (!manageModal) return;
    setProcessing(true);
    const faculty = manageModal;
    const isCurrentlyActive = faculty.account_status === 'ACTIVE';
    const action = isCurrentlyActive ? 'disable' : 'enable';
    
    try {
      const res = await fetch(`/api/staff/hod/active-faculty/${faculty.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message || `Account ${action}d successfully`);
        // Update local state immediately
        setFacultyList(prev => prev.map(f => 
          f.id === faculty.id ? { ...f, account_status: result.data.account_status } : f
        ));
        setManageModal(null);
      } else {
        toast.error(result.error || `Failed to ${action} account`);
      }
    } catch (_e) {
      toast.error(`An error occurred while trying to ${action} account`);
    } finally {
      setProcessing(false);
    }
  };

  const filtered = facultyList.filter(f => 
    f.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    if (status === 'ACTIVE') {
      return (
        <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-green-200 uppercase tracking-wider">
          <CheckCircle size={10} /> Active
        </span>
      );
    }
    if (status === 'DISABLED') {
      return (
        <span className="flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-bold border border-gray-200 uppercase tracking-wider">
          Disabled
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-yellow-200 uppercase tracking-wider">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Active Faculty</h2>
          <p className="text-sm text-gray-500">All faculty members assigned to your department.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            className="pl-9 w-full border border-gray-300 rounded-md py-2 text-sm focus:ring-2 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none"
            placeholder="Search by name or Employee ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(faculty => (
            <div key={faculty.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer relative group">
              <div className="absolute top-0 right-0 p-2.5">
                {getStatusBadge(faculty.account_status)}
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#0b3578]/10 text-[#0b3578] flex items-center justify-center font-bold text-lg uppercase shrink-0">
                  {faculty.name?.charAt(0) || 'F'}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 leading-tight text-sm group-hover:text-[#0b3578] transition-colors">{faculty.name}</h3>
                  <p className="text-[10px] text-gray-500 font-medium mt-0.5">{faculty.employee_id}</p>
                </div>
              </div>
              
              <div className="space-y-1.5 mt-2 pt-2.5 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Briefcase size={13} className="text-gray-400 shrink-0" />
                  <span className="truncate" title={faculty.designation}>{faculty.designation || 'Faculty Member'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Mail size={13} className="text-gray-400 shrink-0" />
                  <span className="truncate" title={faculty.email}>{faculty.email}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <UserCircle size={13} className="text-gray-400 shrink-0" />
                  <span className="truncate">Dept: {faculty.department_code}</span>
                </div>
              </div>

              {/* Manage Action */}
              {(faculty.account_status === 'ACTIVE' || faculty.account_status === 'DISABLED') && (
                <div className="mt-3 pt-2.5 border-t border-gray-100 flex justify-end">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setManageModal(faculty); }}
                    className="text-[10px] font-semibold text-[#0b3578] hover:text-[#0a2d66] px-2.5 py-1 border border-[#0b3578] rounded-md transition-colors hover:bg-slate-50 cursor-pointer uppercase tracking-wider relative z-10"
                  >
                    {faculty.account_status === 'ACTIVE' ? 'Disable' : 'Enable'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 p-8 border border-dashed border-gray-300 text-center rounded-lg">
          <p className="text-gray-500 font-medium">No active faculty found matching your search.</p>
        </div>
      )}

      {/* Confirmation Modal */}
      {manageModal && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => {
              if (!processing) setManageModal(null);
            }}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="relative z-10 inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full border border-slate-200">
              <div className={`px-4 py-5 sm:p-6 border-b ${manageModal.account_status === 'ACTIVE' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <AlertTriangle className={`h-6 w-6 ${manageModal.account_status === 'ACTIVE' ? 'text-amber-600' : 'text-blue-600'}`} aria-hidden="true" />
                  </div>
                  <div className="ml-3 w-full">
                    <h3 className={`text-sm font-medium ${manageModal.account_status === 'ACTIVE' ? 'text-amber-900' : 'text-blue-900'}`}>
                      {manageModal.account_status === 'ACTIVE' ? 'Disable Faculty Account?' : 'Enable Faculty Account?'}
                    </h3>
                    <div className={`mt-2 text-sm space-y-2 ${manageModal.account_status === 'ACTIVE' ? 'text-amber-800' : 'text-blue-800'}`}>
                      <p>Are you sure you want to {manageModal.account_status === 'ACTIVE' ? 'disable' : 'enable'} <strong>{manageModal.name}</strong>?</p>
                      {manageModal.account_status === 'ACTIVE' ? (
                        <p>Their account will be set to <strong>Disabled</strong>, active sessions will be terminated, and they will be prevented from logging in. <br/><strong>All student records, audit history, and academic assignments are safely preserved.</strong></p>
                      ) : (
                        <p>Their account will be set to <strong>Active</strong>, and they will regain portal access immediately.</p>
                      )}
                    </div>
                    <div className="mt-5 flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={confirmManageStatus}
                        disabled={processing}
                        className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:w-auto sm:text-sm disabled:opacity-50 cursor-pointer ${
                          manageModal.account_status === 'ACTIVE' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        {processing ? 'Processing...' : manageModal.account_status === 'ACTIVE' ? 'Disable Account' : 'Enable Account'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setManageModal(null)}
                        disabled={processing}
                        className="w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 sm:w-auto sm:text-sm disabled:opacity-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
