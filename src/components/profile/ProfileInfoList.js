'use client';

import React from 'react';

export default function ProfileInfoList({ items }) {
  const rows = Array.isArray(items) ? items.filter(Boolean) : [];

  return (
    <div className="space-y-3 text-[16px]">
      {rows.map((item) => (
        <div key={item.key || item.label}>
          <span className="font-semibold">{item.label}:</span>
          <span className="ml-2">{item.value ?? '-'}</span>
        </div>
      ))}
    </div>
  );
}
