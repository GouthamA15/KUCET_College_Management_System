"use client";

import { validateRollNo, getBranchFromRoll } from '@/lib/rollNumber';

export default function ScholarshipSearchCard({
  _searchMode,
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
  onClear,
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

  const disabled = loading || (!roll && !applicationNoInput && !nameInput);

  return (
    <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200 rounded-md p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Search Student</h2>
        <p className="text-sm text-gray-600">Search using Roll Number, Application Number, or Student Name.</p>
      </div>
      <form onSubmit={(e) => {
        // Set searchMode right before submit based on what's filled
        if (roll && String(roll).trim().length === MAX_ROLL) {
          setSearchMode('roll');
        } else if (applicationNoInput && String(applicationNoInput).trim()) {
          setSearchMode('application');
        } else if (nameInput && String(nameInput).trim().length >= 2) {
          setSearchMode('name');
        } else {
          setSearchMode(''); // page.js validation will catch it
        }
        onSubmit(e);
      }} className="">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Roll Number</label>
            <input
              value={roll}
              onChange={(e) => {
                handleRollChange(e);
                setApplicationNoInput('');
                setNameInput('');
              }}
              placeholder="e.g. 21B81A0501"
              className="w-full h-10 bg-white border border-gray-300 rounded-md px-3 text-sm text-gray-800 focus:outline-none focus:border-[#0b3578] uppercase"
              maxLength={MAX_ROLL}
              inputMode="text"
              autoComplete="off"
            />
            {rollError && (
              <div className="text-red-600 text-xs mt-1">{rollError}</div>
            )}
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Application Number</label>
            <input
              value={applicationNoInput}
              onChange={(e) => {
                handleAppChange(e);
                setRoll('');
                setNameInput('');
              }}
              placeholder="e.g. 202300001111"
              className="w-full h-10 bg-white border border-gray-300 rounded-md px-3 text-sm text-gray-800 focus:outline-none focus:border-[#0b3578]"
              maxLength={12}
              inputMode="numeric"
              autoComplete="off"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Student Name</label>
            <input
              value={nameInput}
              onChange={(e) => {
                handleNameChange(e);
                setRoll('');
                setApplicationNoInput('');
              }}
              placeholder="Enter full or partial name"
              className="w-full h-10 bg-white border border-gray-300 rounded-md px-3 text-sm text-gray-800 focus:outline-none focus:border-[#0b3578]"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={() => {
              if (onClear) onClear();
              else {
                setRoll('');
                setApplicationNoInput('');
                setNameInput('');
                setRollError('');
                setSearchMode('roll');
              }
            }}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={disabled}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              disabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' 
                : 'bg-[#0b3578] text-white hover:bg-[#082654] border border-[#0b3578] shadow-sm'
            }`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Searching...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <span>Search Records</span>
              </>
            )}
          </button>
        </div>

        {Array.isArray(nameResults) && nameResults.length > 0 && (
          <div className="mt-6 bg-white border border-gray-300 rounded-md overflow-hidden shadow-sm">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span className="bg-[#0b3578] text-white px-2 py-0.5 rounded-full text-xs">{nameResults.length}</span>
                Multiple Results Found
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {nameResults.map((s) => {
                const rollStr = s.roll_number || s.roll_no;
                const branch = getBranchFromRoll(rollStr);
                return (
                  <div key={s.id || rollStr} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium text-sm">
                        {(s.name || '').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800 text-sm">{s.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
                          <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{rollStr}</span>
                          {branch && <span>{branch}</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectStudentFromName && onSelectStudentFromName(rollStr)}
                      className="px-3 py-1.5 bg-white border border-gray-300 text-[#0b3578] hover:bg-gray-50 rounded-md text-xs font-medium transition-colors cursor-pointer"
                    >
                      Open Profile
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
