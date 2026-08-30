'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Search, Plus, Edit2, Trash2, X, Info } from 'lucide-react';

export default function SyllabusManager() {
  const [subjects, setSubjects] = useState([]);
  const [authorizedBranches, setAuthorizedBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('ADD'); // 'ADD' | 'ADD_CHILD' | 'EDIT' | 'DELETE_MAPPING'
  const [addType, setAddType] = useState('STANDARD'); // 'STANDARD' | 'GROUP' | 'CHILD'
  const [currentSubject, setCurrentSubject] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchSyllabus = async () => {
    try {
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSyllabus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, selectedSemester]);

  const { standardSubjects, groupedSubjects, allGroups } = useMemo(() => {
    if (!subjects) return { standardSubjects: [], groupedSubjects: [], allGroups: [] };
    
    const q = searchQuery.toLowerCase();
    const matchesSearch = (s) => 
        !searchQuery || 
        s.subject_code.toLowerCase().includes(q) || 
        s.subject_name.toLowerCase().includes(q);

    const allGroups = subjects.filter(s => s.is_group);
    
    const groupedSubjects = allGroups.map(group => {
       const children = subjects.filter(s => s.parent_group_code === group.subject_code);
       return {
         ...group,
         children: children.filter(matchesSearch)
       }
    }).filter(g => matchesSearch(g) || g.children.length > 0);

    const standardSubjects = subjects
        .filter(s => !s.is_group && !s.parent_group_code)
        .filter(matchesSearch);
        
    return { standardSubjects, groupedSubjects, allGroups };
  }, [subjects, searchQuery]);

  const handleOpenModal = (mode, subject = null) => {
    setModalMode(mode);
    setModalError('');
    setAddType(mode === 'ADD_CHILD' ? 'CHILD' : 'STANDARD');
    
    if (mode === 'ADD' || mode === 'ADD_CHILD') {
      setCurrentSubject({
        subject_code: '',
        subject_name: '',
        subject_type: 'theory',
        branch: subject?.branch || selectedBranch || (authorizedBranches[0] || ''),
        semester: subject?.semester || selectedSemester || '1',
        is_group: false,
        parent_group_code: subject?.parent_group_code || ''
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
      let submitData = { ...currentSubject };
      let finalAction = modalMode;
      
      if (modalMode === 'ADD' || modalMode === 'ADD_CHILD') {
        finalAction = 'ADD_SUBJECT';
        if (addType === 'GROUP') {
          submitData.is_group = true;
          submitData.parent_group_code = null;
        } else if (addType === 'CHILD') {
          submitData.is_group = false;
          if (!submitData.parent_group_code) {
             throw new Error("Please select a parent group for this elective.");
          }
        } else {
          submitData.is_group = false;
          submitData.parent_group_code = null;
        }
      }

      const res = await fetch('/api/staff/hod/syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: finalAction,
          subject: submitData
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      await fetchSyllabus();
      handleCloseModal();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-50/50 to-transparent rounded-bl-full pointer-events-none"></div>
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Syllabus Subjects Catalogue</h2>
            <p className="text-sm text-gray-500 mt-1">Manage standard subjects and elective groups for your department</p>
          </div>
          <button 
            onClick={() => handleOpenModal('ADD')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0b3578] hover:bg-[#0a2d66] text-white text-sm font-medium rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={16} /> Add Subject / Group
          </button>
        </div>
        
        <div className="p-6 bg-gray-50/50 border-b border-gray-100 relative z-10">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Branch</label>
              <select 
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="w-full h-10 px-3 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                <option value="">Select Branch...</option>
                {authorizedBranches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Semester</label>
              <select 
                value={selectedSemester}
                onChange={e => setSelectedSemester(e.target.value)}
                className="w-full h-10 px-3 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                <option value="">Select Semester...</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 relative mt-auto">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search subject code or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-4 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto relative z-10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-[15%]">Subject Code</th>
                <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-[40%]">Subject Name</th>
                <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-[10%]">Type</th>
                <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-[10%]">Branch</th>
                <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-[10%]">Sem</th>
                <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-[15%] text-right">Actions</th>
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
              ) : standardSubjects.length === 0 && groupedSubjects.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-slate-500">
                    <p className="text-[11px] font-semibold uppercase tracking-widest">No subjects found for this selection.</p>
                  </td>
                </tr>
              ) : (
                <>
                  {standardSubjects.map(sub => (
                    <tr key={`${sub.branch}-${sub.semester}-${sub.subject_code}`} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-xs font-bold text-gray-700">{sub.subject_code}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{sub.subject_name}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 capitalize">{sub.subject_type}</td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-500">{sub.branch}</td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-500">Sem {sub.semester}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleOpenModal('EDIT', sub)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer" title="Edit Subject Details">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleOpenModal('DELETE_MAPPING', sub)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer" title="Remove Mapping">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  
                  {groupedSubjects.map(group => (
                    <React.Fragment key={`${group.branch}-${group.semester}-${group.subject_code}`}>
                      <tr className="bg-[#0b3578]/5 border-t-2 border-[#0b3578]/10">
                        <td className="px-4 py-3 text-xs font-bold text-[#0b3578]">{group.subject_code}</td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-800">{group.subject_name} <span className="ml-2 text-[10px] font-semibold bg-[#0b3578]/10 text-[#0b3578] px-2 py-0.5 rounded-full uppercase tracking-wider">Elective Group</span></td>
                        <td className="px-4 py-3 text-xs text-gray-400">-</td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-500">{group.branch}</td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-500">Sem {group.semester}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2 items-center">
                            <button onClick={() => handleOpenModal('ADD_CHILD', { parent_group_code: group.subject_code, branch: group.branch, semester: group.semester })} className="text-[10px] text-blue-600 font-bold uppercase tracking-widest hover:underline mr-1 cursor-pointer">
                              + Add Elective
                            </button>
                            <button onClick={() => handleOpenModal('DELETE_MAPPING', group)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer" title="Delete Group">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {group.children.map(child => (
                        <tr key={`${child.branch}-${child.semester}-${child.subject_code}`} className="hover:bg-gray-50/50 bg-white">
                          <td className="px-4 py-3 text-xs font-bold text-gray-600 pl-8 relative">
                            <div className="absolute left-4 top-1/2 -mt-px w-2 h-px bg-gray-300"></div>
                            <div className="absolute left-4 top-0 h-full w-px bg-gray-300"></div>
                            {child.subject_code}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 pl-8">{child.subject_name}</td>
                          <td className="px-4 py-3 text-xs text-gray-600 capitalize">{child.subject_type}</td>
                          <td className="px-4 py-3 text-xs font-medium text-gray-400">{child.branch}</td>
                          <td className="px-4 py-3 text-xs font-medium text-gray-400">Sem {child.semester}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => handleOpenModal('EDIT', child)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer" title="Edit Subject Details">
                                <Edit2 size={16} />
                              </button>
                              <button onClick={() => handleOpenModal('DELETE_MAPPING', child)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer" title="Remove Mapping">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && currentSubject && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="text-base font-semibold text-slate-800">
                {modalMode === 'ADD' || modalMode === 'ADD_CHILD' ? 'Add Subject Mapping' : modalMode === 'EDIT' ? 'Edit Subject Details' : 'Remove Subject Mapping'}
              </h3>
              <button 
                onClick={handleCloseModal} 
                className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              {modalError && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg shadow-sm">
                  <strong className="font-semibold mr-1">Error:</strong> {modalError}
                </div>
              )}

              {modalMode === 'DELETE_MAPPING' ? (
                <div className="space-y-6">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
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
                      <strong>Note:</strong> This removes the mapping for this specific branch and semester. The core subject itself remains in the global catalogue.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 px-1 py-1">
                  
                  {(modalMode === 'ADD' || modalMode === 'ADD_CHILD') && (
                    <div className="mb-4">
                       <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Mapping Type</label>
                       <div className="flex gap-2">
                         <button type="button" onClick={() => setAddType('STANDARD')} className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-colors ${addType === 'STANDARD' ? 'bg-[#0b3578] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Standard</button>
                         <button type="button" onClick={() => setAddType('GROUP')} className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-colors ${addType === 'GROUP' ? 'bg-[#0b3578] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Elective Group</button>
                         <button type="button" onClick={() => setAddType('CHILD')} className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-colors ${addType === 'CHILD' ? 'bg-[#0b3578] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Elective Subject</button>
                       </div>
                    </div>
                  )}

                  {addType === 'CHILD' && (modalMode === 'ADD' || modalMode === 'ADD_CHILD') && (
                    <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 mb-2">
                      <label className="block text-[10px] font-semibold text-blue-800 uppercase tracking-widest mb-1.5">Parent Elective Group</label>
                      <select 
                        required
                        value={currentSubject.parent_group_code || ''}
                        onChange={e => setCurrentSubject({...currentSubject, parent_group_code: e.target.value})}
                        className="w-full h-10 px-3 border border-blue-200 rounded-md bg-white text-sm font-medium text-blue-900 focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578] transition-all cursor-pointer"
                      >
                        <option value="">Select Parent Group...</option>
                        {allGroups.map(g => (
                          <option key={g.subject_code} value={g.subject_code}>{g.subject_code} - {g.subject_name}</option>
                        ))}
                      </select>
                      {allGroups.length === 0 && <p className="text-xs text-red-500 mt-1">No groups exist for this branch & sem. Create a group first.</p>}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
                      {addType === 'GROUP' ? 'Group Code' : 'Subject Code'}
                    </label>
                    <input 
                      type="text" 
                      required
                      placeholder={addType === 'GROUP' ? "e.g. PE-I" : "e.g. PCS-401"}
                      disabled={modalMode === 'EDIT'}
                      value={currentSubject.subject_code}
                      onChange={e => setCurrentSubject({...currentSubject, subject_code: e.target.value})}
                      className="w-full h-10 px-3 border border-slate-200 rounded-md bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578] uppercase disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-all placeholder:text-slate-300 placeholder:normal-case"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
                      {addType === 'GROUP' ? 'Group Name' : 'Subject Name'}
                    </label>
                    <input 
                      type="text" 
                      required
                      placeholder={addType === 'GROUP' ? "e.g. Professional Elective I" : "e.g. Data Structures"}
                      value={currentSubject.subject_name}
                      onChange={e => setCurrentSubject({...currentSubject, subject_name: e.target.value})}
                      className="w-full h-10 px-3 border border-slate-200 rounded-md bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578] transition-all placeholder:text-slate-300"
                    />
                  </div>
                  
                  {addType !== 'GROUP' && (
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
                  )}
                  
                  {(modalMode === 'ADD' || modalMode === 'ADD_CHILD') && (
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Branch</label>
                        <select 
                          required
                          disabled={modalMode === 'ADD_CHILD'}
                          value={currentSubject.branch}
                          onChange={e => setCurrentSubject({...currentSubject, branch: e.target.value})}
                          className="w-full h-10 px-3 border border-slate-200 rounded-md bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578] transition-all cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
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
                          disabled={modalMode === 'ADD_CHILD'}
                          value={currentSubject.semester}
                          onChange={e => setCurrentSubject({...currentSubject, semester: e.target.value})}
                          className="w-full h-10 px-3 border border-slate-200 rounded-md bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578] transition-all cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
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
                  disabled={isSubmitting || (addType === 'CHILD' && allGroups.length === 0)}
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
