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
    <section className="mb-6">
      <div className="rounded-xl border border-indigo-100 shadow-sm bg-white p-6">
        <h2 className="text-xl font-semibold text-gray-800">Search Student</h2>
        <p className="text-sm text-gray-500 mt-1">
          Search by Roll Number or Scholarship Application Number
        </p>
        <form
          onSubmit={onSubmit}
          className="mt-4 space-y-4"
        >
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="radio"
                name="searchMode"
                value="roll"
                checked={searchMode === 'roll'}
                onChange={() => {
                  setSearchMode('roll');
                  setApplicationNoInput('');
                  setNameInput('');
                  setRoll('');
                  setRollError('');
                }}
                className="mr-2"
              />
              Roll Number
            </label>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="radio"
                name="searchMode"
                value="application"
                checked={searchMode === 'application'}
                onChange={() => {
                  setSearchMode('application');
                  setRoll('');
                  setNameInput('');
                  setRollError('');
                }}
                className="mr-2"
              />
              Application Number
            </label>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="radio"
                name="searchMode"
                value="name"
                checked={searchMode === 'name'}
                onChange={() => {
                  setSearchMode('name');
                  setRoll('');
                  setApplicationNoInput('');
                  setRollError('');
                }}
                className="mr-2"
              />
              Student Name
            </label>
          </div>

          <div>
            {searchMode === 'roll' && (
              <input
                value={roll}
                onChange={handleRollChange}
                placeholder="Enter Roll Number"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                maxLength={MAX_ROLL}
              />
            )}
            {searchMode === 'application' && (
              <input
                value={applicationNoInput}
                onChange={handleAppChange}
                placeholder="Enter Scholarship Application Number"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                maxLength={12}
              />
            )}
            {searchMode === 'name' && (
              <input
                value={nameInput}
                onChange={handleNameChange}
                placeholder="Enter Student Name"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            )}
            {rollError && searchMode === 'roll' && (
              <div className="text-red-600 text-sm mt-1">{rollError}</div>
            )}
          </div>

          <div className="flex">
            <button
              type="submit"
              disabled={disabled}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md disabled:opacity-60"
            >
              {loading ? 'Fetching...' : 'Fetch Student'}
            </button>
          </div>

          {searchMode === 'name' && Array.isArray(nameResults) && nameResults.length > 0 && (
            <div className="mt-4 border border-gray-200 rounded-md max-h-64 overflow-y-auto">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b bg-gray-50">
                Search Results
              </div>
              <ul className="divide-y divide-gray-100">
                {nameResults.map((s) => {
                  const branch = getBranchFromRoll(s.roll_number);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => onSelectStudentFromName && onSelectStudentFromName(s.roll_number)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 focus:outline-none focus:bg-indigo-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                      >
                        <span className="font-medium text-gray-800">{s.name}</span>
                        <span className="text-xs text-gray-600">
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
      </div>
    </section>
  );
}
