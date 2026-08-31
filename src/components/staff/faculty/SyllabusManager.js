'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Plus, Edit2, Trash2, X, Info, Search, ChevronDown, ChevronUp, BookOpen, FlaskConical } from 'lucide-react';
import logger from '@/lib/logger';

// ─── Constants ───────────────────────────────────────────────────────────────

const GROUP_TYPE_LABELS = {
  PROFESSIONAL_ELECTIVE: 'Professional Elective',
  OPEN_ELECTIVE: 'Open Elective',
  MANDATORY_NON_CREDIT: 'Mandatory Non-Credit',
  OTHER: 'Other',
};

const ROMAN_OPTIONS = [
  { value: 1, label: 'I' },
  { value: 2, label: 'II' },
  { value: 3, label: 'III' },
  { value: 4, label: 'IV' },
  { value: 5, label: 'V' },
  { value: 6, label: 'VI' },
  { value: 7, label: 'VII' },
  { value: 8, label: 'VIII' },
];

const toRoman = (n) => ROMAN_OPTIONS.find(r => r.value === n)?.label || String(n);

const inputClass = "w-full h-10 px-3 border border-slate-200 rounded-md bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578] transition-all placeholder:text-slate-300 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed";
const selectClass = inputClass + " cursor-pointer";
const labelClass = "block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5";
const primaryBtn = "inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b3578] hover:bg-[#0a2d66] text-white text-sm font-medium rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-50";
const ghostBtn = "inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50";
const dangerBtn = "inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50";

// ─── ElectiveGroupCard ────────────────────────────────────────────────────────

function ElectiveGroupCard({ group, onAddSubject, onRemoveSubject, onEditSubject, onEditGroup, onDeleteGroup }) {
  const [expanded, setExpanded] = useState(true);

  const typeColor = group.group_type === 'PROFESSIONAL_ELECTIVE'
    ? 'bg-blue-50 border-blue-200 text-blue-700'
    : group.group_type === 'OPEN_ELECTIVE'
    ? 'bg-green-50 border-green-200 text-green-700'
    : 'bg-gray-50 border-gray-200 text-gray-600';

  const modeIcon = group.subject_mode === 'lab'
    ? <FlaskConical size={12} className="inline mr-1" />
    : <BookOpen size={12} className="inline mr-1" />;

  const friendlyName = group.sequence_num > 0
    ? `${GROUP_TYPE_LABELS[group.group_type] || group.group_type} – ${toRoman(group.sequence_num)}`
    : group.group_name;

  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden ${group.group_type === 'PROFESSIONAL_ELECTIVE' ? 'border-blue-200' : group.group_type === 'OPEN_ELECTIVE' ? 'border-green-200' : 'border-gray-200'}`}>
      {/* Card Header */}
      <div className={`flex items-center justify-between px-4 py-3 ${group.group_type === 'PROFESSIONAL_ELECTIVE' ? 'bg-blue-50' : group.group_type === 'OPEN_ELECTIVE' ? 'bg-green-50' : 'bg-gray-50'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => setExpanded(e => !e)} className="shrink-0 cursor-pointer">
            {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-slate-600">{group.group_code}</span>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${typeColor}`}>
                {modeIcon}{group.subject_mode === 'lab' ? 'Lab' : 'Theory'}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-800 truncate">{friendlyName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-xs text-slate-400 hidden sm:block">{group.subjects?.length || 0} subject{group.subjects?.length !== 1 ? 's' : ''}</span>
          <button onClick={() => onAddSubject(group)} className="text-xs font-bold text-[#0b3578] hover:text-[#0a2d66] cursor-pointer px-2 py-1 rounded hover:bg-white transition-colors whitespace-nowrap">+ Add</button>
          <button onClick={() => onEditGroup(group)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-md transition-colors cursor-pointer" title="Edit Group">
            <Edit2 size={14} />
          </button>
          <button onClick={() => onDeleteGroup(group)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-md transition-colors cursor-pointer" title="Delete Group">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Subject List */}
      {expanded && (
        <div className="divide-y divide-gray-100 bg-white">
          {(group.subjects || []).length === 0 ? (
            <div className="px-4 py-4 text-center">
              <p className="text-xs text-slate-400 italic">No subjects added yet. Click &quot;+ Add&quot; to add the first elective option.</p>
            </div>
          ) : (
            group.subjects.map(sub => (
              <div key={sub.egs_id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50/50">
                <div className="min-w-0">
                  <span className="font-mono text-[11px] font-bold text-slate-500 mr-2">{sub.subject_code}</span>
                  <span className="text-sm text-slate-700">{sub.subject_name}</span>
                  <span className="ml-2 text-[10px] text-slate-400 capitalize">({sub.subject_type})</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button onClick={() => onEditSubject(sub, group)} className="p-1 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors cursor-pointer" title="Edit Subject">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => onRemoveSubject(sub, group)} className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer" title="Remove from Group">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── SubjectSearchDropdown ────────────────────────────────────────────────────

function SubjectSearchDropdown({ value, onSelect, placeholder = "Search by code or name..." }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (q) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q || q.length < 2) { setResults([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/staff/hod/syllabus?search=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.subjects || []);
        setShowDropdown(true);
      } catch { setResults([]); } finally { setSearching(false); }
    }, 300);
  };

  const handleSelect = (sub) => {
    setQuery(sub.subject_name);
    setShowDropdown(false);
    onSelect(sub);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {searching ? <Loader2 size={14} className="text-slate-400 animate-spin" /> : <Search size={14} className="text-slate-400" />}
        </div>
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={e => handleSearch(e.target.value)}
          onFocus={() => query.length >= 2 && setShowDropdown(true)}
          className={inputClass + ' pl-9'}
        />
        {value?.subject_code && (
          <button type="button" onClick={() => { setQuery(''); onSelect(null); setShowDropdown(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={14} />
          </button>
        )}
      </div>
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
          {results.map(sub => (
            <button key={sub.subject_code} type="button" onClick={() => handleSelect(sub)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors">
              <span className="font-mono text-[11px] font-bold text-slate-500 mr-2">{sub.subject_code}</span>
              <span className="text-sm text-slate-800">{sub.subject_name}</span>
              <span className="ml-2 text-[10px] text-slate-400 capitalize">({sub.subject_type})</span>
            </button>
          ))}
        </div>
      )}
      {showDropdown && !searching && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl px-3 py-3">
          <p className="text-xs text-slate-500 italic">No subjects found. You can create a new one below.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SyllabusManager() {
  const [data, setData] = useState({ coreSubjects: [], professionalElectives: [], openElectives: [], otherGroups: [] });
  const [authorizedBranches, setAuthorizedBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [coreSearch, setCoreSearch] = useState('');

  // Modal state
  const [modal, setModal] = useState(null); // null | { type, payload }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // ─── Fetch data ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!selectedBranch || !selectedSemester) {
      setData({ coreSubjects: [], professionalElectives: [], openElectives: [], otherGroups: [] });
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/staff/hod/syllabus?branch=${selectedBranch}&semester=${selectedSemester}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load syllabus data');
      setData({
        coreSubjects: d.coreSubjects || [],
        professionalElectives: d.professionalElectives || [],
        openElectives: d.openElectives || [],
        otherGroups: d.otherGroups || [],
      });
    } catch (e) {
      logger.error({ err: e }, 'Failed to fetch syllabus data');
      setLoadError(e.message || 'Failed to load syllabus data');
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, selectedSemester]);

  useEffect(() => {
    const fetchInit = async () => {
      try {
        const res = await fetch('/api/staff/hod/syllabus?init=true');
        const d = await res.json();
        if (res.ok) {
          setAuthorizedBranches(d.authorizedBranches || []);
          if (d.authorizedBranches?.length > 0) setSelectedBranch(d.authorizedBranches[0]);
        }
      } catch { /* ignore */ }
    };
    fetchInit();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, selectedSemester]);

  // ─── API call helper ─────────────────────────────────────────────────────

  const apiPost = async (body) => {
    const res = await fetch('/api/staff/hod/syllabus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Request failed');
    return d;
  };

  // ─── Modal handlers ──────────────────────────────────────────────────────

  const openModal = (type, payload = {}) => {
    setModalError('');
    setModal({ type, payload });
  };
  const closeModal = () => {
    setModal(null);
    setModalError('');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setModalError('');
    try {
      const { type, payload } = modal;

      if (type === 'ADD_CORE') {
        if (!payload.subject_code?.trim() || !payload.subject_name?.trim()) throw new Error('All fields required');
        await apiPost({ action: 'ADD_CORE_SUBJECT', subject: { ...payload, branch: selectedBranch, semester: parseInt(selectedSemester) } });
      }

      if (type === 'EDIT_CORE') {
        if (!payload.subject_code?.trim() || !payload.subject_name?.trim()) throw new Error('Subject code and name are required');
        await apiPost({ action: 'EDIT_SUBJECT', subject: {
          subject_code: payload.subject_code,
          subject_name: payload.subject_name,
          subject_type: payload.subject_type,
        }});
      }

      if (type === 'EDIT_ELECTIVE_SUBJECT') {
        if (!payload.subject_code?.trim() || !payload.subject_name?.trim()) throw new Error('Subject code and name are required');
        await apiPost({ action: 'EDIT_SUBJECT', subject: {
          subject_code: payload.subject_code,
          subject_name: payload.subject_name,
          subject_type: payload.subject_type,
        }});
      }

      if (type === 'ADD_ELECTIVE_GROUP') {
        if (!payload.group_code?.trim() || !payload.group_name?.trim()) throw new Error('Group code and name required');
        await apiPost({ action: 'ADD_ELECTIVE_GROUP', group: { ...payload, branch: selectedBranch, semester: parseInt(selectedSemester) } });
      }

      if (type === 'ADD_ELECTIVE_SUBJECT') {
        const subCode = payload.selectedSubject?.subject_code || payload.new_code?.trim();
        const subName = payload.selectedSubject?.subject_name || payload.new_name?.trim();
        const subType = payload.selectedSubject?.subject_type || payload.subject_type || 'theory';

        if (!subCode || !subName) throw new Error('Please select an existing subject or enter both code and name');

        await apiPost({ action: 'ADD_ELECTIVE_SUBJECT', payload: {
          group_id: payload.group.id,
          branch: selectedBranch,
          subject_code: subCode.toUpperCase(),
          subject_name: subName,
          subject_type: subType,
        }});
      }

      if (type === 'EDIT_GROUP') {
        await apiPost({ action: 'EDIT_ELECTIVE_GROUP', group: {
          id: payload.id,
          branch: selectedBranch,
          group_name: payload.group_name,
          subject_mode: payload.subject_mode,
          display_order: parseInt(payload.display_order) || 0,
        }});
      }

      if (type === 'DELETE_GROUP') {
        await apiPost({ action: 'DELETE_ELECTIVE_GROUP', group: { id: payload.id, branch: selectedBranch } });
      }

      if (type === 'REMOVE_FROM_GROUP') {
        await apiPost({ action: 'REMOVE_FROM_GROUP', payload: {
          egs_id: payload.egs_id,
          branch: selectedBranch,
          subject_code: payload.subject_code,
        }});
      }

      if (type === 'DELETE_CORE') {
        await apiPost({ action: 'DELETE_CORE_MAPPING', subject: {
          subject_code: payload.subject_code,
          branch: selectedBranch,
          semester: parseInt(selectedSemester),
        }});
      }

      await fetchData();
      closeModal();
    } catch (e) {
      setModalError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const filteredCore = coreSearch
    ? data.coreSubjects.filter(s =>
        s.subject_code.toLowerCase().includes(coreSearch.toLowerCase()) ||
        s.subject_name.toLowerCase().includes(coreSearch.toLowerCase())
      )
    : data.coreSubjects;

  const allElectiveGroups = [...data.professionalElectives, ...data.openElectives, ...data.otherGroups];

  const hasData = !loading && !loadError && (filteredCore.length > 0 || allElectiveGroups.length > 0);
  const isEmpty = !loading && !loadError && selectedBranch && selectedSemester && !hasData;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-50/50 to-transparent rounded-bl-full pointer-events-none" />
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Syllabus Management</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage core subjects, professional and open elective groups for your department</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => openModal('ADD_ELECTIVE_GROUP', { group_type: 'PROFESSIONAL_ELECTIVE', subject_mode: 'theory', sequence_num: 1 })}
              className={primaryBtn}>
              <Plus size={16} /> Elective Group
            </button>
            <button onClick={() => openModal('ADD_CORE', { subject_code: '', subject_name: '', subject_type: 'theory' })}
              className={ghostBtn}>
              <Plus size={16} /> Core Subject
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-6 bg-gray-50/50 border-b border-gray-100 flex flex-wrap gap-4">
          <div className="min-w-[180px] flex-1 max-w-xs">
            <label className={labelClass}>Branch</label>
            <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className={selectClass}>
              <option value="">Select Branch...</option>
              {authorizedBranches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="min-w-[160px] flex-1 max-w-[200px]">
            <label className={labelClass}>Semester</label>
            <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} className={selectClass}>
              <option value="">Select...</option>
              {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && selectedBranch && selectedSemester && (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#0b3578]" />
          <span className="ml-3 text-sm text-slate-500">Loading syllabus...</span>
        </div>
      )}

      {/* Error state */}
      {!loading && loadError && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-8 text-center text-red-700">
          <p className="text-sm font-semibold">Failed to load syllabus</p>
          <p className="text-xs text-red-500 mt-1">{loadError}</p>
          <button onClick={fetchData} className="mt-3 text-xs bg-red-100 hover:bg-red-200 text-red-800 font-medium px-3 py-1.5 rounded transition-colors cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Empty prompt */}
      {(!selectedBranch || !selectedSemester) && !loading && !loadError && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-slate-400 font-semibold uppercase tracking-widest">Select a branch and semester to view the syllabus</p>
        </div>
      )}
      {isEmpty && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-slate-400 font-semibold uppercase tracking-widest">No subjects found for {selectedBranch} Semester {selectedSemester}</p>
          <p className="text-xs text-slate-400 mt-2">Click &quot;+ Core Subject&quot; or &quot;+ Elective Group&quot; above to add the first entries.</p>
        </div>
      )}

      {/* Core Subjects */}
      {!loading && filteredCore.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Core Subjects</h3>
            <div className="relative w-60">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input type="text" placeholder="Filter core subjects..." value={coreSearch} onChange={e => setCoreSearch(e.target.value)}
                className="h-8 w-full pl-8 pr-3 border border-slate-200 rounded-md text-xs focus:outline-none focus:border-[#0b3578]" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[560px] w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[18%]">Code</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[10%]">Type</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[100px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredCore.map(sub => (
                  <tr key={sub.subject_code} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-gray-600">{sub.subject_code}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{sub.subject_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 capitalize">{sub.subject_type}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openModal('EDIT_CORE', {
                            subject_code: sub.subject_code,
                            subject_name: sub.subject_name,
                            subject_type: sub.subject_type,
                          })}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer" title="Edit Subject">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => openModal('DELETE_CORE', { subject_code: sub.subject_code, subject_name: sub.subject_name })}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer" title="Remove Mapping">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Professional Electives */}
      {!loading && data.professionalElectives.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider px-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            Professional Electives — {selectedBranch} Semester {selectedSemester}
          </h3>
          {data.professionalElectives.map(group => (
            <ElectiveGroupCard key={group.id} group={group}
              onAddSubject={g => openModal('ADD_ELECTIVE_SUBJECT', { group: g, selectedSubject: null, subject_type: 'theory', useNew: false, new_code: '', new_name: '' })}
              onRemoveSubject={(sub, g) => openModal('REMOVE_FROM_GROUP', { egs_id: sub.egs_id, subject_code: sub.subject_code, subject_name: sub.subject_name, group_name: g.group_name })}
              onEditSubject={(sub, g) => openModal('EDIT_ELECTIVE_SUBJECT', { egs_id: sub.egs_id, group_id: g.id, group_name: g.group_name, subject_code: sub.subject_code, subject_name: sub.subject_name, subject_type: sub.subject_type })}
              onEditGroup={g => openModal('EDIT_GROUP', { id: g.id, group_name: g.group_name, subject_mode: g.subject_mode, display_order: g.display_order })}
              onDeleteGroup={g => openModal('DELETE_GROUP', { id: g.id, group_name: g.group_name, subject_count: g.subjects?.length || 0 })}
            />
          ))}
        </div>
      )}

      {/* Open Electives */}
      {!loading && data.openElectives.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-green-700 uppercase tracking-wider px-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            Open Electives — {selectedBranch} Semester {selectedSemester}
          </h3>
          {data.openElectives.map(group => (
            <ElectiveGroupCard key={group.id} group={group}
              onAddSubject={g => openModal('ADD_ELECTIVE_SUBJECT', { group: g, selectedSubject: null, subject_type: 'theory', useNew: false, new_code: '', new_name: '' })}
              onRemoveSubject={(sub, g) => openModal('REMOVE_FROM_GROUP', { egs_id: sub.egs_id, subject_code: sub.subject_code, subject_name: sub.subject_name, group_name: g.group_name })}
              onEditSubject={(sub, g) => openModal('EDIT_ELECTIVE_SUBJECT', { egs_id: sub.egs_id, group_id: g.id, group_name: g.group_name, subject_code: sub.subject_code, subject_name: sub.subject_name, subject_type: sub.subject_type })}
              onEditGroup={g => openModal('EDIT_GROUP', { id: g.id, group_name: g.group_name, subject_mode: g.subject_mode, display_order: g.display_order })}
              onDeleteGroup={g => openModal('DELETE_GROUP', { id: g.id, group_name: g.group_name, subject_count: g.subjects?.length || 0 })}
            />
          ))}
        </div>
      )}

      {/* Other groups (Mandatory Non-Credit, etc.) */}
      {!loading && data.otherGroups.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider px-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
            Other Groups — {selectedBranch} Semester {selectedSemester}
          </h3>
          {data.otherGroups.map(group => (
            <ElectiveGroupCard key={group.id} group={group}
              onAddSubject={g => openModal('ADD_ELECTIVE_SUBJECT', { group: g, selectedSubject: null, subject_type: 'theory', useNew: false, new_code: '', new_name: '' })}
              onRemoveSubject={(sub, g) => openModal('REMOVE_FROM_GROUP', { egs_id: sub.egs_id, subject_code: sub.subject_code, subject_name: sub.subject_name, group_name: g.group_name })}
              onEditSubject={(sub, g) => openModal('EDIT_ELECTIVE_SUBJECT', { egs_id: sub.egs_id, group_id: g.id, group_name: g.group_name, subject_code: sub.subject_code, subject_name: sub.subject_name, subject_type: sub.subject_type })}
              onEditGroup={g => openModal('EDIT_GROUP', { id: g.id, group_name: g.group_name, subject_mode: g.subject_mode, display_order: g.display_order })}
              onDeleteGroup={g => openModal('DELETE_GROUP', { id: g.id, group_name: g.group_name, subject_count: g.subjects?.length || 0 })}
            />
          ))}
        </div>
      )}

      {/* ─── MODALS ─────────────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="text-base font-semibold text-slate-800">
                {modal.type === 'ADD_CORE' && 'Add Core Subject'}
                {modal.type === 'EDIT_CORE' && 'Edit Subject'}
                {modal.type === 'ADD_ELECTIVE_GROUP' && 'Create Elective Group'}
                {modal.type === 'ADD_ELECTIVE_SUBJECT' && `Add Subject to ${modal.payload.group?.group_name}`}
                {modal.type === 'EDIT_ELECTIVE_SUBJECT' && `Edit Elective Subject`}
                {modal.type === 'EDIT_GROUP' && 'Edit Elective Group'}
                {modal.type === 'DELETE_GROUP' && 'Delete Elective Group'}
                {modal.type === 'REMOVE_FROM_GROUP' && 'Remove Subject from Group'}
                {modal.type === 'DELETE_CORE' && 'Remove Core Subject Mapping'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {modalError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
                  <strong className="font-semibold">Error:</strong> {modalError}
                </div>
              )}

              {/* ADD CORE SUBJECT */}
              {modal.type === 'ADD_CORE' && (
                <>
                  <div>
                    <label className={labelClass}>Subject Code</label>
                    <input type="text" placeholder="e.g. CS501" className={inputClass} value={modal.payload.subject_code}
                      onChange={e => setModal(m => ({ ...m, payload: { ...m.payload, subject_code: e.target.value.toUpperCase() } }))} />
                  </div>
                  <div>
                    <label className={labelClass}>Subject Name</label>
                    <input type="text" placeholder="e.g. Software Engineering" className={inputClass} value={modal.payload.subject_name}
                      onChange={e => setModal(m => ({ ...m, payload: { ...m.payload, subject_name: e.target.value } }))} />
                  </div>
                  <div>
                    <label className={labelClass}>Type</label>
                    <select className={selectClass} value={modal.payload.subject_type}
                      onChange={e => setModal(m => ({ ...m, payload: { ...m.payload, subject_type: e.target.value } }))}>
                      <option value="theory">Theory</option>
                      <option value="lab">Lab</option>
                    </select>
                  </div>
                </>
              )}

              {/* EDIT CORE SUBJECT */}
              {modal.type === 'EDIT_CORE' && (
                <>
                  <div>
                    <label className={labelClass}>Subject Code</label>
                    <input type="text" className={inputClass} value={modal.payload.subject_code} disabled />
                  </div>
                  <div>
                    <label className={labelClass}>Subject Name</label>
                    <input type="text" className={inputClass} value={modal.payload.subject_name}
                      onChange={e => setModal(m => ({ ...m, payload: { ...m.payload, subject_name: e.target.value } }))} />
                  </div>
                  <div>
                    <label className={labelClass}>Type</label>
                    <select className={selectClass} value={modal.payload.subject_type}
                      onChange={e => setModal(m => ({ ...m, payload: { ...m.payload, subject_type: e.target.value } }))}>
                      <option value="theory">Theory</option>
                      <option value="lab">Lab</option>
                    </select>
                  </div>
                  <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs px-3 py-2 rounded-lg">
                    <Info size={14} className="shrink-0 mt-0.5" />
                    <span>This edits the subject in the global catalogue. Changes will reflect everywhere this subject is used across all branches and semesters.</span>
                  </div>
                </>
              )}

              {/* EDIT ELECTIVE SUBJECT */}
              {modal.type === 'EDIT_ELECTIVE_SUBJECT' && (
                <>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-700">
                    In group: <strong>{modal.payload.group_name}</strong>
                  </div>
                  <div>
                    <label className={labelClass}>Subject Code</label>
                    <input type="text" className={inputClass} value={modal.payload.subject_code} disabled />
                  </div>
                  <div>
                    <label className={labelClass}>Subject Name</label>
                    <input type="text" className={inputClass} value={modal.payload.subject_name}
                      onChange={e => setModal(m => ({ ...m, payload: { ...m.payload, subject_name: e.target.value } }))} />
                  </div>
                  <div>
                    <label className={labelClass}>Type</label>
                    <select className={selectClass} value={modal.payload.subject_type}
                      onChange={e => setModal(m => ({ ...m, payload: { ...m.payload, subject_type: e.target.value } }))}>
                      <option value="theory">Theory</option>
                      <option value="lab">Lab</option>
                    </select>
                  </div>
                  <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs px-3 py-2 rounded-lg">
                    <Info size={14} className="shrink-0 mt-0.5" />
                    <span>Edits the subject in the global catalogue. This will reflect on all branches and groups using this subject.</span>
                  </div>
                </>
              )}

              {/* ADD ELECTIVE GROUP */}
              {modal.type === 'ADD_ELECTIVE_GROUP' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Group Type</label>
                      <select className={selectClass} value={modal.payload.group_type}
                        onChange={e => setModal(m => ({ ...m, payload: { ...m.payload, group_type: e.target.value } }))}>
                        <option value="PROFESSIONAL_ELECTIVE">Professional Elective</option>
                        <option value="OPEN_ELECTIVE">Open Elective</option>
                        <option value="MANDATORY_NON_CREDIT">Mandatory Non-Credit</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Mode</label>
                      <select className={selectClass} value={modal.payload.subject_mode}
                        onChange={e => setModal(m => ({ ...m, payload: { ...m.payload, subject_mode: e.target.value } }))}>
                        <option value="theory">Theory</option>
                        <option value="lab">Lab</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Group Code</label>
                      <input type="text" placeholder="e.g. PE-I" className={inputClass} value={modal.payload.group_code || ''}
                        onChange={e => setModal(m => ({ ...m, payload: { ...m.payload, group_code: e.target.value.toUpperCase() } }))} />
                    </div>
                    <div>
                      <label className={labelClass}>Sequence (Roman)</label>
                      <select className={selectClass} value={modal.payload.sequence_num || 1}
                        onChange={e => setModal(m => ({ ...m, payload: { ...m.payload, sequence_num: parseInt(e.target.value) } }))}>
                        {ROMAN_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label} ({r.value})</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Display Name</label>
                    <input type="text" placeholder="e.g. Professional Elective – I" className={inputClass} value={modal.payload.group_name || ''}
                      onChange={e => setModal(m => ({ ...m, payload: { ...m.payload, group_name: e.target.value } }))} />
                    <p className="text-[10px] text-slate-400 mt-1">This is shown to faculty and students. Keep it descriptive.</p>
                  </div>
                  {['PROFESSIONAL_ELECTIVE','OPEN_ELECTIVE'].includes(modal.payload.group_type) && parseInt(selectedSemester) < 5 && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-lg">
                      <Info size={14} className="shrink-0 mt-0.5" />
                      <span>Professional and Open Electives are typically only available from Semester 5 onwards. This will be rejected by the server if the semester is below 5.</span>
                    </div>
                  )}
                </>
              )}

              {/* ADD ELECTIVE SUBJECT */}
              {modal.type === 'ADD_ELECTIVE_SUBJECT' && (
                <>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-700">
                    Adding to: <strong>{modal.payload.group?.group_name}</strong> ({modal.payload.group?.group_code})
                  </div>
                  <div>
                    <label className={labelClass}>Search Existing Subject</label>
                    <SubjectSearchDropdown
                      value={modal.payload.selectedSubject}
                      onSelect={sub => setModal(m => ({ ...m, payload: { ...m.payload, selectedSubject: sub, new_code: sub?.subject_code || m.payload.new_code, new_name: sub?.subject_name || m.payload.new_name, subject_type: sub?.subject_type || m.payload.subject_type } }))}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Search the global catalogue first. If not found, fill in the fields below to create a new subject.</p>
                  </div>
                  <div>
                    <label className={labelClass}>Subject Code</label>
                    <input type="text" placeholder="e.g. PE5101CS" className={inputClass}
                      value={modal.payload.selectedSubject?.subject_code || modal.payload.new_code || ''}
                      disabled={!!modal.payload.selectedSubject}
                      onChange={e => setModal(m => ({ ...m, payload: { ...m.payload, new_code: e.target.value.toUpperCase(), selectedSubject: null } }))} />
                  </div>
                  <div>
                    <label className={labelClass}>Subject Name</label>
                    <input type="text" placeholder="e.g. Web Programming" className={inputClass}
                      value={modal.payload.selectedSubject?.subject_name || modal.payload.new_name || ''}
                      disabled={!!modal.payload.selectedSubject}
                      onChange={e => setModal(m => ({ ...m, payload: { ...m.payload, new_name: e.target.value, selectedSubject: null } }))} />
                  </div>
                  <div>
                    <label className={labelClass}>Subject Type</label>
                    <select className={selectClass} value={modal.payload.selectedSubject?.subject_type || modal.payload.subject_type || 'theory'}
                      disabled={!!modal.payload.selectedSubject}
                      onChange={e => setModal(m => ({ ...m, payload: { ...m.payload, subject_type: e.target.value } }))}>
                      <option value="theory">Theory</option>
                      <option value="lab">Lab</option>
                    </select>
                  </div>
                </>
              )}

              {/* EDIT GROUP */}
              {modal.type === 'EDIT_GROUP' && (
                <>
                  <div>
                    <label className={labelClass}>Display Name</label>
                    <input type="text" className={inputClass} value={modal.payload.group_name}
                      onChange={e => setModal(m => ({ ...m, payload: { ...m.payload, group_name: e.target.value } }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Mode</label>
                      <select className={selectClass} value={modal.payload.subject_mode}
                        onChange={e => setModal(m => ({ ...m, payload: { ...m.payload, subject_mode: e.target.value } }))}>
                        <option value="theory">Theory</option>
                        <option value="lab">Lab</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Display Order</label>
                      <input type="number" className={inputClass} value={modal.payload.display_order}
                        onChange={e => setModal(m => ({ ...m, payload: { ...m.payload, display_order: e.target.value } }))} />
                    </div>
                  </div>
                </>
              )}

              {/* DELETE GROUP confirmation */}
              {modal.type === 'DELETE_GROUP' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm text-slate-700">
                    <p><span className="font-semibold">Group:</span> {modal.payload.group_name}</p>
                    <p className="mt-1"><span className="font-semibold">Subjects in group:</span> {modal.payload.subject_count}</p>
                  </div>
                  {modal.payload.subject_count > 0 ? (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-3 rounded-lg">
                      <Info size={14} className="shrink-0 mt-0.5" />
                      <span>This group still has <strong>{modal.payload.subject_count} subject(s)</strong>. You must remove all subjects from the group before it can be deleted.</span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-lg">
                      <Info size={14} className="shrink-0 mt-0.5" />
                      <span>This action removes the elective group definition. Subjects remain in the global catalogue.</span>
                    </div>
                  )}
                </div>
              )}

              {/* REMOVE FROM GROUP confirmation */}
              {modal.type === 'REMOVE_FROM_GROUP' && (
                <div className="space-y-3">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm text-slate-700">
                    <p><span className="font-semibold">Subject:</span> {modal.payload.subject_name} <span className="font-mono text-xs text-slate-400">({modal.payload.subject_code})</span></p>
                    <p className="mt-1"><span className="font-semibold">Group:</span> {modal.payload.group_name}</p>
                  </div>
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-lg">
                    <Info size={14} className="shrink-0 mt-0.5" />
                    <span>This removes the subject from this elective group only. The subject remains in the global catalogue and can be re-added.</span>
                  </div>
                </div>
              )}

              {/* DELETE CORE confirmation */}
              {modal.type === 'DELETE_CORE' && (
                <div className="space-y-3">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm text-slate-700">
                    <p><span className="font-semibold">Subject:</span> {modal.payload.subject_name}</p>
                    <p className="mt-1 font-mono text-xs text-slate-400">{modal.payload.subject_code}</p>
                  </div>
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-lg">
                    <Info size={14} className="shrink-0 mt-0.5" />
                    <span>Removes the mapping for this branch and semester. The subject remains in the global catalogue.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={closeModal} disabled={isSubmitting} className={ghostBtn}>Cancel</button>
              {modal.type === 'DELETE_GROUP' && modal.payload.subject_count > 0 ? null : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || (modal.type === 'ADD_ELECTIVE_SUBJECT' && !modal.payload.selectedSubject && !modal.payload.new_code)}
                  className={['DELETE_GROUP','REMOVE_FROM_GROUP','DELETE_CORE'].includes(modal.type) ? dangerBtn : primaryBtn}
                >
                  {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> Saving...</> :
                    modal.type === 'DELETE_GROUP' ? 'Delete Group' :
                    modal.type === 'REMOVE_FROM_GROUP' ? 'Remove from Group' :
                    modal.type === 'DELETE_CORE' ? 'Remove Mapping' :
                    ['EDIT_GROUP', 'EDIT_CORE', 'EDIT_ELECTIVE_SUBJECT'].includes(modal.type) ? 'Save Changes' :
                    'Confirm'
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
