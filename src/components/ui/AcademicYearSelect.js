import React from 'react';

/**
 * Generates academic years from startYear to endYear in YYYY-YY format.
 */
export function getAvailableAcademicYears(startYear = 2020, numYears = 10) {
  const years = [];
  for (let i = 0; i < numYears; i++) {
    const y = startYear + i;
    years.push(`${y}-${String(y + 1).slice(-2)}`);
  }
  return years;
}

/**
 * Gets the current academic year based on the current date.
 * Fallback mechanism if the backend hasn't provided one.
 */
export function getCurrentFrontendAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  // If we are before June (month < 5), we are in the previous academic year (e.g. 2025-26 ends in May 2026)
  const startYear = month < 5 ? year - 1 : year;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

export default function AcademicYearSelect({ 
  value, 
  onChange, 
  className = "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0b3578] bg-white",
  startYear = 2020,
  numYears = 10,
  required = false,
  disabled = false,
  placeholder = "Select Academic Year",
  id,
  name
}) {
  const years = getAvailableAcademicYears(startYear, numYears);
  
  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      className={className}
      required={required}
      disabled={disabled}
    >
      <option value="" disabled>{placeholder}</option>
      {years.map(yr => (
        <option key={yr} value={yr}>{yr}</option>
      ))}
    </select>
  );
}
