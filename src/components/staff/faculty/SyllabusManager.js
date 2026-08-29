'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useStaff } from '@/context/StaffContext';
import { Loader2, Search, Plus, Edit2, Trash2, X, Info } from 'lucide-react';

export default function SyllabusManager() {
  const { staffData } = useStaff();
  const [subjects, setSubjects] = useState([]);
  const [authorizedBranches, setAuthorizedBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('ADD'); // 'ADD' | 'EDIT' | 'DELETE_MAPPING'
  const [currentSubject, setCurrentSubject] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchSyllabus = async () => {
    try {
      // First fetch authorized branches if not already loaded
      let branches = authorizedBranches;
      if (branches.length === 0) {
        const initRes = await fetch('/api/staff/hod/syllabus?init=true');
        const initData = await initRes.json();
        if (initRes.ok) {
           setAuthorizedBranches(initData.authorizedBranches || []);
           branches = initData.authorizedBranches || [];
           if (!selectedBranch && branches.length > 0) {
             setSelectedBranch(branches[0]);
           }
        }
      }

      if (!selectedBranch || !selectedSemester) {
         setSubjects([]);
         setLoading(false);
         return;
      }

      setLoading(true);
      setError(null);
      let url = '/api/staff/hod/syllabus';
      const params = new URLSearchParams();
      params.append('branch', selectedBranch);
      params.append('semester', selectedSemester);
      url += `?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to fetch syllabus');

      setSubjects(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSyllabus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, selectedSemester]);

  const handleOpenModal = (mode, subject = null) => {
    setModalMode(mode);
    setModalError('');
    if (mode === 'ADD') {
      setCurrentSubject({
        subject_code: '',
        subject_name: '',
        subject_type: 'theory',
        branch: selectedBranch || (authorizedBranches[0] || ''),
        semester: selectedSemester || '1'
      });
    } else {
      setCurrentSubject({ ...subject });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentSubject(null);
    setModalError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/staff/hod/syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: modalMode === 'ADD' ? 'ADD_SUBJECT' : modalMode === 'EDIT' ? 'EDIT_SUBJECT' : 'DELETE_MAPPING',
          subject: currentSubject
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Operation failed');

      handleCloseModal();
      fetchSyllabus(); // Refresh list
    } catch (err) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSubjects = useMemo(() => {
    if (!searchQuery) return subjects;
    const q = searchQuery.toLowerCase();
    return subjects.filter(s => 
      s.subject_code.toLowerCase().includes(q) || 
      s.subject_name.toLowerCase().includes(q)
    );
  }, [subjects, searchQuery]);

  if (!staffData?.is_hod) return null;

  return (
    <div className="bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 border border-blue-100 shadow-sm rounded-sm p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Syllabus Management</h2>
          <p className="text-xs text-gray-500 mt-1">Manage global subject catalogue and branch-semester mappings.</p>
        </div>
        <button
          onClick={() => handleOpenModal('ADD')}
          className="mt-4 sm:mt-0 flex items-center px-3 py-1.5 bg-[#0b3578] text-white text-xs font-medium rounded hover:bg-[#0a2d66] transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Subject Mapping
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded text-xs">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 bg-gray-50 p-3 rounded border border-gray-200">
        <div className="flex-1">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Branch/Program</label>
          <select 
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full text-sm border-gray-300 rounded focus:ring-[#0b3578] focus:border-[#0b3578]"
          >
            {authorizedBranches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-32">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Semester</label>
          <select 
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="w-full text-sm border-gray-300 rounded focus:ring-[#0b3578] focus:border-[#0b3578]"
          >
            <option value="">Select Semester</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
              <option key={s} value={s}>Sem {s}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 relative">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" />
            <input 
              type="text" 
              placeholder="Code or name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 text-sm border-gray-300 rounded focus:ring-[#0b3578] focus:border-[#0b3578]"
            />
          </div>
        </div>
      </div>

      {/* Subject List */}
      <div className="overflow-x-auto border border-gray-200 rounded">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Subject Code</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Subject Name</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Sem</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Branch</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Loading syllabus...</p>
                </td>
              </tr>
            ) : (!selectedBranch || !selectedSemester) ? (
              <tr>
                <td colSpan="6" className="px-4 py-12 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Select branch and semester to view subjects.</p>
                </td>
              </tr>
            ) : filteredSubjects.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-12 text-center text-slate-500">
                  <p className="text-[11px] font-semibold uppercase tracking-widest">No subjects found for this selection.</p>
                </td>
              </tr>
            ) : (
              filteredSubjects.map(sub => (
                <tr key={`${sub.branch}-${sub.semester}-${sub.subject_code}`} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-xs font-bold text-gray-700">{sub.subject_code}</td>
                  <td className="px-4 py-3 text-sm text-gray-800">{sub.subject_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 capitalize">{sub.subject_type}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{sub.semester}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{sub.branch}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleOpenModal('EDIT', sub)}
                        className="p-1 text-gray-400 hover:text-[#0b3578] transition-colors cursor-pointer"
                        title="Edit Subject"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleOpenModal('DELETE_MAPPING', sub)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Remove Mapping"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity">
          <div className="relative z-10 bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 transform scale-100 transition-all">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
              <h3 className="text-base font-semibold text-slate-800">
                {modalMode === 'ADD' && 'Add Subject to Syllabus'}
                {modalMode === 'EDIT' && 'Edit Subject Catalogue'}
                {modalMode === 'DELETE_MAPPING' && 'Remove Subject Mapping'}
              </h3>
              <button type="button" onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5">
              {modalError && (
                <div className="mb-4 p-2 bg-red-50 text-red-700 border border-red-200 rounded text-xs">
                  {modalError}
                </div>
              )}

              {modalMode === 'DELETE_MAPPING' ? (
                <div className="text-sm text-slate-600 space-y-4">
                  <p className="text-base text-slate-800 font-medium">Are you sure you want to remove this mapping?</p>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2 shadow-sm">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Code</span>
                        <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">{currentSubject.subject_code}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200 py-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Name</span>
                        <span className="font-semibold text-slate-700">{currentSubject.subject_name}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Branch & Sem</span>
                        <span className="font-medium text-slate-700 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs border border-blue-100">{currentSubject.branch} - Sem {currentSubject.semester}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 shadow-sm">
                    <div className="mt-0.5 shrink-0 bg-amber-100 p-1 rounded-full"><Info size={14} className="text-amber-600" /></div>
                    <p className="font-medium leading-relaxed">
                      <strong>Note:</strong> This removes the subject mapping for this specific branch and semester. The core subject itself remains in the global catalogue.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 px-1 py-1">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Subject Code</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. PCS-401"
                      disabled={modalMode === 'EDIT'}
                      value={currentSubject.subject_code}
                      onChange={e => setCurrentSubject({...currentSubject, subject_code: e.target.value})}
                      className="w-full h-10 px-3 border border-slate-200 rounded-md bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578] uppercase disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-all placeholder:text-slate-300 placeholder:normal-case"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Subject Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Data Structures"
                      value={currentSubject.subject_name}
                      onChange={e => setCurrentSubject({...currentSubject, subject_name: e.target.value})}
                      className="w-full h-10 px-3 border border-slate-200 rounded-md bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578] transition-all placeholder:text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Subject Type</label>
                    <select 
                      required
                      value={currentSubject.subject_type}
                      onChange={e => setCurrentSubject({...currentSubject, subject_type: e.target.value})}
                      className="w-full h-10 px-3 border border-slate-200 rounded-md bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578] transition-all cursor-pointer"
                    >
                      <option value="theory">Theory</option>
                      <option value="lab">Lab</option>
                    </select>
                  </div>
                  {modalMode === 'ADD' && (
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Branch</label>
                        <select 
                          required
                          value={currentSubject.branch}
                          onChange={e => setCurrentSubject({...currentSubject, branch: e.target.value})}
                          className="w-full h-10 px-3 border border-slate-200 rounded-md bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578] transition-all cursor-pointer"
                        >
                          <option value="">Select...</option>
                          {authorizedBranches.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Semester</label>
                        <select 
                          required
                          value={currentSubject.semester}
                          onChange={e => setCurrentSubject({...currentSubject, semester: e.target.value})}
                          className="w-full h-10 px-3 border border-slate-200 rounded-md bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578] transition-all cursor-pointer"
                        >
                          <option value="">Select...</option>
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                            <option key={s} value={s}>Sem {s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-8 flex justify-end gap-3 pt-5 border-t border-gray-100 bg-gray-50 -mx-5 -mb-5 px-5 pb-5 rounded-b-xl">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 hover:text-slate-800 transition-colors rounded-md shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2.5 text-sm font-semibold text-white rounded-md shadow-sm transition-all flex items-center justify-center min-w-[120px] disabled:opacity-50 cursor-pointer ${
                    modalMode === 'DELETE_MAPPING' 
                      ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 border border-transparent' 
                      : 'bg-[#0b3578] hover:bg-[#0a2d66] active:bg-[#092554] border border-transparent'
                  }`}
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                  ) : modalMode === 'DELETE_MAPPING' ? 'Remove Mapping' : 'Save Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
