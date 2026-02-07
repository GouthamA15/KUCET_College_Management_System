"use client";

export default function FiltersButton({ show, onToggle, activeCount = 0 }) {
  return (
    <div className="relative inline-block text-left">
      <button type="button" onClick={onToggle} className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-md bg-white text-sm">
        <span>Filters</span>
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.293l3.71-4.064a.75.75 0 111.08 1.04l-4.25 4.657a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
        {activeCount ? <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-indigo-600 text-white">{activeCount}</span> : null}
      </button>
    </div>
  );
}
