"use client";

import { validateRollNo } from '@/lib/rollNumber';

export default function ScholarshipSearchCard({
  searchMode,
  setSearchMode,
  roll,
  setRoll,
  applicationNoInput,
  setApplicationNoInput,
  rollError,
  setRollError,
  MAX_ROLL,
  loading,
  onSubmit,
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

  const disabled = loading || (searchMode === 'roll' ? String(roll).length !== MAX_ROLL : !applicationNoInput);

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
                  setRollError('');
                }}
                className="mr-2"
              />
              Application Number
            </label>
          </div>

          <div>
            {searchMode === 'roll' ? (
              <input
                value={roll}
                onChange={handleRollChange}
                placeholder="Enter Roll Number"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                maxLength={MAX_ROLL}
              />
            ) : (
              <input
                value={applicationNoInput}
                onChange={handleAppChange}
                placeholder="Enter Scholarship Application Number"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                maxLength={12}
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
        </form>
      </div>
    </section>
  );
}
