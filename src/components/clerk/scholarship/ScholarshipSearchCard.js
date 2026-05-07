"use client";

import { validateRollNo, getBranchFromRoll } from '@/lib/rollNumber';

export default function ScholarshipSearchCard({
  searchMode,
  setSearchMode,
  roll,
  setRoll,
  applicationNoInput,
  setApplicationNoInput,
  nameInput,
  setNameInput,
  rollError,
  setRollError,
  MAX_ROLL,
  loading,
  onSubmit,
  nameResults = [],
  onSelectStudentFromName,
}) {
  const handleRollChange = (e) => {
    const v = String(e.target.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    setRoll(v);
    if (v.length > 0 && v.length === MAX_ROLL) {
      try {
        const { isValid } = validateRollNo(v);
        if (!isValid) setRollError('Invalid Roll Number format.');
        else setRollError('');
      } catch {
        setRollError('Invalid Roll Number format.');
      }
    } else if (v.length > 0 && v.length !== MAX_ROLL) {
      setRollError(`Roll Number must be ${MAX_ROLL} characters long.`);
    } else {
      setRollError('');
    }
  };

  const handleAppChange = (e) => {
    const raw = String(e.target.value || '');
    const numeric = raw.replace(/\D/g, '').slice(0, 12);
    setApplicationNoInput(numeric);
  };

  const handleNameChange = (e) => {
    const v = String(e.target.value || '');
    setNameInput(v);
  };

  const disabled = loading || (
    searchMode === 'roll'
      ? String(roll).length !== MAX_ROLL
      : searchMode === 'application'
        ? !applicationNoInput
        : String(nameInput || '').trim().length < 2
  );

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6">
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Search Workspace</p>
        <h3 className="text-base font-semibold text-slate-900 tracking-tight">Student Search</h3>
        <p className="text-xs text-slate-600">Search by roll number, application number, or student name.</p>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-5">
        <fieldset className="flex flex-wrap items-center gap-3">
          <legend className="sr-only">Search mode</legend>
          {[
            { value: 'roll', label: 'Roll Number' },
            { value: 'application', label: 'Application Number' },
            { value: 'name', label: 'Student Name' },
          ].map((opt) => (
            <label key={opt.value} className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700 uppercase tracking-wider cursor-pointer select-none">
              <input
                type="radio"
                name="searchMode"
                value={opt.value}
                checked={searchMode === opt.value}
                onChange={() => {
                  setSearchMode(opt.value);
                  if (opt.value !== 'roll') setRoll('');
                  if (opt.value !== 'application') setApplicationNoInput('');
                  if (opt.value !== 'name') setNameInput('');
                  setRollError('');
                  if (opt.value === 'roll') {
                    setApplicationNoInput('');
                    setNameInput('');
                    setRoll('');
                  }
                  if (opt.value === 'application') {
                    setRoll('');
                    setNameInput('');
                  }
                  if (opt.value === 'name') {
                    setRoll('');
                    setApplicationNoInput('');
                  }
                }}
                className="accent-[#0b3578]"
              />
              {opt.label}
            </label>
          ))}
        </fieldset>

        <div className="space-y-2">
          {searchMode === 'roll' && (
            <input
              value={roll}
              onChange={handleRollChange}
              placeholder="Enter Roll Number"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578]/30"
              maxLength={MAX_ROLL}
              inputMode="text"
              autoComplete="off"
            />
          )}
          {searchMode === 'application' && (
            <input
              value={applicationNoInput}
              onChange={handleAppChange}
              placeholder="Enter Scholarship Application Number"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578]/30"
              maxLength={12}
              inputMode="numeric"
              autoComplete="off"
            />
          )}
          {searchMode === 'name' && (
            <input
              value={nameInput}
              onChange={handleNameChange}
              placeholder="Enter Student Name"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578]/30"
              autoComplete="off"
            />
          )}
          {rollError && searchMode === 'roll' && (
            <div className="text-rose-700 text-xs font-semibold uppercase tracking-wider">{rollError}</div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={disabled}
            className="px-4 py-2.5 bg-[#0b3578] text-white text-[11px] font-black uppercase tracking-widest rounded-md shadow-lg shadow-[#0b3578]/15 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
          >
            {loading ? 'Fetching…' : 'Fetch Student'}
          </button>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">No workflows changed</p>
        </div>

        {searchMode === 'name' && Array.isArray(nameResults) && nameResults.length > 0 && (
          <div className="mt-2 border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
            <div className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 bg-slate-50">
              Search Results
            </div>
            <ul className="divide-y divide-slate-100">
              {nameResults.map((s) => {
                const branch = getBranchFromRoll(s.roll_number);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onSelectStudentFromName && onSelectStudentFromName(s.roll_number)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 focus:outline-none focus:bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <span className="text-sm font-semibold text-slate-800">{s.name}</span>
                      <span className="text-[11px] text-slate-600 font-semibold uppercase tracking-wider">
                        {s.roll_number}
                        {branch ? ` — ${branch}` : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </form>
    </section>
  );
}
