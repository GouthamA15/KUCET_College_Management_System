'use client';

import React from 'react';

export default function ProfileStatusBar({ title, lines }) {
  const rows = Array.isArray(lines) ? lines.filter(Boolean) : [];

  return (
    <div className="space-y-1">
      {title ? <div className="text-xl font-semibold">{title}</div> : null}

      {rows.length > 0 ? (
        <>
          {rows.map((row, idx) => (
            <div key={idx} className="text-blue-700 font-semibold">
              {row.label ? `${row.label}: ` : ''}
              {row.value ?? '-'}
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}
